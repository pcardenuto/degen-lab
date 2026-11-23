(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  function renderHalftone(sourceCanvas, outputCanvas, state) {
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

    const cellSize = Math.max(4, state.cellSize);
    const shape = state.halftoneShape || 'circle';
    let baseAngle = state.halftoneAngle ?? 22;
    const dotScale = state.halftoneScale ?? 1.15;

    const anim = state.anim || { active: false, time: 0, style: 'pulse', intensity: 0.6 };
    const t = anim.time;

    // No estilo "flow", rotacionamos a grade continuamente criando efeito Moiré
    if (anim.active && anim.style === 'flow') {
      baseAngle = (baseAngle + t * 18 * anim.intensity) % 360;
    }

    const fgRgb = hexToRgb(state.fgColor);
    const bgRgb = hexToRgb(state.bgColor);
    const fgLum = 0.2126 * fgRgb.r + 0.7152 * fgRgb.g + 0.0722 * fgRgb.b;
    const bgLum = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
    const isLightPaper = bgLum > fgLum;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const svgItems = [];

    const modulateVal = (val, px, py, chIndex = 0) => {
      if (!anim.active || val <= 0.01) return val;
      if (anim.style === 'pulse') {
        const dist = Math.hypot(px - cx, py - cy);
        const wave = Math.sin(dist * 0.03 - t * 5.0 + chIndex * 0.6);
        return Math.max(0, Math.min(1, val * (1 + wave * 0.45 * anim.intensity)));
      } else if (anim.style === 'chaos') {
        const jitter = Math.sin(py * 0.15 + Math.floor(t * 15) * 3.7 + chIndex * 2.1);
        return Math.max(0, Math.min(1, val * (1 + jitter * 0.4 * anim.intensity)));
      }
      return val;
    };

    if (shape === 'cmyk') {
      const paperColor = isLightPaper ? state.bgColor : '#f6f2e9';
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';

      const channels = [
        { name: 'C', color: '#00a6e2', angle: baseAngle + 15, dir: 1 },
        { name: 'M', color: '#e6007e', angle: baseAngle + 75, dir: -1 },
        { name: 'Y', color: '#ffed00', angle: baseAngle + 0, dir: 0.6 },
        { name: 'K', color: '#1a1918', angle: baseAngle + 45, dir: -0.4 }
      ];

      channels.forEach((ch, idx) => {
        ctx.fillStyle = ch.color;
        const chAngle =
          anim.active && anim.style === 'flow'
            ? (state.halftoneAngle ?? 22) + [15, 75, 0, 45][idx] + t * 22 * anim.intensity * ch.dir
            : ch.angle;

        // Desalinhamento de chapas de impressão no modo chaos/pulse
        let offsetX = 0;
        let offsetY = 0;
        if (anim.active && anim.style === 'chaos') {
          offsetX = Math.sin(t * 24 + idx * 2.3) * 6 * anim.intensity;
          offsetY = Math.cos(t * 21 + idx * 1.7) * 5 * anim.intensity;
        }

        const dots = collectRotatedGrid(w, h, cellSize, chAngle, (ix, iy) => {
          const pIdx = (iy * w + ix) * 4;
          const r = processed.rgba[pIdx] / 255;
          const g = processed.rgba[pIdx + 1] / 255;
          const b = processed.rgba[pIdx + 2] / 255;

          const k = 1 - Math.max(r, g, b);
          if (ch.name === 'K') return k * 0.9;
          if (k >= 0.98) return 0;
          const c = (1 - r - k) / (1 - k);
          const m = (1 - g - k) / (1 - k);
          const y = (1 - b - k) / (1 - k);
          if (ch.name === 'C') return c;
          if (ch.name === 'M') return m;
          return y;
        });

        for (const d of dots) {
          const modVal = modulateVal(d.val, d.x, d.y, idx);
          const radius = Math.sqrt(modVal) * (cellSize * 0.5) * dotScale;
          if (radius < 0.4) continue;
          const dx = d.x + offsetX;
          const dy = d.y + offsetY;
          ctx.beginPath();
          ctx.arc(dx, dy, radius, 0, Math.PI * 2);
          ctx.fill();

          svgItems.push(
            `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${radius.toFixed(2)}" fill="${ch.color}" fill-opacity="0.78" />`
          );
        }
      });

      ctx.restore();

      return {
        width: w,
        height: h,
        cols: Math.round(w / cellSize),
        rows: Math.round(h / cellSize),
        bgColor: paperColor,
        svgItems
      };
    }

    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = state.fgColor;
    ctx.strokeStyle = state.fgColor;

    const radAngle = (baseAngle * Math.PI) / 180;
    const dots = collectRotatedGrid(w, h, cellSize, baseAngle, (ix, iy) => {
      const lum = processed.luma[iy * w + ix] / 255;
      return isLightPaper ? 1 - lum : lum;
    });

    for (const d of dots) {
      const val = modulateVal(d.val, d.x, d.y, 0);
      if (val <= 0.015) continue;

      if (shape === 'circle') {
        const r = Math.sqrt(val) * (cellSize * 0.5) * dotScale;
        if (r < 0.35) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();

        svgItems.push(
          `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${r.toFixed(2)}" />`
        );
      } else if (shape === 'line') {
        const len = cellSize * 1.05;
        const thick = Math.max(0.5, val * cellSize * 0.85 * dotScale);
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(radAngle);
        ctx.fillRect(-len * 0.5, -thick * 0.5, len, thick);
        ctx.restore();

        svgItems.push(
          `<rect x="${(-len * 0.5).toFixed(2)}" y="${(-thick * 0.5).toFixed(2)}" width="${len.toFixed(2)}" height="${thick.toFixed(2)}" transform="translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${baseAngle.toFixed(1)})" />`
        );
      } else if (shape === 'diamond' || shape === 'square') {
        const side = Math.sqrt(val) * cellSize * 0.88 * dotScale;
        if (side < 0.5) continue;
        const rot = shape === 'diamond' ? radAngle + Math.PI / 4 : radAngle;
        const deg = shape === 'diamond' ? baseAngle + 45 : baseAngle;

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(rot);
        ctx.fillRect(-side * 0.5, -side * 0.5, side, side);
        ctx.restore();

        svgItems.push(
          `<rect x="${(-side * 0.5).toFixed(2)}" y="${(-side * 0.5).toFixed(2)}" width="${side.toFixed(2)}" height="${side.toFixed(2)}" transform="translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${deg.toFixed(1)})" />`
        );
      } else if (shape === 'cross') {
        const arm = Math.min(cellSize * 1.15, (0.3 + val * 0.85) * cellSize * dotScale);
        const thick = Math.max(0.7, val * cellSize * 0.42 * dotScale);

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(radAngle);
        ctx.fillRect(-arm * 0.5, -thick * 0.5, arm, thick);
        ctx.fillRect(-thick * 0.5, -arm * 0.5, thick, arm);
        ctx.restore();

        svgItems.push(
          `<g transform="translate(${d.x.toFixed(1)},${d.y.toFixed(1)}) rotate(${baseAngle.toFixed(1)})"><rect x="${(-arm * 0.5).toFixed(2)}" y="${(-thick * 0.5).toFixed(2)}" width="${arm.toFixed(2)}" height="${thick.toFixed(2)}" /><rect x="${(-thick * 0.5).toFixed(2)}" y="${(-arm * 0.5).toFixed(2)}" width="${thick.toFixed(2)}" height="${arm.toFixed(2)}" /></g>`
        );
      }
    }

    return {
      width: w,
      height: h,
      cols: Math.round(w / cellSize),
      rows: Math.round(h / cellSize),
      bgColor: state.bgColor,
      fgColor: state.fgColor,
      svgItems
    };
  }

  function collectRotatedGrid(w, h, step, angleDeg, sampleFn) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const diag = Math.hypot(w, h) * 0.5 + step;

    const points = [];
    for (let v = -diag; v <= diag; v += step) {
      for (let u = -diag; u <= diag; u += step) {
        const px = cx + u * cos - v * sin;
        const py = cy + u * sin + v * cos;

        if (px < -step * 0.5 || px > w + step * 0.5 || py < -step * 0.5 || py > h + step * 0.5) {
          continue;
        }

        const ix = Math.max(0, Math.min(w - 1, Math.floor(px)));
        const iy = Math.max(0, Math.min(h - 1, Math.floor(py)));
        const val = Math.max(0, Math.min(1, sampleFn(ix, iy)));

        points.push({ x: px, y: py, val });
      }
    }
    return points;
  }

  function buildHalftoneSvg(halftoneData) {
    const { width, height, bgColor, fgColor, svgItems } = halftoneData;
    const fillAttr = fgColor ? ` fill="${fgColor}"` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g${fillAttr}>
    ${svgItems.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.renderHalftone = renderHalftone;
  DegenLab.buildHalftoneSvg = buildHalftoneSvg;
})(window);
