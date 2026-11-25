(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  let bloomCanvas = null;
  let maskCanvas = null;

  /**
   * Renderiza o Histograma de Luminância em Tempo Real (64 bins)
   * e destaca faixas de limiar ativas (Bitmap Threshold / Pixel Sort Min-Max).
   */
  function renderHistogram(sourceCanvas, histCanvas, state) {
    if (!sourceCanvas || !histCanvas) return;

    const sampleW = 120;
    const sampleH = 90;
    const processed = preprocessImage(sourceCanvas, sampleW, sampleH, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: 0,
      invert: state.invert
    });

    const bins = new Uint32Array(64);
    let maxBin = 1;
    let sumLum = 0;

    const luma = processed.luma;
    for (let i = 0; i < luma.length; i++) {
      const v = luma[i];
      sumLum += v;
      const b = Math.min(63, Math.max(0, Math.floor((v / 256) * 64)));
      bins[b]++;
      if (bins[b] > maxBin) maxBin = bins[b];
    }

    const w = histCanvas.width;
    const h = histCanvas.height;
    const ctx = histCanvas.getContext('2d');

    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0.25; gx < 1; gx += 0.25) {
      ctx.beginPath();
      ctx.moveTo(w * gx, 0);
      ctx.lineTo(w * gx, h);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 230, 118, 0.65)');
    grad.addColorStop(1, 'rgba(0, 230, 118, 0.05)');

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 64; i++) {
      const x = (i / 63) * w;
      const norm = Math.pow(bins[i] / maxBin, 0.75);
      const y = h - norm * (h - 8) - 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < 64; i++) {
      const x = (i / 63) * w;
      const norm = Math.pow(bins[i] / maxBin, 0.75);
      const y = h - norm * (h - 8) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (state.mode === 'bitmap') {
      const tx = ((state.bitmapThreshold ?? 128) / 255) * w;
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, h);
      ctx.stroke();
    } else if (state.mode === 'pixelsort') {
      const xMin = ((state.sortMin ?? 45) / 255) * w;
      const xMax = ((state.sortMax ?? 210) / 255) * w;
      ctx.fillStyle = 'rgba(255, 176, 0, 0.14)';
      ctx.fillRect(Math.min(xMin, xMax), 0, Math.abs(xMax - xMin), h);
    }

    const avgPct = Math.round((sumLum / (luma.length * 255)) * 100);
    return avgPct;
  }

  /**
   * Aplica o Rack de Pós-Processamento Global:
   * - Duotone Universal & Aberração Cromática Final
   * - Phosphor Bloom / Neon Glow
   * - Scanlines & Vinheta CRT
   * - Máscara de Foco (Proteger Rosto/Produto no Centro ou Topo) + Mix com Foto Original
   * - Recorte de Fundo Transparente (Alpha Channel Cutout para Figma/Photoshop)
   */
  function applyGlobalPostFx(outputCanvas, state, sourceCanvas) {
    const w = outputCanvas.width;
    const h = outputCanvas.height;
    if (!w || !h) return;

    const ctx = outputCanvas.getContext('2d');
    const audioBass = state.audio?.active ? state.audio.bass * state.audio.gain : 0;
    const audioHigh = state.audio?.active ? state.audio.high * state.audio.gain : 0;

    const duotoneOn = Boolean(state.duotoneEnabled);
    const duotoneMix = (state.duotoneMix ?? 85) / 100;
    const bloomAmt = Math.min(1.5, (state.postBloom ?? 0) / 100 + audioBass * 0.45);
    const scanlinesAmt = (state.postScanlines ?? 0) / 100;
    const vignetteAmt = (state.postVignette ?? 0) / 100;
    const chromaShift = Math.round((state.postChroma ?? 0) + audioHigh * 6);
    const transparentBg = Boolean(state.transparentBg);

    // 1. Duotone Color Grading Universal + Aberração Cromática Final + Recorte Alpha Transparente
    if (duotoneOn || chromaShift > 0 || transparentBg) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const srcCopy = chromaShift > 0 ? new Uint8ClampedArray(data) : null;

      const fg = hexToRgb(state.fgColor);
      const bg = hexToRgb(state.bgColor);
      const fgLum = 0.2126 * fg.r + 0.7152 * fg.g + 0.0722 * fg.b;
      const bgLum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
      const darkColor = bgLum <= fgLum ? bg : fg;
      const lightColor = bgLum <= fgLum ? fg : bg;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;

          if (chromaShift > 0 && srcCopy) {
            const xR = Math.min(w - 1, Math.max(0, x + chromaShift));
            const xB = Math.min(w - 1, Math.max(0, x - chromaShift));
            data[idx] = srcCopy[(y * w + xR) * 4];
            data[idx + 2] = srcCopy[(y * w + xB) * 4 + 2];
          }

          if (duotoneOn) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const t = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

            const dr = darkColor.r + (lightColor.r - darkColor.r) * t;
            const dg = darkColor.g + (lightColor.g - darkColor.g) * t;
            const db = darkColor.b + (lightColor.b - darkColor.b) * t;

            data[idx] = Math.round(r * (1 - duotoneMix) + dr * duotoneMix);
            data[idx + 1] = Math.round(g * (1 - duotoneMix) + dg * duotoneMix);
            data[idx + 2] = Math.round(b * (1 - duotoneMix) + db * duotoneMix);
          }

          if (transparentBg) {
            // Calcular distância cromática em relação à cor de fundo (bgColor) para preservar anti-aliasing suave
            const dr = data[idx] - bg.r;
            const dg = data[idx + 1] - bg.g;
            const db = data[idx + 2] - bg.b;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < 14) {
              data[idx + 3] = 0;
            } else if (dist < 64) {
              data[idx + 3] = Math.round(((dist - 14) / 50) * 255);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // 2. Phosphor Bloom / Neon Glow
    if (bloomAmt > 0.02) {
      if (!bloomCanvas) {
        bloomCanvas = document.createElement('canvas');
      }
      const bw = Math.max(64, Math.floor(w * 0.35));
      const bh = Math.max(64, Math.floor(h * 0.35));
      bloomCanvas.width = bw;
      bloomCanvas.height = bh;
      const bCtx = bloomCanvas.getContext('2d');
      bCtx.clearRect(0, 0, bw, bh);
      bCtx.filter = `blur(${Math.max(3, Math.round(6 * bloomAmt))}px) brightness(135%)`;
      bCtx.drawImage(outputCanvas, 0, 0, bw, bh);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(0.95, bloomAmt * 0.78);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bloomCanvas, 0, 0, w, h);
      ctx.restore();
    }

    // 3. Scanlines Globais CRT
    if (scanlinesAmt > 0.02) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${(scanlinesAmt * 0.45).toFixed(2)})`;
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1.3);
      }
      ctx.restore();
    }

    // 4. Lente CRT Curva & Vinheta
    if (vignetteAmt > 0.02 && !transparentBg) {
      ctx.save();
      const cx = w * 0.5;
      const cy = h * 0.5;
      const outerR = Math.hypot(cx, cy);
      const innerR = outerR * (0.55 - vignetteAmt * 0.22);

      const vGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      vGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vGrad.addColorStop(0.7, `rgba(0,0,0,${(vignetteAmt * 0.35).toFixed(2)})`);
      vGrad.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, vignetteAmt * 0.88).toFixed(2)})`);

      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, w, h);

      if (vignetteAmt > 0.35) {
        ctx.strokeStyle = `rgba(0,0,0,${(vignetteAmt * 0.75).toFixed(2)})`;
        ctx.lineWidth = Math.max(6, Math.min(w, h) * 0.022 * vignetteAmt);
        ctx.strokeRect(0, 0, w, h);
      }
      ctx.restore();
    }

    // 5. Máscara de Foco (Proteger Sujeito / Rosto / Produto) & Mix com Foto Original
    const focusMode = state.focusMaskMode || 'none';
    const originalMix = (state.originalMix ?? 0) / 100;

    if (sourceCanvas && (focusMode !== 'none' || originalMix > 0.01)) {
      applyFocusMaskAndMix(ctx, sourceCanvas, w, h, focusMode, (state.focusMaskRadius ?? 55) / 100, originalMix);
    }
  }

  function applyFocusMaskAndMix(ctx, sourceCanvas, w, h, focusMode, radiusNorm, originalMix) {
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas');
    }
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mCtx = maskCanvas.getContext('2d');
    mCtx.clearRect(0, 0, w, h);

    // Desenhar a foto original no maskCanvas
    mCtx.drawImage(sourceCanvas, 0, 0, w, h);

    if (focusMode !== 'none') {
      // Aplicar máscara de recorte alfa usando destination-in
      mCtx.globalCompositeOperation = 'destination-in';
      const cx = w * 0.5;
      const cy = h * 0.5;
      const maxR = Math.hypot(cx, cy);

      if (focusMode === 'center-clean') {
        // Centro mostra a foto original nítida; bordas mostram o efeito generativo
        const innerR = maxR * Math.max(0.05, radiusNorm * 0.45);
        const outerR = maxR * Math.min(1.0, radiusNorm * 0.95 + 0.12);
        const g = mCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, `rgba(0,0,0,${originalMix.toFixed(2)})`);
        mCtx.fillStyle = g;
        mCtx.fillRect(0, 0, w, h);
      } else if (focusMode === 'edges-clean') {
        // Centro tem o efeito generativo; bordas preservam a foto original
        const innerR = maxR * Math.max(0.08, radiusNorm * 0.38);
        const outerR = maxR * Math.min(1.0, radiusNorm * 0.88 + 0.1);
        const g = mCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        g.addColorStop(0, `rgba(0,0,0,${originalMix.toFixed(2)})`);
        g.addColorStop(1, 'rgba(0,0,0,1)');
        mCtx.fillStyle = g;
        mCtx.fillRect(0, 0, w, h);
      } else if (focusMode === 'vertical-fade') {
        // Degradê vertical para posts de Feed/Stories
        const splitY = h * radiusNorm;
        const feather = h * 0.25;
        const g = mCtx.createLinearGradient(0, Math.max(0, splitY - feather), 0, Math.min(h, splitY + feather));
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, `rgba(0,0,0,${originalMix.toFixed(2)})`);
        mCtx.fillStyle = g;
        mCtx.fillRect(0, 0, w, h);
      }

      mCtx.globalCompositeOperation = 'source-over';
      ctx.drawImage(maskCanvas, 0, 0);
    } else if (originalMix > 0.01) {
      ctx.save();
      ctx.globalAlpha = originalMix;
      ctx.drawImage(sourceCanvas, 0, 0, w, h);
      ctx.restore();
    }
  }

  DegenLab.renderHistogram = renderHistogram;
  DegenLab.applyGlobalPostFx = applyGlobalPostFx;
})(window);
