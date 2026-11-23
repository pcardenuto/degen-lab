(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage, hexToRgb } = DegenLab;

  /**
   * Motor Luma Mesh 3D (3D Luminance Depth Distortion Light Grid)
   * Projeta a imagem em uma malha 3D onde a luminância controla a extrusão no eixo Z,
   * com câmera em perspectiva (Pitch, Yaw, FOV), iluminação por profundidade e exportação SVG.
   */
  function renderLumaMesh(sourceCanvas, outputCanvas, state) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const step = Math.max(5, state.cellSize);
    const cols = Math.max(12, Math.floor(w / step));
    const rows = Math.max(12, Math.floor(h / step));

    const processed = preprocessImage(sourceCanvas, cols, rows, {
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

    const topology = state.meshTopology || 'grid'; // 'grid' | 'triangles' | 'dots' | 'facets'
    const depthExtrude = (state.meshDepth ?? 110);
    let pitchDeg = state.meshPitch ?? 38;
    let yawDeg = state.meshYaw ?? -18;
    const colorMode = state.meshColorMode || 'color';
    const strokeW = state.meshStroke ?? 1.2;

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;

    if (anim.active) {
      if (anim.style === 'flow') {
        yawDeg += Math.sin(t * 1.6) * 22 * anim.intensity;
        pitchDeg += Math.cos(t * 1.2) * 12 * anim.intensity;
      } else if (anim.style === 'chaos') {
        yawDeg += Math.sin(t * 11) * 8 * anim.intensity;
      }
    }

    const pitch = (pitchDeg * Math.PI) / 180;
    const yaw = (yawDeg * Math.PI) / 180;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const fov = Math.max(w, h) * 1.15;
    const cameraDist = Math.max(w, h) * 0.95;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const spanW = w * 0.78;
    const spanH = h * 0.78;

    // 1. Construir e projetar vértices 3D
    const vertices = new Array(cols * rows);

    for (let y = 0; y < rows; y++) {
      const ny = y / (rows - 1) - 0.5; // -0.5 a +0.5
      for (let x = 0; x < cols; x++) {
        const nx = x / (cols - 1) - 0.5;
        const idx = y * cols + x;

        const lum = processed.luma[idx] / 255;
        let heightVal = isLightPaper ? 1 - lum : lum;

        if (anim.active) {
          if (anim.style === 'pulse') {
            const dist = Math.hypot(nx, ny);
            const ripple = Math.sin(dist * 14 - t * 5.5) * 0.35 * anim.intensity;
            heightVal = Math.max(0, Math.min(1.4, heightVal + ripple * (0.3 + heightVal)));
          } else if (anim.style === 'flow') {
            const wave = Math.sin(nx * 8 + ny * 6 - t * 4.2) * 0.22 * anim.intensity;
            heightVal = Math.max(0, Math.min(1.3, heightVal + wave));
          } else if (anim.style === 'chaos') {
            const spike = Math.sin(x * 13.7 + y * 29.3 + Math.floor(t * 15) * 5.1);
            if (spike > 0.75) {
              heightVal += spike * 0.65 * anim.intensity;
            }
          }
        }

        const vx = nx * spanW;
        const vy = ny * spanH;
        const vz = -(heightVal - 0.3) * depthExtrude * 1.8;

        // Rotação Yaw (em torno de Y)
        const x1 = vx * cosY - vz * sinY;
        const z1 = vx * sinY + vz * cosY;
        const y1 = vy;

        // Rotação Pitch (em torno de X)
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;
        const x2 = x1;

        const zCam = z2 + cameraDist;
        const scale = fov / Math.max(60, zCam);

        const px = cx + x2 * scale;
        const py = cy + y2 * scale;

        const cIdx = idx * 4;
        const r = processed.rgba[cIdx];
        const g = processed.rgba[cIdx + 1];
        const b = processed.rgba[cIdx + 2];

        let colorStr = state.fgColor;
        if (colorMode === 'color') {
          colorStr = `rgb(${r},${g},${b})`;
        } else {
          // Sombrear cor da paleta pela elevação Z para dar profundidade 3D
          const shade = 0.25 + 0.75 * Math.min(1, heightVal * 1.15);
          const sr = Math.round(bgRgb.r + (fgRgb.r - bgRgb.r) * shade);
          const sg = Math.round(bgRgb.g + (fgRgb.g - bgRgb.g) * shade);
          const sb = Math.round(bgRgb.b + (fgRgb.b - bgRgb.b) * shade);
          colorStr = `rgb(${sr},${sg},${sb})`;
        }

        vertices[idx] = {
          px,
          py,
          zCam,
          scale,
          heightVal,
          color: colorStr
        };
      }
    }

    const svgElements = [];
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (topology === 'dots') {
      // Nuvem de Pontos de Luz 3D
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (v.heightVal <= 0.03) continue;
        const radius = Math.max(0.6, (0.6 + v.heightVal * 2.6) * strokeW * (v.scale * 0.85));
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.arc(v.px, v.py, radius, 0, Math.PI * 2);
        ctx.fill();

        svgElements.push(
          `<circle cx="${v.px.toFixed(1)}" cy="${v.py.toFixed(1)}" r="${radius.toFixed(2)}" fill="${v.color}" />`
        );
      }
    } else if (topology === 'facets') {
      // Quads 3D preenchidos com ordenação por profundidade (Painter's Algorithm)
      const quads = [];
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const v00 = vertices[y * cols + x];
          const v10 = vertices[y * cols + (x + 1)];
          const v11 = vertices[(y + 1) * cols + (x + 1)];
          const v01 = vertices[(y + 1) * cols + x];
          const avgZ = (v00.zCam + v10.zCam + v11.zCam + v01.zCam) * 0.25;
          quads.push({ v00, v10, v11, v01, avgZ });
        }
      }

      quads.sort((a, b) => b.avgZ - a.avgZ);

      for (const q of quads) {
        const { v00, v10, v11, v01 } = q;
        ctx.beginPath();
        ctx.moveTo(v00.px, v00.py);
        ctx.lineTo(v10.px, v10.py);
        ctx.lineTo(v11.px, v11.py);
        ctx.lineTo(v01.px, v01.py);
        ctx.closePath();

        ctx.fillStyle = state.bgColor;
        ctx.fill();
        ctx.strokeStyle = v00.color;
        ctx.stroke();

        const pts = `${v00.px.toFixed(1)},${v00.py.toFixed(1)} ${v10.px.toFixed(1)},${v10.py.toFixed(1)} ${v11.px.toFixed(1)},${v11.py.toFixed(1)} ${v01.px.toFixed(1)},${v01.py.toFixed(1)}`;
        svgElements.push(
          `<polygon points="${pts}" fill="${state.bgColor}" stroke="${v00.color}" stroke-width="${strokeW}" />`
        );
      }
    } else {
      // Malha Wireframe de Luz ('grid' ou 'triangles')
      // Linhas Horizontais
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const vA = vertices[y * cols + x];
          const vB = vertices[y * cols + (x + 1)];
          if (vA.heightVal < 0.02 && vB.heightVal < 0.02) continue;

          ctx.strokeStyle = vA.color;
          ctx.beginPath();
          ctx.moveTo(vA.px, vA.py);
          ctx.lineTo(vB.px, vB.py);
          ctx.stroke();

          svgElements.push(
            `<line x1="${vA.px.toFixed(1)}" y1="${vA.py.toFixed(1)}" x2="${vB.px.toFixed(1)}" y2="${vB.py.toFixed(1)}" stroke="${vA.color}" stroke-width="${strokeW}" />`
          );
        }
      }

      // Linhas Verticais (+ Diagonais se 'triangles')
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows - 1; y++) {
          const vA = vertices[y * cols + x];
          const vB = vertices[(y + 1) * cols + x];
          if (vA.heightVal >= 0.02 || vB.heightVal >= 0.02) {
            ctx.strokeStyle = vA.color;
            ctx.beginPath();
            ctx.moveTo(vA.px, vA.py);
            ctx.lineTo(vB.px, vB.py);
            ctx.stroke();

            svgElements.push(
              `<line x1="${vA.px.toFixed(1)}" y1="${vA.py.toFixed(1)}" x2="${vB.px.toFixed(1)}" y2="${vB.py.toFixed(1)}" stroke="${vA.color}" stroke-width="${strokeW}" />`
            );
          }

          if (topology === 'triangles' && x < cols - 1) {
            const vDiag = vertices[(y + 1) * cols + (x + 1)];
            if (vA.heightVal >= 0.04 || vDiag.heightVal >= 0.04) {
              ctx.strokeStyle = vA.color;
              ctx.beginPath();
              ctx.moveTo(vA.px, vA.py);
              ctx.lineTo(vDiag.px, vDiag.py);
              ctx.stroke();

              svgElements.push(
                `<line x1="${vA.px.toFixed(1)}" y1="${vA.py.toFixed(1)}" x2="${vDiag.px.toFixed(1)}" y2="${vDiag.py.toFixed(1)}" stroke="${vA.color}" stroke-width="${strokeW * 0.8}" />`
              );
            }
          }
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

  function buildLumaMeshSvg(meshData) {
    const { width, height, bgColor, svgElements } = meshData;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <g stroke-linecap="round" stroke-linejoin="round">
    ${svgElements.join('\n    ')}
  </g>
</svg>`;
  }

  DegenLab.renderLumaMesh = renderLumaMesh;
  DegenLab.buildLumaMeshSvg = buildLumaMeshSvg;
})(window);
