(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  /**
   * Motor Decimate (Multi-Pass Recursive Subdivision & Bitwise Geometric Glitch)
   * Realiza subdivisão recursiva multi-escala (Quadtree) guiada por variância de luminância
   * combinada com dobramento espacial bitwise (XOR) e quantização multi-passo.
   */
  function renderDecimate(sourceCanvas, outputCanvas, state) {
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

    const minCell = Math.max(3, state.cellSize);
    const maxDepth = state.decimatePasses ?? 5; // 2 a 7 passos recursivos
    const detailThresh = Math.max(4, 58 - (state.decimateDetail ?? 65) * 0.52);
    const warpAmount = (state.decimateWarp ?? 40) / 100;
    const patternStyle = state.decimateStyle || 'complex'; // 'complex' | 'quadtree' | 'xor'
    const colorMode = state.decimateColorMode || 'mono';

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;

    let seed = 4096 + Math.floor(t * 12) * 89;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const cells = [];

    // Subdivisão recursiva multi-passo
    function subdivide(x, y, bw, bh, depth) {
      if (bw <= minCell || bh <= minCell || depth >= maxDepth) {
        cells.push({ x, y, bw, bh, depth });
        return;
      }

      // Amostrar média e desvio de luminância na região
      const stats = sampleRegionStats(processed.luma, w, h, x, y, bw, bh);

      // Modulação animada do limiar de subdivisão (ondas de decimação varrendo a tela)
      let localThresh = detailThresh;
      if (anim.active) {
        const cx = x + bw * 0.5;
        const cy = y + bh * 0.5;
        if (anim.style === 'pulse') {
          const dist = Math.hypot(cx - w * 0.5, cy - h * 0.5);
          const wave = Math.sin(dist * 0.025 - t * 4.5);
          localThresh *= 1 - wave * 0.55 * anim.intensity;
        } else if (anim.style === 'flow') {
          const wave = Math.sin(cx * 0.018 + cy * 0.018 - t * 3.8);
          localThresh *= 1 - wave * 0.5 * anim.intensity;
        } else if (anim.style === 'chaos') {
          localThresh *= 0.4 + rand() * 1.2;
        }
      }

      if (stats.stdDev > localThresh || depth < 2) {
        const hw = bw * 0.5;
        const hh = bh * 0.5;

        // Em multi-pass glitch, deslocar sutilmente o pivô de corte
        let splitX = hw;
        let splitY = hh;
        if (warpAmount > 0.05 && depth >= 2) {
          const jx = Math.sin((x * 0.07 + y * 0.11) + (anim.active ? t * 3.0 : 0)) * warpAmount * 0.28;
          const jy = Math.cos((x * 0.11 - y * 0.07) - (anim.active ? t * 2.5 : 0)) * warpAmount * 0.28;
          splitX = Math.max(minCell, Math.min(bw - minCell, hw * (1 + jx)));
          splitY = Math.max(minCell, Math.min(bh - minCell, hh * (1 + jy)));
        }

        subdivide(x, y, splitX, splitY, depth + 1);
        subdivide(x + splitX, y, bw - splitX, splitY, depth + 1);
        subdivide(x, y + splitY, splitX, bh - splitY, depth + 1);
        subdivide(x + splitX, y + splitY, bw - splitX, bh - splitY, depth + 1);
      } else {
        cells.push({ x, y, bw, bh, depth });
      }
    }

    // Iniciar grade raiz em blocos proporcionais
    const rootCols = 4;
    const rootRows = 3;
    const rootW = w / rootCols;
    const rootH = h / rootRows;

    for (let ry = 0; ry < rootRows; ry++) {
      for (let rx = 0; rx < rootCols; rx++) {
        subdivide(rx * rootW, ry * rootH, rootW, rootH, 0);
      }
    }

    const svgItems = [];

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      // Passo 2: Dobramento espacial (Multi-Pass Glitch Shift)
      let sx = Math.floor(c.x + c.bw * 0.5);
      let sy = Math.floor(c.y + c.bh * 0.5);

      if (warpAmount > 0) {
        const hash = ((Math.floor(c.x) * 73) ^ (Math.floor(c.y) * 151)) & 255;
        if (hash < warpAmount * 140) {
          const shiftMult = (anim.active && anim.style === 'chaos') ? 2.2 : 1.0;
          sx = (sx + Math.floor(Math.sin(hash + t * 5) * 45 * warpAmount * shiftMult) + w) % w;
          sy = (sy + Math.floor(Math.cos(hash - t * 4) * 35 * warpAmount * shiftMult) + h) % h;
        }
      }

      sx = Math.max(0, Math.min(w - 1, sx));
      sy = Math.max(0, Math.min(h - 1, sy));
      const pIdx = sy * w + sx;
      const lum = processed.luma[pIdx] / 255;
      const density = isLightPaper ? 1 - lum : lum;

      let fillColor = state.fgColor;
      if (colorMode === 'color') {
        const cIdx = pIdx * 4;
        // Quantização cromática (Bitcrush de 3 bits por canal para estética digital)
        const qr = processed.rgba[cIdx] & 0xe0;
        const qg = processed.rgba[cIdx + 1] & 0xe0;
        const qb = processed.rgba[cIdx + 2] & 0xe0;
        fillColor = `rgb(${qr},${qg},${qb})`;
      } else {
        // Intercalar intensidade entre fundo e traço
        const qDensity = Math.round(density * 5) / 5;
        const r = Math.round(bgRgb.r + (fgRgb.r - bgRgb.r) * qDensity);
        const g = Math.round(bgRgb.g + (fgRgb.g - bgRgb.g) * qDensity);
        const b = Math.round(bgRgb.b + (fgRgb.b - bgRgb.b) * qDensity);
        fillColor = `rgb(${r},${g},${b})`;
      }

      const rx = c.x;
      const ry = c.y;
      const rw = c.bw;
      const rh = c.bh;

      if (patternStyle === 'quadtree') {
        // Blocos arquitetônicos Quadtree com borda técnica
        ctx.fillStyle = fillColor;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = state.bgColor;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(rx, ry, rw, rh);

        svgItems.push(
          `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${fillColor}" stroke="${state.bgColor}" stroke-width="0.8" />`
        );
      } else if (patternStyle === 'xor') {
        // Síntese Bitwise XOR / Geometria Fractal Modular
        const bx = Math.floor(rx / minCell);
        const by = Math.floor(ry / minCell);
        const phase = anim.active ? Math.floor(t * 10) : 0;
        const xorVal = ((bx ^ by) + phase) % 7;

        if (density > 0.08) {
          ctx.fillStyle = fillColor;
          const pad = (xorVal % 3) * 0.8;
          ctx.fillRect(rx + pad, ry + pad, Math.max(1, rw - pad * 2), Math.max(1, rh - pad * 2));

          if (xorVal < 3 && rw > 8 && rh > 8) {
            ctx.fillStyle = state.bgColor;
            ctx.fillRect(rx + rw * 0.25, ry + rh * 0.25, rw * 0.5, rh * 0.5);
          }

          svgItems.push(
            `<rect x="${(rx + pad).toFixed(1)}" y="${(ry + pad).toFixed(1)}" width="${Math.max(1, rw - pad * 2).toFixed(1)}" height="${Math.max(1, rh - pad * 2).toFixed(1)}" fill="${fillColor}" />`
          );
        }
      } else {
        // 'complex': Formas Geométricas Complexas Multi-Passo (Retângulos aninhados, diagonais, cruzes e círculos)
        if (density <= 0.05) continue;

        const shapeSelector = (c.depth + Math.floor(rx * 0.1 + ry * 0.1)) % 4;
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = Math.max(1, Math.min(rw, rh) * 0.12);

        if (shapeSelector === 0 || rw < 7 || rh < 7) {
          // Bloco sólido com recorte interno proporcional
          ctx.fillRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
          svgItems.push(
            `<rect x="${(rx + 0.5).toFixed(1)}" y="${(ry + 0.5).toFixed(1)}" width="${(rw - 1).toFixed(1)}" height="${(rh - 1).toFixed(1)}" fill="${fillColor}" />`
          );

          if (rw > 12 && rh > 12 && density < 0.72) {
            ctx.fillStyle = state.bgColor;
            ctx.fillRect(rx + rw * 0.28, ry + rh * 0.28, rw * 0.44, rh * 0.44);
            svgItems.push(
              `<rect x="${(rx + rw * 0.28).toFixed(1)}" y="${(ry + rh * 0.28).toFixed(1)}" width="${(rw * 0.44).toFixed(1)}" height="${(rh * 0.44).toFixed(1)}" fill="${state.bgColor}" />`
            );
          }
        } else if (shapeSelector === 1) {
          // Triângulo Diagonal Bauhaus / Glitch
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + rw, ry);
          ctx.lineTo(rx, ry + rh);
          ctx.closePath();
          ctx.fill();

          svgItems.push(
            `<polygon points="${rx.toFixed(1)},${ry.toFixed(1)} ${(rx + rw).toFixed(1)},${ry.toFixed(1)} ${rx.toFixed(1)},${(ry + rh).toFixed(1)}" fill="${fillColor}" />`
          );
        } else if (shapeSelector === 2) {
          // Anel / Nó Circular Concêntrico dentro da célula
          const cx = rx + rw * 0.5;
          const cy = ry + rh * 0.5;
          const rad = Math.min(rw, rh) * 0.42 * (0.4 + 0.6 * density);
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();

          svgItems.push(
            `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${fillColor}" />`
          );
        } else {
          // Moldura + Barra Diagonal Técnica
          ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
          ctx.beginPath();
          ctx.moveTo(rx + 1, ry + 1);
          ctx.lineTo(rx + rw - 1, ry + rh - 1);
          ctx.stroke();

          svgItems.push(
            `<rect x="${(rx + 1).toFixed(1)}" y="${(ry + 1).toFixed(1)}" width="${(rw - 2).toFixed(1)}" height="${(rh - 2).toFixed(1)}" fill="none" stroke="${fillColor}" stroke-width="${ctx.lineWidth.toFixed(1)}" />`
          );
        }
      }
    }

    return {
      width: w,
      height: h,
      cols: cells.length,
      rows: maxDepth,
      bgColor: state.bgColor,
      svgItems
    };
  }

  function sampleRegionStats(luma, w, h, x, y, bw, bh) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(w - 1, Math.floor(x + bw));
    const y1 = Math.min(h - 1, Math.floor(y + bh));

    const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
    const stepY = Math.max(1, Math.floor((y1 - y0) / 5));

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let py = y0; py <= y1; py += stepY) {
      for (let px = x0; px <= x1; px += stepX) {
        const v = luma[py * w + px];
        sum += v;
        sumSq += v * v;
        count++;
      }
    }

    if (count === 0) return { mean: 0, stdDev: 0 };
    const mean = sum / count;
    const variance = Math.max(0, sumSq / count - mean * mean);
    return {
      mean,
      stdDev: Math.sqrt(variance)
    };
  }

  function buildDecimateSvg(decimateData) {
    const { width, height, bgColor, svgItems } = decimateData;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g>
    ${svgItems.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.renderDecimate = renderDecimate;
  DegenLab.buildDecimateSvg = buildDecimateSvg;
})(window);
