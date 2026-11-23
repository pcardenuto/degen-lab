(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage } = DegenLab;

  /**
   * Motor Glitch / VHS / Datamosh
   * Combina fatiamento horizontal (slice tearing), deslocamento de blocos (macroblock mosh),
   * aberração cromática RGB, distorção de onda analógica e scanlines CRT.
   */
  function renderGlitch(sourceCanvas, outputCanvas, state) {
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;

    const pixelScale = Math.max(1, Math.round(state.cellSize * 0.35));
    const w = Math.max(32, Math.floor(srcW / pixelScale));
    const h = Math.max(32, Math.floor(srcH / pixelScale));

    const processed = preprocessImage(sourceCanvas, w, h, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    const src = processed.rgba;
    const dst = new Uint8ClampedArray(src.length);
    dst.set(src);

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;
    const animMult = anim.active ? 0.5 + anim.intensity : 1.0;

    // Gerador pseudo-aleatório determinístico (ou dinâmico durante animação)
    const timeSeedOffset = anim.active
      ? anim.style === 'chaos'
        ? Math.floor(t * 14) * 97
        : Math.floor(t * 6) * 31
      : 0;
    let seed = (state.glitchSeed || 1337) + timeSeedOffset;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const sliceAmount = (state.glitchSlices ?? 45) / 100;
    const rgbShiftPx = Math.round(((state.glitchRgbShift ?? 18) / pixelScale) * animMult);
    const blockMosh = (state.glitchBlockMosh ?? 30) / 100;
    const scanlines = (state.glitchScanlines ?? 40) / 100;

    // 1. Mapa de deslocamento horizontal por linha (Slice Tearing + Onda Analógica)
    const rowOffsets = new Int32Array(h);

    if (anim.active && (anim.style === 'wave' || anim.style === 'flow' || anim.style === 'moiré')) {
      const waveAmp = (8 + sliceAmount * 28) * anim.intensity;
      for (let y = 0; y < h; y++) {
        rowOffsets[y] = Math.round(
          Math.sin(y * 0.06 - t * 5.0) * waveAmp * 0.5 +
          Math.sin(y * 0.19 + t * 9.0) * waveAmp * 0.25
        );
      }
    }

    const numSlices = Math.floor(sliceAmount * 26 * animMult);
    for (let s = 0; s < numSlices; s++) {
      const sliceY = Math.floor(rand() * h);
      const sliceH = Math.max(1, Math.floor(rand() * (h * 0.12)));
      const maxShift = Math.floor(w * 0.28 * sliceAmount * animMult);
      const shift = Math.floor((rand() * 2 - 1) * maxShift);

      for (let y = sliceY; y < Math.min(h, sliceY + sliceH); y++) {
        rowOffsets[y] += shift;
      }
    }

    // Barra de tracking VHS viajante durante animação
    if (anim.active) {
      const barY = Math.floor(((t * 0.45) % 1.0) * h);
      const barH = Math.max(4, Math.floor(h * 0.08));
      for (let dy = 0; dy < barH; dy++) {
        const y = (barY + dy) % h;
        const env = Math.sin((dy / barH) * Math.PI);
        rowOffsets[y] += Math.round(env * (w * 0.09) * anim.intensity * (rand() - 0.2));
      }
    }

    // 2. Aplicar deslocamento de linha + Aberração Cromática RGB
    const shiftR = anim.active
      ? Math.round(rgbShiftPx * (0.7 + 0.6 * Math.sin(t * 7.3)))
      : rgbShiftPx;
    const shiftB = anim.active
      ? -Math.round(rgbShiftPx * (0.7 + 0.6 * Math.cos(t * 6.1)))
      : -rgbShiftPx;
    const shiftVerticalG = anim.active
      ? Math.round(Math.sin(t * 5.0) * (rgbShiftPx * 0.25))
      : 0;

    for (let y = 0; y < h; y++) {
      const baseShift = rowOffsets[y];
      const yG = Math.max(0, Math.min(h - 1, y + shiftVerticalG));

      for (let x = 0; x < w; x++) {
        const dstIdx = (y * w + x) * 4;

        const xR = (x + baseShift + shiftR + w * 4) % w;
        const xG = (x + baseShift + w * 4) % w;
        const xB = (x + baseShift + shiftB + w * 4) % w;

        dst[dstIdx] = src[(y * w + xR) * 4];
        dst[dstIdx + 1] = src[(yG * w + xG) * 4 + 1];
        dst[dstIdx + 2] = src[(y * w + xB) * 4 + 2];
        dst[dstIdx + 3] = 255;
      }
    }

    // 3. Datamosh de Macroblocos (Corrupção de blocos 12x12 / Clonagem / Inversão de canal)
    if (blockMosh > 0) {
      const blockSize = Math.max(4, Math.floor(14 / Math.sqrt(pixelScale)));
      const numBlocks = Math.floor(blockMosh * 45 * animMult);

      for (let b = 0; b < numBlocks; b++) {
        const bx = Math.floor(rand() * (w - blockSize));
        const by = Math.floor(rand() * (h - blockSize));
        const bw = Math.min(w - bx, Math.max(4, Math.floor(blockSize * (0.5 + rand() * 2.5))));
        const bh = Math.min(h - by, Math.max(3, Math.floor(blockSize * (0.5 + rand() * 1.8))));

        const srcBx = Math.max(0, Math.min(w - bw, bx + Math.floor((rand() - 0.5) * w * 0.25)));
        const srcBy = Math.max(0, Math.min(h - bh, by + Math.floor((rand() - 0.5) * h * 0.25)));
        const mode = rand();

        for (let py = 0; py < bh; py++) {
          for (let px = 0; px < bw; px++) {
            const dIdx = ((by + py) * w + (bx + px)) * 4;
            const sIdx = ((srcBy + py) * w + (srcBx + px)) * 4;

            if (mode < 0.55) {
              // Deslocamento de bloco clonado (P-Frame Mosh)
              dst[dIdx] = src[sIdx];
              dst[dIdx + 1] = src[sIdx + 1];
              dst[dIdx + 2] = src[sIdx + 2];
            } else if (mode < 0.8) {
              // Troca de canais (Cyber Cyan/Magenta block)
              dst[dIdx] = dst[sIdx + 1];
              dst[dIdx + 1] = dst[dIdx + 2];
              dst[dIdx + 2] = src[sIdx];
            } else {
              // Quantização extrema / Bitcrush
              dst[dIdx] = dst[dIdx] & 0xc0;
              dst[dIdx + 1] = dst[dIdx + 1] & 0xe0;
              dst[dIdx + 2] = dst[dIdx + 2] ^ 0xff;
            }
          }
        }
      }
    }

    // 4. Scanlines CRT + Ruído Analógico
    if (scanlines > 0) {
      const scanPhase = anim.active ? Math.floor(t * 20) : 0;
      for (let y = 0; y < h; y++) {
        const isDarkLine = (y + scanPhase) % 2 === 0;
        const factor = isDarkLine ? 1 - scanlines * 0.55 : 1 + scanlines * 0.12;
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          dst[idx] = Math.min(255, dst[idx] * factor);
          dst[idx + 1] = Math.min(255, dst[idx + 1] * factor);
          dst[idx + 2] = Math.min(255, dst[idx + 2] * factor);
        }
      }
    }

    // 5. Escalar para o canvas de saída com pixels nítidos
    const outW = w * pixelScale;
    const outH = h * pixelScale;
    outputCanvas.width = outW;
    outputCanvas.height = outH;

    const ctx = outputCanvas.getContext('2d');
    if (pixelScale === 1) {
      ctx.putImageData(new ImageData(dst, w, h), 0, 0);
    } else {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      temp.getContext('2d').putImageData(new ImageData(dst, w, h), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, 0, 0, outW, outH);
    }

    return {
      cols: w,
      rows: h,
      pixelScale
    };
  }

  DegenLab.renderGlitch = renderGlitch;
})(window);
