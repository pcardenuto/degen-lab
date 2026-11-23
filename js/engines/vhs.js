(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage } = DegenLab;

  /**
   * Motor VHS (Simulador de Fita Magnética Analógica & Sinal Composto NTSC)
   * Implementa subamostragem e arrasto horizontal de crominância (YCbCr Chroma Bleed),
   * ruído de comutação de cabeçote (Head-Switching), rugas de fita (Tape Wrinkle),
   * dropouts magnéticos e OSD de videocassete anos 90.
   */
  function renderVhs(sourceCanvas, outputCanvas, state) {
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;

    const pixelScale = Math.max(1, Math.round(state.cellSize * 0.25));
    const w = Math.max(64, Math.floor(srcW / pixelScale));
    const h = Math.max(64, Math.floor(srcH / pixelScale));

    const processed = preprocessImage(sourceCanvas, w, h, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    const src = processed.rgba;
    const dst = new Uint8ClampedArray(src.length);

    const chromaBleed = (state.vhsChromaBleed ?? 65) / 100; // 0 a 1
    const trackingErr = (state.vhsTracking ?? 45) / 100;    // 0 a 1
    const tapeFlutter = (state.vhsFlutter ?? 40) / 100;     // 0 a 1
    const tapeNoise = (state.vhsNoise ?? 35) / 100;         // 0 a 1
    const showOsd = state.vhsOsd !== false;

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;

    let seed = 1994 + Math.floor(t * 24) * 131;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Posição da faixa de ruga de fita (Tape Crease / Tracking Ribbon)
    const wrinkleCenterY = anim.active
      ? Math.floor((((t * 0.28) % 1.2) - 0.1) * h)
      : Math.floor(h * 0.78);
    const wrinkleHeight = Math.max(6, Math.floor(h * (0.04 + trackingErr * 0.08)));

    // Fator de filtro passa-baixa para a crominância (quanto maior o bleed, mais lento o decaimento)
    const chromaAlpha = Math.max(0.06, 1 - chromaBleed * 0.88);
    const chromaLag = Math.round(chromaBleed * 10);

    for (let y = 0; y < h; y++) {
      // 1. Calcular jitter horizontal de sincronismo (Timebase Error)
      let lineShift = Math.round(
        Math.sin(y * 0.09 + t * 14) * tapeFlutter * 3.5 +
        (rand() - 0.5) * tapeFlutter * 4.0
      );

      // Ruga da fita (faixa de erro de tracking)
      const distWrinkle = Math.abs(y - wrinkleCenterY);
      let inWrinkle = false;
      let wrinkleIntensity = 0;
      if (trackingErr > 0.05 && distWrinkle < wrinkleHeight) {
        inWrinkle = true;
        wrinkleIntensity = (1 - distWrinkle / wrinkleHeight) * trackingErr;
        lineShift += Math.round(
          Math.sin(y * 0.8 + t * 30) * (w * 0.06) * wrinkleIntensity +
          (rand() - 0.3) * (w * 0.05) * wrinkleIntensity
        );
      }

      // Comutação de cabeçote na base da fita (Head-Switching Noise nos últimos 4% da tela)
      const headSwitchZone = h - Math.max(4, Math.floor(h * 0.045));
      if (y >= headSwitchZone) {
        const hsFactor = (y - headSwitchZone) / (h - headSwitchZone);
        lineShift += Math.round((0.4 + hsFactor) * w * 0.07 * (0.3 + trackingErr));
      }

      // Acumuladores de Crominância analógica (Cr e Cb borrados horizontalmente)
      let avgCr = 0;
      let avgCb = 0;

      for (let x = 0; x < w; x++) {
        const sx = (x + lineShift + w * 4) % w;
        const sIdx = (y * w + sx) * 4;

        // Amostra atrasada para a crominância (Chroma Phase Lag)
        const cx = (sx - chromaLag + w * 4) % w;
        const cIdx = (y * w + cx) * 4;

        // Luminância (Y) com leve halo de nitidez analógica (ringing)
        const sxPrev = (sx - 2 + w) % w;
        const pIdx = (y * w + sxPrev) * 4;
        const yCur = 0.299 * src[sIdx] + 0.587 * src[sIdx + 1] + 0.114 * src[sIdx + 2];
        const yPrev = 0.299 * src[pIdx] + 0.587 * src[pIdx + 1] + 0.114 * src[pIdx + 2];
        let Y = yCur + (yCur - yPrev) * 0.35;

        // Crominância (Cr = R - Y, Cb = B - Y) filtrada por passa-baixa IIR
        const yChroma = 0.299 * src[cIdx] + 0.587 * src[cIdx + 1] + 0.114 * src[cIdx + 2];
        const rawCr = src[cIdx] - yChroma;
        const rawCb = src[cIdx + 2] - yChroma;

        avgCr = avgCr * (1 - chromaAlpha) + rawCr * chromaAlpha;
        avgCb = avgCb * (1 - chromaAlpha) + rawCb * chromaAlpha;

        // Na faixa de ruga de tracking, a fita perde o burst de cor e ganha chuvisco
        let cr = avgCr;
        let cb = avgCb;
        if (inWrinkle) {
          cr *= 1 - wrinkleIntensity * 0.85;
          cb *= 1 - wrinkleIntensity * 0.85;
          if (rand() < wrinkleIntensity * 0.45) {
            Y = 180 + rand() * 75;
          }
        }

        // Ruído magnético / Hiss da fita
        if (tapeNoise > 0) {
          Y += (rand() - 0.5) * tapeNoise * 52;
        }

        // Elevar o nível de preto (óxido magnético de fita VHS nunca tem preto 0 absoluto)
        Y = 16 + Y * 0.88;

        // Scanline entrelaçada analógica
        if (y % 2 === 1) {
          Y *= 0.91;
        }

        const r = Math.max(0, Math.min(255, Y + cr));
        const b = Math.max(0, Math.min(255, Y + cb));
        const g = Math.max(0, Math.min(255, (Y - 0.299 * r - 0.114 * b) / 0.587));

        const dIdx = (y * w + x) * 4;
        dst[dIdx] = r;
        dst[dIdx + 1] = g;
        dst[dIdx + 2] = b;
        dst[dIdx + 3] = 255;
      }

      // Dropouts magnéticos (riscos brancos horizontais "cometas" de fita gasta)
      if (trackingErr > 0.1 && rand() < trackingErr * 0.09) {
        const cometX = Math.floor(rand() * (w - 20));
        const cometLen = Math.floor(4 + rand() * 26 * trackingErr);
        for (let k = 0; k < cometLen && cometX + k < w; k++) {
          const dIdx = (y * w + (cometX + k)) * 4;
          const fade = 1 - k / cometLen;
          dst[dIdx] = Math.min(255, dst[dIdx] + 220 * fade);
          dst[dIdx + 1] = Math.min(255, dst[dIdx + 1] + 220 * fade);
          dst[dIdx + 2] = Math.min(255, dst[dIdx + 2] + 220 * fade);
        }
      }
    }

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

    // OSD de Videocassete VCR (PLAY ► / SP / Data & Timecode)
    if (showOsd) {
      drawVcrOsd(ctx, outW, outH, t, anim.active);
    }

    return {
      cols: w,
      rows: h,
      pixelScale
    };
  }

  function drawVcrOsd(ctx, w, h, t, isPlaying) {
    const fontSize = Math.max(14, Math.round(h * 0.036));
    ctx.save();
    ctx.font = `700 ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
    ctx.textBaseline = 'top';

    const padX = Math.round(w * 0.045);
    const padY = Math.round(h * 0.05);

    const drawTextWithShadow = (text, x, y) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillText(text, x + 2, y + 2);
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = '#f2f5f0';
      ctx.fillText(text, x, y);
    };

    const blink = !isPlaying || Math.floor(t * 2) % 2 === 0;
    drawTextWithShadow(blink ? 'PLAY ►' : 'PLAY', padX, padY);
    drawTextWithShadow('SP  HI-FI', w - padX - fontSize * 5.2, padY);

    // Timecode dinâmico no rodapé
    const totalSec = Math.floor(t) + 46 * 60 + 20;
    const mm = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    const ff = String(Math.floor((t % 1) * 30)).padStart(2, '0');

    drawTextWithShadow(`NOV 23 1994`, padX, h - padY - fontSize * 2.3);
    drawTextWithShadow(`12:${mm}:${ss}:${ff}`, padX, h - padY - fontSize);
    ctx.restore();
  }

  DegenLab.renderVhs = renderVhs;
})(window);
