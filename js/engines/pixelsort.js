(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage } = DegenLab;

  /**
   * Motor de Pixel Sorting (Estilo Kim Asendorf)
   * Identifica intervalos contínuos de pixels dentro da faixa [sortMin, sortMax]
   * e ordena cada intervalo por Luminância, Matiz (Hue) ou Saturação.
   */
  function renderPixelSort(sourceCanvas, outputCanvas, state) {
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

    const rgba = new Uint8ClampedArray(processed.rgba);
    const luma = processed.luma;

    const direction = state.sortDirection || 'vertical'; // 'vertical' | 'horizontal' | 'both'
    const metricType = state.sortMetric || 'luma';       // 'luma' | 'hue' | 'saturation'
    const minThresh = Math.min(state.sortMin ?? 45, state.sortMax ?? 210);
    const maxThresh = Math.max(state.sortMin ?? 45, state.sortMax ?? 210);
    const baseSpanPct = (state.sortSpan ?? 65) / 100;
    const reverse = Boolean(state.sortReverse);

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;

    // Pré-calcular métrica de ordenação para cada pixel
    const metrics = new Float32Array(w * h);
    for (let p = 0, i = 0; p < metrics.length; p++, i += 4) {
      if (metricType === 'luma') {
        metrics[p] = luma[p];
      } else {
        const r = rgba[i] / 255;
        const g = rgba[i + 1] / 255;
        const b = rgba[i + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        if (metricType === 'saturation') {
          metrics[p] = max === 0 ? 0 : (d / max) * 255;
        } else {
          // Hue
          let hue = 0;
          if (d !== 0) {
            if (max === r) hue = ((g - b) / d) % 6;
            else if (max === g) hue = (b - r) / d + 2;
            else hue = (r - g) / d + 4;
          }
          metrics[p] = ((hue * 60 + 360) % 360);
        }
      }
    }

    const sortLine = (indices, lineCoord) => {
      const len = indices.length;
      // Modulação animada do comprimento máximo do "derretimento" (drip span)
      let spanMult = baseSpanPct;
      if (anim.active) {
        if (anim.style === 'chaos') {
          const wave = Math.sin(lineCoord * 0.35 + t * 11.0) * Math.cos(lineCoord * 0.13 - t * 7.0);
          spanMult = Math.max(0.03, baseSpanPct * (0.35 + 0.65 * Math.abs(wave) * (0.5 + anim.intensity)));
        } else {
          // Onda líquida contínua que faz os pixels escorrerem e recuarem em loop
          const wave = 0.5 + 0.5 * Math.sin(t * 3.2 + lineCoord * 0.06);
          const ripple = 0.5 + 0.5 * Math.cos(t * 2.1 - lineCoord * 0.14);
          spanMult = Math.max(0.02, baseSpanPct * (1 - anim.intensity * 0.8 + anim.intensity * (wave * 0.7 + ripple * 0.3)));
        }
      }

      const maxSpanLen = Math.max(2, Math.floor(len * spanMult));
      let i = 0;

      while (i < len) {
        // Avançar até encontrar um pixel dentro da faixa de limiar
        while (i < len) {
          const lv = luma[indices[i]];
          if (lv >= minThresh && lv <= maxThresh) break;
          i++;
        }
        if (i >= len) break;

        const start = i;
        while (i < len && i - start < maxSpanLen) {
          const lv = luma[indices[i]];
          if (lv < minThresh || lv > maxThresh) break;
          i++;
        }
        const end = i; // exclusivo
        const spanCount = end - start;

        if (spanCount > 1) {
          // Extrair pixels do intervalo
          const spanPixels = new Array(spanCount);
          for (let k = 0; k < spanCount; k++) {
            const pIdx = indices[start + k];
            const cIdx = pIdx * 4;
            spanPixels[k] = {
              m: metrics[pIdx],
              l: luma[pIdx],
              r: rgba[cIdx],
              g: rgba[cIdx + 1],
              b: rgba[cIdx + 2]
            };
          }

          spanPixels.sort((a, b) => (reverse ? b.m - a.m : a.m - b.m));

          // Gravar pixels ordenados de volta
          for (let k = 0; k < spanCount; k++) {
            const pIdx = indices[start + k];
            const cIdx = pIdx * 4;
            const px = spanPixels[k];
            rgba[cIdx] = px.r;
            rgba[cIdx + 1] = px.g;
            rgba[cIdx + 2] = px.b;
            luma[pIdx] = px.l;
            metrics[pIdx] = px.m;
          }
        }
      }
    };

    if (direction === 'vertical' || direction === 'both') {
      const colIndices = new Int32Array(h);
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          colIndices[y] = y * w + x;
        }
        sortLine(colIndices, x);
      }
    }

    if (direction === 'horizontal' || direction === 'both') {
      const rowIndices = new Int32Array(w);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          rowIndices[x] = y * w + x;
        }
        sortLine(rowIndices, y);
      }
    }

    const outW = w * pixelScale;
    const outH = h * pixelScale;
    outputCanvas.width = outW;
    outputCanvas.height = outH;

    const ctx = outputCanvas.getContext('2d');
    if (pixelScale === 1) {
      ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    } else {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      temp.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, 0, 0, outW, outH);
    }

    return {
      cols: w,
      rows: h,
      pixelScale
    };
  }

  DegenLab.renderPixelSort = renderPixelSort;
})(window);
