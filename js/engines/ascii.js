(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  const CHARSET_PRESETS = {
    standard: '@%#*+=-:. ',
    detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    blocks: '█▓▒░ ',
    minimal: '#+. ',
    binary: '01 ',
    matrix: '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ01:. '
  };

  /**
   * Renderiza a imagem no estilo ASCII Art no Canvas (com suporte a animação Matrix/Onda/Glitch)
   */
  function renderAscii(sourceCanvas, outputCanvas, state) {
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;

    const cellW = Math.max(4, state.cellSize);
    const cellH = Math.round(cellW * 1.65);

    const cols = Math.max(8, Math.floor(srcW / cellW));
    const rows = Math.max(6, Math.floor(srcH / cellH));

    const processed = preprocessImage(sourceCanvas, cols, rows, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    const outW = cols * cellW;
    const outH = rows * cellH;
    outputCanvas.width = outW;
    outputCanvas.height = outH;

    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, outW, outH);

    const fgRgb = hexToRgb(state.fgColor);
    const bgRgb = hexToRgb(state.bgColor);
    const fgLum = 0.2126 * fgRgb.r + 0.7152 * fgRgb.g + 0.0722 * fgRgb.b;
    const bgLum = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
    const isLightPaper = bgLum > fgLum && state.asciiColorMode === 'mono';

    const rawChars = state.asciiChars && state.asciiChars.length > 0 ? state.asciiChars : '@%#*+=-:. ';
    const charLen = rawChars.length;

    const fontSize = Math.max(6, Math.round(cellH * state.asciiFontScale));
    ctx.font = `700 ${fontSize}px "JetBrains Mono", "Fira Code", "SF Mono", "Menlo", "Consolas", monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;

    const lines = [];
    const colorGrid = [];

    for (let y = 0; y < rows; y++) {
      let rowStr = '';
      const rowColors = [];

      // Em modo animação "chaos", algumas linhas sofrem deslocamento horizontal
      let rowShift = 0;
      if (anim.active && anim.style === 'chaos') {
        const glitchTrigger = Math.sin(y * 0.7 + Math.floor(t * 12) * 1.9);
        if (glitchTrigger > 0.82) {
          rowShift = Math.round(Math.sin(t * 25 + y) * 5 * anim.intensity);
        }
      }

      for (let x = 0; x < cols; x++) {
        const sx = (x + rowShift + cols) % cols;
        const idx = y * cols + sx;
        const lum = processed.luma[idx];

        let inkDensity = isLightPaper ? 1 - lum / 255 : lum / 255;

        if (anim.active) {
          if (anim.style === 'flow') {
            // Chuva digital vertical estilo Matrix modulando a densidade
            const colSpeed = 2.5 + ((x * 73) % 19) * 0.15;
            const colOffset = ((x * 37) % 29) * 0.4;
            const drop = 0.5 + 0.5 * Math.sin(y * 0.22 - t * colSpeed + colOffset);
            inkDensity = Math.max(0, Math.min(1, inkDensity * (1 - 0.55 * anim.intensity + 0.85 * anim.intensity * drop)));
          } else if (anim.style === 'chaos') {
            // Cintilação rápida de terminal nos meios-tons
            const flicker = Math.sin((x * 19 + y * 31) + Math.floor(t * 18) * 7.1);
            if (inkDensity > 0.08) {
              inkDensity = Math.max(0, Math.min(1, inkDensity + flicker * 0.28 * anim.intensity));
            }
          } else {
            // Onda senoidal / Pulso radial suave
            const cx = cols * 0.5;
            const cy = rows * 0.5;
            const dist = Math.hypot(x - cx, (y - cy) * 1.5);
            const wave = Math.sin(dist * 0.22 - t * 4.5);
            inkDensity = Math.max(0, Math.min(1, inkDensity + wave * 0.26 * anim.intensity * inkDensity));
          }
        }

        const charIndex = Math.min(
          charLen - 1,
          Math.max(0, Math.floor((1 - inkDensity) * (charLen - 1)))
        );

        const ch = rawChars[charIndex];
        rowStr += ch;

        let fill = state.fgColor;
        if (state.asciiColorMode === 'color') {
          const cIdx = idx * 4;
          const r = processed.rgba[cIdx];
          const g = processed.rgba[cIdx + 1];
          const b = processed.rgba[cIdx + 2];
          fill = `rgb(${r},${g},${b})`;
        }
        rowColors.push(fill);

        if (ch !== ' ') {
          ctx.fillStyle = fill;
          ctx.fillText(ch, x * cellW + cellW * 0.5, y * cellH);
        }
      }

      lines.push(rowStr);
      colorGrid.push(rowColors);
    }

    return {
      cols,
      rows,
      cellW,
      cellH,
      fontSize,
      text: lines.join('\n'),
      lines,
      colorGrid,
      bgColor: state.bgColor,
      fgColor: state.fgColor,
      colorMode: state.asciiColorMode
    };
  }

  function buildAsciiHtml(asciiData) {
    const { lines, colorGrid, bgColor, fgColor, colorMode } = asciiData;
    const escapeHtml = (ch) => {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      return ch;
    };

    let bodyContent = '';
    if (colorMode === 'mono') {
      bodyContent = lines.map((line) => [...line].map(escapeHtml).join('')).join('\n');
    } else {
      bodyContent = lines
        .map((line, y) =>
          [...line]
            .map((ch, x) => {
              if (ch === ' ') return ' ';
              return `<span style="color:${colorGrid[y][x]}">${escapeHtml(ch)}</span>`;
            })
            .join('')
        )
        .join('\n');
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>ASCII Art — DEGEN // LAB</title>
<style>
  body {
    background: ${bgColor};
    color: ${fgColor};
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    padding: 24px;
  }
  pre {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 10px;
    line-height: 1.15;
    letter-spacing: 0.5px;
    font-weight: 700;
  }
</style>
</head>
<body>
<pre>${bodyContent}</pre>
</body>
</html>`;
  }

  function buildAsciiSvg(asciiData) {
    const { cols, rows, cellW, cellH, fontSize, lines, colorGrid, bgColor, fgColor, colorMode } = asciiData;
    const w = cols * cellW;
    const h = rows * cellH;

    const escapeXml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const elements = [];
    for (let y = 0; y < rows; y++) {
      const line = lines[y];
      const py = y * cellH + fontSize * 0.85;
      for (let x = 0; x < cols; x++) {
        const ch = line[x];
        if (ch === ' ') continue;
        const px = x * cellW + cellW * 0.5;
        const fill = colorMode === 'color' ? colorGrid[y][x] : fgColor;
        elements.push(
          `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" fill="${fill}">${escapeXml(ch)}</text>`
        );
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g font-family="monospace" font-weight="700" font-size="${fontSize}" text-anchor="middle">
    ${elements.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.CHARSET_PRESETS = CHARSET_PRESETS;
  DegenLab.renderAscii = renderAscii;
  DegenLab.buildAsciiHtml = buildAsciiHtml;
  DegenLab.buildAsciiSvg = buildAsciiSvg;
})(window);
