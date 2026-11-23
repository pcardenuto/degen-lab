(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  /**
   * 12º Motor: Plexus / Constellation & Low-Poly Mesh
   * Detecta nós baseados em luminância e gradiente de bordas, conectando vizinhos
   * em uma rede neural/constelação dinâmica, malha triangular Low-Poly ou células de Voronoi.
   * Suporta animação de partículas, reatividade a áudio e exportação SVG Vetorial.
   */
  function renderPlexus(sourceCanvas, outputCanvas, state) {
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

    const style = state.plexusStyle || 'network'; // 'network' | 'poly' | 'voronoi'
    const spacing = Math.max(8, state.cellSize * 2.2);
    const maxDist = spacing * ((state.plexusRadius ?? 165) / 100);
    const jitterAmt = (state.plexusJitter ?? 65) / 100;
    const nodeSize = state.plexusNodeSize ?? 2.4;
    const colorMode = state.plexusColorMode || 'color';

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;
    const audioBass = state.audio?.active ? state.audio.bass * state.audio.gain : 0;

    const cols = Math.max(8, Math.floor(w / spacing));
    const rows = Math.max(8, Math.floor(h / spacing));
    const cellW = w / cols;
    const cellH = h / rows;

    // 1. Gerar grade de nós com deslocamento determinístico + atração por bordas/luminância
    const nodes = new Array(cols * rows);

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        const hash1 = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
        const hash2 = Math.sin(gx * 269.5 + gy * 183.3) * 43758.5453;
        const rx = hash1 - Math.floor(hash1) - 0.5;
        const ry = hash2 - Math.floor(hash2) - 0.5;

        let px = (gx + 0.5 + rx * jitterAmt * 0.85) * cellW;
        let py = (gy + 0.5 + ry * jitterAmt * 0.85) * cellH;

        if (anim.active) {
          const phaseX = gx * 0.5 + gy * 0.3;
          const phaseY = gx * 0.3 - gy * 0.6;
          if (anim.style === 'chaos') {
            px += Math.sin(t * 12 + hash1) * cellW * 0.38 * (anim.intensity + audioBass * 0.5);
            py += Math.cos(t * 11 + hash2) * cellH * 0.38 * (anim.intensity + audioBass * 0.5);
          } else if (anim.style === 'pulse') {
            const dx = px - w * 0.5;
            const dy = py - h * 0.5;
            const dist = Math.hypot(dx, dy) + 1;
            const push = Math.sin(dist * 0.025 - t * 4.5) * cellW * 0.35 * (anim.intensity + audioBass * 0.6);
            px += (dx / dist) * push;
            py += (dy / dist) * push;
          } else {
            px += Math.sin(t * 2.4 + phaseX) * cellW * 0.34 * (anim.intensity + audioBass * 0.4);
            py += Math.cos(t * 2.1 + phaseY) * cellH * 0.34 * (anim.intensity + audioBass * 0.4);
          }
        }

        px = Math.max(0, Math.min(w - 1, px));
        py = Math.max(0, Math.min(h - 1, py));

        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const pIdx = iy * w + ix;
        const lum = processed.luma[pIdx] / 255;
        const density = isLightPaper ? 1 - lum : lum;

        const cIdx = pIdx * 4;
        const r = processed.rgba[cIdx];
        const g = processed.rgba[cIdx + 1];
        const b = processed.rgba[cIdx + 2];

        let color = state.fgColor;
        if (colorMode === 'color') {
          color = `rgb(${r},${g},${b})`;
        } else {
          const sr = Math.round(bgRgb.r + (fgRgb.r - bgRgb.r) * (0.2 + 0.8 * density));
          const sg = Math.round(bgRgb.g + (fgRgb.g - bgRgb.g) * (0.2 + 0.8 * density));
          const sb = Math.round(bgRgb.b + (fgRgb.b - bgRgb.b) * (0.2 + 0.8 * density));
          color = `rgb(${sr},${sg},${sb})`;
        }

        nodes[idx] = {
          gx,
          gy,
          x: px,
          y: py,
          density,
          r,
          g,
          b,
          color
        };
      }
    }

    const svgElements = [];

    if (style === 'poly') {
      // Malha Low-Poly Triangulada preenchida
      for (let gy = 0; gy < rows - 1; gy++) {
        for (let gx = 0; gx < cols - 1; gx++) {
          const n00 = nodes[gy * cols + gx];
          const n10 = nodes[gy * cols + (gx + 1)];
          const n01 = nodes[(gy + 1) * cols + gx];
          const n11 = nodes[(gy + 1) * cols + (gx + 1)];

          drawTriangle(ctx, svgElements, n00, n10, n11, state.bgColor, strokeColorFor(n00, state));
          drawTriangle(ctx, svgElements, n00, n11, n01, state.bgColor, strokeColorFor(n01, state));
        }
      }
    } else if (style === 'voronoi') {
      // Células Poligonais Centradas nos Nós (Voronoi / Dual Mesh)
      for (let gy = 0; gy < rows - 1; gy++) {
        for (let gx = 0; gx < cols - 1; gx++) {
          const n00 = nodes[gy * cols + gx];
          const n10 = nodes[gy * cols + (gx + 1)];
          const n11 = nodes[(gy + 1) * cols + (gx + 1)];
          const n01 = nodes[(gy + 1) * cols + xClamp(gx, cols)];

          if (n00.density <= 0.04) continue;

          // Baricentro e recuo celular orgânico
          const cx = (n00.x + n10.x + n11.x + n01.x) * 0.25;
          const cy = (n00.y + n10.y + n11.y + n01.y) * 0.25;
          const shrink = 0.25 + 0.68 * n00.density;

          const pts = [n00, n10, n11, n01].map((n) => ({
            x: cx + (n.x - cx) * shrink,
            y: cy + (n.y - cy) * shrink
          }));

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
          ctx.closePath();

          ctx.fillStyle = n00.color;
          ctx.fill();

          const polyStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          svgElements.push(`<polygon points="${polyStr}" fill="${n00.color}" />`);
        }
      }
    } else {
      // 'network': Rede Plexus de Constelação (Conexões por proximidade + Nós brilhantes)
      const effMaxDist = maxDist * (1 + audioBass * 0.35);

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const nA = nodes[gy * cols + gx];
          if (nA.density < 0.06) continue;

          // Verificar vizinhos numa janela 3x3 da grade
          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              if (dy < 0 || (dy === 0 && dx <= 0)) continue;
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

              const nB = nodes[ny * cols + nx];
              if (nB.density < 0.06) continue;

              const dist = Math.hypot(nA.x - nB.x, nA.y - nB.y);
              if (dist <= effMaxDist) {
                const alpha = (1 - dist / effMaxDist) * Math.min(1, (nA.density + nB.density) * 0.75);
                if (alpha < 0.08) continue;

                const lw = Math.max(0.5, alpha * 2.2);
                ctx.strokeStyle = nA.color;
                ctx.globalAlpha = Math.min(1, alpha * 1.2);
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.moveTo(nA.x, nA.y);
                ctx.lineTo(nB.x, nB.y);
                ctx.stroke();

                svgElements.push(
                  `<line x1="${nA.x.toFixed(1)}" y1="${nA.y.toFixed(1)}" x2="${nB.x.toFixed(1)}" y2="${nB.y.toFixed(1)}" stroke="${nA.color}" stroke-width="${lw.toFixed(2)}" stroke-opacity="${alpha.toFixed(2)}" />`
                );
              }
            }
          }
        }
      }

      ctx.globalAlpha = 1.0;

      // Desenhar Nós (Vértices da Constelação)
      if (nodeSize > 0.1) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.density < 0.08) continue;
          const r = Math.max(0.5, n.density * nodeSize * (1 + audioBass * 0.4));
          ctx.fillStyle = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();

          svgElements.push(
            `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(2)}" fill="${n.color}" />`
          );
        }
      }
    }

    return {
      width: w,
      height: h,
      cols,
      rows,
      bgColor: state.bgColor,
      svgElements
    };
  }

  function xClamp(x, cols) {
    return Math.max(0, Math.min(cols - 1, x));
  }

  function strokeColorFor(node, state) {
    return state.plexusColorMode === 'mono' ? state.bgColor : 'rgba(10,12,16,0.35)';
  }

  function drawTriangle(ctx, svgElements, a, b, c, bgColor, strokeColor) {
    if (a.density < 0.03 && b.density < 0.03 && c.density < 0.03) return;
    const r = Math.round((a.r + b.r + c.r) / 3);
    const g = Math.round((a.g + b.g + c.g) / 3);
    const bl = Math.round((a.b + b.b + c.b) / 3);
    const fill = a.color.startsWith('rgb') ? `rgb(${r},${g},${bl})` : a.color;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    const pts = `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    svgElements.push(
      `<polygon points="${pts}" fill="${fill}" stroke="${strokeColor}" stroke-width="0.6" />`
    );
  }

  function buildPlexusSvg(plexusData) {
    const { width, height, bgColor, svgElements } = plexusData;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g stroke-linecap="round" stroke-linejoin="round">
    ${svgElements.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.renderPlexus = renderPlexus;
  DegenLab.buildPlexusSvg = buildPlexusSvg;
})(window);
