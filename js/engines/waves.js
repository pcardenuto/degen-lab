(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  /**
   * Motor Osciloscópio / Wave Lines (Estilo Rutt-Etra & Modulação Senoidal FM)
   * Converte a luminância da foto em linhas vetoriais moduladas com suporte a oclusão 3D e exportação SVG.
   */
  function renderWaves(sourceCanvas, outputCanvas, state) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const processed = preprocessImage(sourceCanvas, w, h, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    outputCanvas.width = w;
    outputCanvas.height = h;
    const ctx = outputCanvas.getContext('2d');

    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);

    const fgRgb = hexToRgb(state.fgColor);
    const bgRgb = hexToRgb(state.bgColor);
    const fgLum = 0.2126 * fgRgb.r + 0.7152 * fgRgb.g + 0.0722 * fgRgb.b;
    const bgLum = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
    const isLightPaper = bgLum > fgLum;

    const lineSpacing = Math.max(4, state.cellSize);
    const waveStyle = state.waveStyle || 'elevation'; // 'elevation' | 'sine' | 'vertical'
    const amplitude = (state.waveAmplitude ?? 24);
    const freq = (state.waveFrequency ?? 35) / 100;
    const strokeW = state.waveStroke ?? 1.6;
    const colorMode = state.waveColorMode || 'mono';

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;

    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const svgPaths = [];
    const stepX = 3;
    const rows = Math.floor(h / lineSpacing);

    if (waveStyle === 'vertical') {
      const cols = Math.floor(w / lineSpacing);
      for (let c = 0; c < cols; c++) {
        const baseX = c * lineSpacing + lineSpacing * 0.5;
        ctx.beginPath();
        let dPath = '';

        for (let y = 0; y < h; y += stepX) {
          const ix = Math.min(w - 1, Math.max(0, Math.floor(baseX)));
          const lum = processed.luma[y * w + ix] / 255;
          const density = isLightPaper ? 1 - lum : lum;

          const phase = anim.active ? t * 7.0 + c * 0.35 : c * 0.35;
          const carrier = Math.sin(y * freq * 0.8 + phase);
          const dx = carrier * density * amplitude * (anim.active ? 0.75 + 0.4 * anim.intensity : 1);
          const px = baseX + dx;

          if (y === 0) {
            ctx.moveTo(px, y);
            dPath += `M ${px.toFixed(1)} ${y.toFixed(1)}`;
          } else {
            ctx.lineTo(px, y);
            dPath += ` L ${px.toFixed(1)} ${y.toFixed(1)}`;
          }
        }

        ctx.strokeStyle = state.fgColor;
        ctx.stroke();
        svgPaths.push(`<path d="${dPath}" stroke="${state.fgColor}" fill="none" stroke-width="${strokeW}" />`);
      }
    } else {
      // Horizontal: 'elevation' (Rutt-Etra 3D com oclusão) ou 'sine' (Modulação FM)
      for (let r = 0; r < rows; r++) {
        const baseY = r * lineSpacing + lineSpacing * 0.5;
        const pts = [];

        for (let x = 0; x < w; x += stepX) {
          const iy = Math.min(h - 1, Math.max(0, Math.floor(baseY)));
          const lum = processed.luma[iy * w + x] / 255;
          const density = isLightPaper ? 1 - lum : lum;

          let dy = 0;
          if (waveStyle === 'elevation') {
            let ripple = 1.0;
            if (anim.active) {
              if (anim.style === 'chaos') {
                ripple = 1.0 + Math.sin(x * 0.08 + t * 14 + r) * 0.45 * anim.intensity;
              } else {
                ripple = 1.0 + Math.sin(x * 0.025 - t * 4.2 + r * 0.25) * 0.38 * anim.intensity;
              }
            }
            dy = -density * amplitude * 1.35 * ripple;
          } else {
            // Modulação Senoidal FM
            const phase = anim.active ? t * 8.5 + r * 0.4 : r * 0.4;
            const carrier = Math.sin(x * freq + phase * (anim.style === 'chaos' ? 1.8 : 1.0));
            dy = carrier * density * amplitude;
          }

          pts.push({ x, y: baseY + dy, iy });
        }

        if (pts.length === 0) continue;

        // Oclusão de linha oculta no modo Elevação (preenche abaixo da crista com a cor de fundo)
        if (waveStyle === 'elevation') {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, baseY + lineSpacing);
          for (const p of pts) {
            ctx.lineTo(p.x, p.y);
          }
          ctx.lineTo(pts[pts.length - 1].x, baseY + lineSpacing);
          ctx.closePath();
          ctx.fillStyle = state.bgColor;
          ctx.fill();
        }

        // Desenhar linha do osciloscópio
        ctx.beginPath();
        let dPath = '';
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (i === 0) {
            ctx.moveTo(p.x, p.y);
            dPath += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          } else {
            ctx.lineTo(p.x, p.y);
            dPath += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }
        }

        let strokeColor = state.fgColor;
        if (colorMode === 'color') {
          const midX = Math.floor(w * 0.5);
          const midY = Math.min(h - 1, Math.max(0, Math.floor(baseY)));
          const cIdx = (midY * w + midX) * 4;
          strokeColor = `rgb(${processed.rgba[cIdx]},${processed.rgba[cIdx + 1]},${processed.rgba[cIdx + 2]})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        svgPaths.push(
          `<path d="${dPath}" stroke="${strokeColor}" fill="none" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`
        );
      }
    }

    return {
      width: w,
      height: h,
      cols: Math.floor(w / stepX),
      rows,
      bgColor: state.bgColor,
      fgColor: state.fgColor,
      svgPaths
    };
  }

  function buildWavesSvg(wavesData) {
    const { width, height, bgColor, svgPaths } = wavesData;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g>
    ${svgPaths.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.renderWaves = renderWaves;
  DegenLab.buildWavesSvg = buildWavesSvg;
})(window);
