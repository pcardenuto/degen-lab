(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage } = DegenLab;

  let moshBuffer = null;
  let prevLuma = null;
  let bufW = 0;
  let bufH = 0;
  let impulseEnergy = 0;

  function triggerDatamoshImpulse() {
    impulseEnergy = 1.0;
  }

  function resetDatamoshBuffer() {
    moshBuffer = null;
    prevLuma = null;
  }

  /**
   * Motor Data Mosh (Simulação de Queda de I-Frame e Arrasto de Macroblocos P-Frame)
   * Reage ao movimento real (em vídeo/webcam) e a campos de vetores de movimento sintéticos (em fotos),
   * arrastando macroblocos 8x8/16x16 sobre o buffer temporal acumulado.
   */
  function renderDatamosh(sourceCanvas, outputCanvas, state) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const processed = preprocessImage(sourceCanvas, w, h, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    const src = processed.rgba;
    const luma = processed.luma;

    const blockSize = Math.max(4, state.moshBlockSize ?? 12);
    const smearStrength = (state.moshSmear ?? 65) / 100;
    const persistence = (state.moshPersistence ?? 84) / 100;
    const corruption = (state.moshCorruption ?? 35) / 100;
    const vectorStyle = state.moshVectorStyle || 'flow'; // 'flow' | 'gravity' | 'explode'

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;

    // Inicializar ou redimensionar buffers temporais
    if (!moshBuffer || bufW !== w || bufH !== h) {
      bufW = w;
      bufH = h;
      moshBuffer = new Uint8ClampedArray(src);
      prevLuma = new Float32Array(luma);
    }

    // Se estiver no modo estático (sem animação e sem vídeo), simulamos múltiplos passos P-frame
    // a partir do quadro original para que o usuário veja o efeito imediatamente ao mexer nos sliders
    const passes = anim.active ? 1 : 3;
    if (!anim.active && impulseEnergy <= 0.01) {
      moshBuffer.set(src);
    }

    let seed = 9001 + Math.floor(t * 15) * 73;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const nextBuf = new Uint8ClampedArray(moshBuffer);
    const bCols = Math.ceil(w / blockSize);
    const bRows = Math.ceil(h / blockSize);

    for (let pass = 0; pass < passes; pass++) {
      const passTime = anim.active ? t : 1.2 + pass * 0.45;
      const activeMult = (anim.active ? 0.6 + anim.intensity * 0.8 : 0.85) + impulseEnergy * 1.4;

      for (let by = 0; by < bRows; by++) {
        for (let bx = 0; bx < bCols; bx++) {
          const x0 = bx * blockSize;
          const y0 = by * blockSize;
          const cx = Math.min(w - 1, x0 + (blockSize >> 1));
          const cy = Math.min(h - 1, y0 + (blockSize >> 1));
          const cIdx = cy * w + cx;

          // 1. Detectar variação de movimento real (Optical Delta entre quadros)
          const motionDelta = Math.abs(luma[cIdx] - prevLuma[cIdx]) / 255;

          // 2. Calcular gradiente espacial + vetor P-frame sintético
          const xRight = Math.min(w - 1, cx + blockSize);
          const yDown = Math.min(h - 1, cy + blockSize);
          const gradX = (luma[cy * w + xRight] - luma[cIdx]) / 255;
          const gradY = (luma[yDown * w + cx] - luma[cIdx]) / 255;

          let vx = 0;
          let vy = 0;
          const maxShift = blockSize * 2.4 * smearStrength * activeMult;

          if (vectorStyle === 'gravity') {
            // Derretimento vertical de macroblocos P-Frame
            const colWave = 0.5 + 0.5 * Math.sin(bx * 0.25 + passTime * 3.5);
            vx = Math.round(gradX * maxShift * 0.5);
            vy = -Math.round((0.35 + (luma[cIdx] / 255) * colWave) * maxShift);
          } else if (vectorStyle === 'explode') {
            // Vetores radiais centrífugos
            const dx = (cx - w * 0.5) / (w * 0.5);
            const dy = (cy - h * 0.5) / (h * 0.5);
            const pulse = Math.sin(passTime * 4.0 - Math.hypot(dx, dy) * 3.0);
            vx = -Math.round(dx * maxShift * (0.6 + 0.5 * pulse));
            vy = -Math.round(dy * maxShift * (0.6 + 0.5 * pulse));
          } else {
            // Turbulência / Fluxo Óptico rotacional
            const angle =
              Math.sin(bx * 0.14 + passTime * 2.4) * Math.PI +
              Math.cos(by * 0.14 - passTime * 1.9) * Math.PI +
              gradX * 3.0;
            vx = Math.round(Math.cos(angle) * maxShift + gradY * maxShift);
            vy = Math.round(Math.sin(angle) * maxShift - gradX * maxShift);
          }

          // Em modo caos ou impulso de queda de I-frame, amplificar deslocamento de blocos
          if ((anim.active && anim.style === 'chaos') || impulseEnergy > 0.1) {
            if (rand() < 0.35 + impulseEnergy * 0.4) {
              vx += Math.round((rand() - 0.5) * blockSize * 5 * (smearStrength + impulseEnergy));
              vy += Math.round((rand() - 0.5) * blockSize * 3 * (smearStrength + impulseEnergy));
            }
          }

          // Quantizar vetores de movimento em sub-blocos (estética MPEG/H.264)
          const srcX0 = Math.max(0, Math.min(w - blockSize, x0 + vx));
          const srcY0 = Math.max(0, Math.min(h - blockSize, y0 + vy));

          // Decide se o macrobloco arrasta o buffer P-frame anterior ou atualiza do I-frame
          const moshProb = persistence * (0.55 + 0.45 * (luma[cIdx] / 255) + motionDelta * 2.5);
          const doMosh = rand() < moshProb || motionDelta > 0.04 || impulseEnergy > 0.05;

          const corruptBlock = rand() < corruption * 0.28;
          const chromaResidue = corruptBlock ? (rand() < 0.5 ? 1 : 2) : 0;

          const bw = Math.min(blockSize, w - x0);
          const bh = Math.min(blockSize, h - y0);

          for (let py = 0; py < bh; py++) {
            for (let px = 0; px < bw; px++) {
              const dIdx = ((y0 + py) * w + (x0 + px)) * 4;
              const mIdx = ((srcY0 + py) * w + (srcX0 + px)) * 4;

              if (doMosh) {
                let r = moshBuffer[mIdx];
                let g = moshBuffer[mIdx + 1];
                let b = moshBuffer[mIdx + 2];

                // Resíduo de quantização DCT / artefato YUV verde/magenta típico de P-frame órfão
                if (chromaResidue === 1) {
                  g = Math.min(255, (g & 0xe0) + 42);
                  r = r & 0xc0;
                } else if (chromaResidue === 2) {
                  r = Math.min(255, (r & 0xe0) + 48);
                  b = Math.min(255, (b & 0xe0) + 48);
                }

                // Mistura com o quadro real conforme a taxa de persistência (decay)
                const keep = Math.min(0.98, persistence + impulseEnergy * 0.15);
                nextBuf[dIdx] = Math.round(r * keep + src[dIdx] * (1 - keep));
                nextBuf[dIdx + 1] = Math.round(g * keep + src[dIdx + 1] * (1 - keep));
                nextBuf[dIdx + 2] = Math.round(b * keep + src[dIdx + 2] * (1 - keep));
                nextBuf[dIdx + 3] = 255;
              } else {
                nextBuf[dIdx] = src[dIdx];
                nextBuf[dIdx + 1] = src[dIdx + 1];
                nextBuf[dIdx + 2] = src[dIdx + 2];
                nextBuf[dIdx + 3] = 255;
              }
            }
          }
        }
      }

      moshBuffer.set(nextBuf);
    }

    prevLuma.set(luma);
    impulseEnergy = Math.max(0, impulseEnergy * 0.86 - 0.01);

    outputCanvas.width = w;
    outputCanvas.height = h;
    outputCanvas.getContext('2d').putImageData(new ImageData(moshBuffer, w, h), 0, 0);

    return {
      cols: bCols,
      rows: bRows,
      blockSize
    };
  }

  DegenLab.renderDatamosh = renderDatamosh;
  DegenLab.triggerDatamoshImpulse = triggerDatamoshImpulse;
  DegenLab.resetDatamoshBuffer = resetDatamoshBuffer;
})(window);
