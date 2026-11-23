(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  const BAYER_2 = [
    [0, 2],
    [3, 1]
  ];

  const BAYER_4 = [
    [0,  8,  2, 10],
    [12, 4, 14,  6],
    [3, 11,  1,  9],
    [15, 7, 13,  5]
  ];

  const BAYER_8 = [
    [ 0, 32,  8, 40,  2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44,  4, 36, 14, 46,  6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [ 3, 35, 11, 43,  1, 33,  9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47,  7, 39, 13, 45,  5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];

  const HARDWARE_PALETTES = {
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'].map(hexToRgb),
    cga: ['#000000', '#55ffff', '#ff55ff', '#ffffff'].map(hexToRgb),
    cyber: ['#070512', '#1f0d3d', '#6b114d', '#005f8c', '#ff1e56', '#00f5d4', '#ffbe0b', '#ffffff'].map(hexToRgb),
    pico8: [
      '#000000', '#1D2B53', '#7E2553', '#008751',
      '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
    ].map(hexToRgb),
    c64: [
      '#000000', '#FFFFFF', '#880000', '#AAFFEE',
      '#CC44CC', '#00CC55', '#0000AA', '#EEEE77',
      '#DD8855', '#664400', '#FF7777', '#333333',
      '#777777', '#AAFF66', '#0088FF', '#BBBBBB'
    ].map(hexToRgb)
  };

  function renderBitmap(sourceCanvas, outputCanvas, state) {
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;

    const pixelScale = Math.max(1, Math.round(state.cellSize * 0.5));
    const cols = Math.max(16, Math.floor(srcW / pixelScale));
    const rows = Math.max(16, Math.floor(srcH / pixelScale));

    const processed = preprocessImage(sourceCanvas, cols, rows, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    const paletteMode = state.bitmapPaletteMode || '1bit';
    const algo = state.bitmapAlgo || 'atkinson';
    const threshold = state.bitmapThreshold ?? 128;
    const bleed = (state.bitmapBleed ?? 100) / 100;

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;
    const audioBass = state.audio?.active ? state.audio.bass * state.audio.gain : 0;

    if (paletteMode !== '1bit' && HARDWARE_PALETTES[paletteMode]) {
      return renderMultiColorBitmap(
        processed,
        outputCanvas,
        cols,
        rows,
        pixelScale,
        HARDWARE_PALETTES[paletteMode],
        algo,
        threshold,
        bleed,
        anim,
        audioBass,
        state
      );
    }

    const luma = new Float32Array(processed.luma);
    const bits = new Uint8Array(cols * rows);

    if (anim.active || audioBass > 0.05) {
      let seed = 1337 + Math.floor(t * 16) * 101;
      const nextRand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      const cx = cols * 0.5;
      const cy = rows * 0.5;
      const effInt = anim.intensity + audioBass * 0.6;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x;
          if (anim.style === 'chaos') {
            const jitter = (nextRand() - 0.5) * 72 * effInt;
            luma[idx] = Math.max(0, Math.min(255, luma[idx] + jitter));
          } else if (anim.style === 'flow') {
            const wave = Math.sin(x * 0.08 + y * 0.08 - t * 5.0) * 48 * effInt;
            luma[idx] = Math.max(0, Math.min(255, luma[idx] + wave));
          } else {
            const dist = Math.hypot(x - cx, y - cy);
            const pulse = Math.sin(dist * 0.09 - t * 4.5) * 45 * effInt;
            luma[idx] = Math.max(0, Math.min(255, luma[idx] + pulse));
          }
        }
      }
    }

    const phaseShift = anim.active && anim.style === 'flow' ? Math.floor(t * 8) : 0;

    if (algo === 'atkinson' || algo === 'floyd' || algo === 'sierra') {
      applyErrorDiffusion(luma, bits, cols, rows, algo, threshold, bleed);
    } else if (algo === 'bayer2') {
      applyOrderedBayer(luma, bits, cols, rows, BAYER_2, 2, threshold, bleed, phaseShift);
    } else if (algo === 'bayer4') {
      applyOrderedBayer(luma, bits, cols, rows, BAYER_4, 4, threshold, bleed, phaseShift);
    } else if (algo === 'bayer8') {
      applyOrderedBayer(luma, bits, cols, rows, BAYER_8, 8, threshold, bleed, phaseShift);
    } else if (algo === 'random') {
      const randSeed = anim.active ? 1337 + Math.floor(t * 20) * 79 : 1337;
      applyRandomDither(luma, bits, cols, rows, threshold, bleed, randSeed);
    } else {
      for (let i = 0; i < luma.length; i++) {
        bits[i] = luma[i] >= threshold ? 1 : 0;
      }
    }

    const fgRgb = hexToRgb(state.fgColor);
    const bgRgb = hexToRgb(state.bgColor);
    const fgLum = 0.2126 * fgRgb.r + 0.7152 * fgRgb.g + 0.0722 * fgRgb.b;
    const bgLum = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
    const isLightPaper = bgLum > fgLum;

    const outW = cols * pixelScale;
    const outH = rows * pixelScale;
    outputCanvas.width = outW;
    outputCanvas.height = outH;

    const ctx = outputCanvas.getContext('2d');
    const imgData = ctx.createImageData(outW, outH);
    const out = imgData.data;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const bit = bits[y * cols + x];
        const isInk = isLightPaper ? bit === 0 : bit === 1;
        const color = isInk ? fgRgb : bgRgb;

        const startY = y * pixelScale;
        const startX = x * pixelScale;
        for (let py = 0; py < pixelScale; py++) {
          let rowOffset = ((startY + py) * outW + startX) * 4;
          for (let px = 0; px < pixelScale; px++) {
            out[rowOffset] = color.r;
            out[rowOffset + 1] = color.g;
            out[rowOffset + 2] = color.b;
            out[rowOffset + 3] = 255;
            rowOffset += 4;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    return {
      cols,
      rows,
      pixelScale,
      bits,
      isLightPaper,
      fgColor: state.fgColor,
      bgColor: state.bgColor
    };
  }

  /**
   * Renderiza Dithering Multi-Cor para paletas de hardware retrô (GameBoy 4-Tons, CGA, PICO-8, C64)
   */
  function renderMultiColorBitmap(
    processed,
    outputCanvas,
    cols,
    rows,
    pixelScale,
    palette,
    algo,
    threshold,
    bleed,
    anim,
    audioBass,
    state
  ) {
    const rBuf = new Float32Array(cols * rows);
    const gBuf = new Float32Array(cols * rows);
    const bBuf = new Float32Array(cols * rows);
    const bias = (128 - threshold) * 0.8;

    const t = anim.time;
    const effInt = anim.intensity + audioBass * 0.5;

    for (let i = 0, c = 0; i < rBuf.length; i++, c += 4) {
      let mod = bias;
      if (anim.active || audioBass > 0.05) {
        const x = i % cols;
        const y = Math.floor(i / cols);
        mod += Math.sin(x * 0.07 + y * 0.07 - t * 4.8) * 35 * effInt;
      }
      rBuf[i] = Math.max(0, Math.min(255, processed.rgba[c] + mod));
      gBuf[i] = Math.max(0, Math.min(255, processed.rgba[c + 1] + mod));
      bBuf[i] = Math.max(0, Math.min(255, processed.rgba[c + 2] + mod));
    }

    const isBayer = algo.startsWith('bayer');
    const bayerMatrix = algo === 'bayer2' ? BAYER_2 : algo === 'bayer8' ? BAYER_8 : BAYER_4;
    const bayerN = algo === 'bayer2' ? 2 : algo === 'bayer8' ? 8 : 4;
    const bayerSpread = 68 * bleed;

    const nearestPaletteColor = (r, g, b) => {
      let best = palette[0];
      let bestDist = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const p = palette[i];
        const dr = r - p.r;
        const dg = g - p.g;
        const db = b - p.b;
        const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (dist < bestDist) {
          bestDist = dist;
          best = p;
        }
      }
      return best;
    };

    const addRgbErr = (x, y, er, eg, eb) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        const idx = y * cols + x;
        rBuf[idx] += er;
        gBuf[idx] += eg;
        bBuf[idx] += eb;
      }
    };

    const chosenColors = new Array(cols * rows);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        let r = rBuf[idx];
        let g = gBuf[idx];
        let b = bBuf[idx];

        if (isBayer) {
          const mVal = (bayerMatrix[y % bayerN][x % bayerN] + 0.5) / (bayerN * bayerN) - 0.5;
          r += mVal * bayerSpread;
          g += mVal * bayerSpread;
          b += mVal * bayerSpread;
        }

        const chosen = nearestPaletteColor(r, g, b);
        chosenColors[idx] = chosen;

        if (algo === 'atkinson' || algo === 'floyd' || algo === 'sierra') {
          const er = (r - chosen.r) * bleed;
          const eg = (g - chosen.g) * bleed;
          const eb = (b - chosen.b) * bleed;

          if (algo === 'atkinson') {
            addRgbErr(x + 1, y, er / 8, eg / 8, eb / 8);
            addRgbErr(x + 2, y, er / 8, eg / 8, eb / 8);
            addRgbErr(x - 1, y + 1, er / 8, eg / 8, eb / 8);
            addRgbErr(x, y + 1, er / 8, eg / 8, eb / 8);
            addRgbErr(x + 1, y + 1, er / 8, eg / 8, eb / 8);
            addRgbErr(x, y + 2, er / 8, eg / 8, eb / 8);
          } else if (algo === 'floyd') {
            addRgbErr(x + 1, y, (er * 7) / 16, (eg * 7) / 16, (eb * 7) / 16);
            addRgbErr(x - 1, y + 1, (er * 3) / 16, (eg * 3) / 16, (eb * 3) / 16);
            addRgbErr(x, y + 1, (er * 5) / 16, (eg * 5) / 16, (eb * 5) / 16);
            addRgbErr(x + 1, y + 1, er / 16, eg / 16, eb / 16);
          } else {
            addRgbErr(x + 1, y, er * 0.5, eg * 0.5, eb * 0.5);
            addRgbErr(x - 1, y + 1, er * 0.25, eg * 0.25, eb * 0.25);
            addRgbErr(x, y + 1, er * 0.25, eg * 0.25, eb * 0.25);
          }
        }
      }
    }

    const outW = cols * pixelScale;
    const outH = rows * pixelScale;
    outputCanvas.width = outW;
    outputCanvas.height = outH;

    const ctx = outputCanvas.getContext('2d');
    const imgData = ctx.createImageData(outW, outH);
    const out = imgData.data;
    const bits = new Uint8Array(cols * rows);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const color = chosenColors[idx];
        const lum = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
        bits[idx] = lum >= 110 ? 1 : 0;

        const startY = y * pixelScale;
        const startX = x * pixelScale;
        for (let py = 0; py < pixelScale; py++) {
          let rowOffset = ((startY + py) * outW + startX) * 4;
          for (let px = 0; px < pixelScale; px++) {
            out[rowOffset] = color.r;
            out[rowOffset + 1] = color.g;
            out[rowOffset + 2] = color.b;
            out[rowOffset + 3] = 255;
            rowOffset += 4;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    return {
      cols,
      rows,
      pixelScale,
      bits,
      chosenColors,
      isLightPaper: false,
      fgColor: state.fgColor,
      bgColor: state.bgColor
    };
  }

  function applyErrorDiffusion(luma, bits, w, h, algo, threshold, bleed) {
    const addError = (x, y, err) => {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        luma[y * w + x] += err;
      }
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const oldVal = luma[idx];
        const newVal = oldVal >= threshold ? 255 : 0;
        bits[idx] = newVal === 255 ? 1 : 0;
        const err = (oldVal - newVal) * bleed;

        if (algo === 'atkinson') {
          const wErr = err / 8;
          addError(x + 1, y, wErr);
          addError(x + 2, y, wErr);
          addError(x - 1, y + 1, wErr);
          addError(x, y + 1, wErr);
          addError(x + 1, y + 1, wErr);
          addError(x, y + 2, wErr);
        } else if (algo === 'floyd') {
          addError(x + 1, y, (err * 7) / 16);
          addError(x - 1, y + 1, (err * 3) / 16);
          addError(x, y + 1, (err * 5) / 16);
          addError(x + 1, y + 1, (err * 1) / 16);
        } else if (algo === 'sierra') {
          addError(x + 1, y, (err * 2) / 4);
          addError(x - 1, y + 1, (err * 1) / 4);
          addError(x, y + 1, (err * 1) / 4);
        }
      }
    }
  }

  function applyOrderedBayer(luma, bits, w, h, matrix, n, threshold, bleed, phaseShift = 0) {
    const levels = n * n;
    const spread = 180 * bleed;
    const bias = threshold - 128;

    for (let y = 0; y < h; y++) {
      const my = (y + phaseShift) % n;
      for (let x = 0; x < w; x++) {
        const mx = (x + phaseShift) % n;
        const idx = y * w + x;
        const mVal = (matrix[my][mx] + 0.5) / levels - 0.5;
        const adjusted = luma[idx] - bias + mVal * spread;
        bits[idx] = adjusted >= 128 ? 1 : 0;
      }
    }
  }

  function applyRandomDither(luma, bits, w, h, threshold, bleed, startSeed = 1337) {
    let seed = startSeed;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const noiseAmp = 140 * bleed;
    for (let i = 0; i < luma.length; i++) {
      const jitter = (nextRand() - 0.5) * noiseAmp;
      bits[i] = luma[i] + jitter >= threshold ? 1 : 0;
    }
  }

  function buildBitmapSvg(bitmapData) {
    const { cols, rows, pixelScale, bits, chosenColors, isLightPaper, fgColor, bgColor } = bitmapData;
    const w = cols * pixelScale;
    const h = rows * pixelScale;

    if (chosenColors) {
      const rects = [];
      for (let y = 0; y < rows; y++) {
        let runStart = 0;
        let curColor = `rgb(${chosenColors[y * cols].r},${chosenColors[y * cols].g},${chosenColors[y * cols].b})`;
        let runLen = 1;
        for (let x = 1; x <= cols; x++) {
          const nextColor =
            x < cols
              ? `rgb(${chosenColors[y * cols + x].r},${chosenColors[y * cols + x].g},${chosenColors[y * cols + x].b})`
              : '';
          if (nextColor === curColor) {
            runLen++;
          } else {
            rects.push(
              `<rect x="${runStart * pixelScale}" y="${y * pixelScale}" width="${runLen * pixelScale}" height="${pixelScale}" fill="${curColor}" />`
            );
            runStart = x;
            curColor = nextColor;
            runLen = 1;
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">
  ${rects.join('\n  ')}
</svg>`;
    }

    const rects = [];
    for (let y = 0; y < rows; y++) {
      let runStart = -1;
      let runLen = 0;

      for (let x = 0; x <= cols; x++) {
        const isInk =
          x < cols
            ? isLightPaper
              ? bits[y * cols + x] === 0
              : bits[y * cols + x] === 1
            : false;

        if (isInk) {
          if (runStart === -1) runStart = x;
          runLen++;
        } else if (runStart !== -1) {
          rects.push(
            `<rect x="${runStart * pixelScale}" y="${y * pixelScale}" width="${runLen * pixelScale}" height="${pixelScale}" />`
          );
          runStart = -1;
          runLen = 0;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g fill="${fgColor}">
    ${rects.join('\n    ')}
  </g>
</svg>`;
  }

  function buildBitmapText(bitmapData) {
    const { cols, rows, bits, isLightPaper } = bitmapData;
    const lines = [];
    for (let y = 0; y < rows; y++) {
      let row = '';
      for (let x = 0; x < cols; x++) {
        const bit = bits[y * cols + x];
        const isInk = isLightPaper ? bit === 0 : bit === 1;
        row += isInk ? '█' : ' ';
      }
      lines.push(row);
    }
    return lines.join('\n');
  }

  DegenLab.renderBitmap = renderBitmap;
  DegenLab.buildBitmapSvg = buildBitmapSvg;
  DegenLab.buildBitmapText = buildBitmapText;
})(window);
