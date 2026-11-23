/**
 * Módulo de Pré-processamento de Imagem & Gerador de Amostras
 * Realiza ajuste de brilho, contraste, gamma, nitidez (convolution 3x3) e extração de luminância.
 */
(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  /**
   * Aplica pipeline de ajustes (Brilho, Contraste, Gamma, Nitidez e Inversão)
   * e retorna os buffers RGBA e Luminância (0..255) na resolução solicitada.
   */
  function preprocessImage(sourceCanvas, width, height, settings) {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx = off.getContext('2d', { willReadFrequently: true });

    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;

    const {
      contrast = 0,     // -100 a +100
      brightness = 0,   // -100 a +100
      gamma = 1.0,      // 0.3 a 2.5
      sharpen = 0,      // 0 a 100 (%)
      invert = false
    } = settings;

    // 1. Pré-computar Look-Up Table (LUT) para Brilho + Contraste + Gamma + Inversão
    const lut = new Uint8ClampedArray(256);
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightnessOffset = (brightness / 100) * 128;
    const invGamma = 1 / Math.max(0.1, gamma);

    for (let i = 0; i < 256; i++) {
      let v = i + brightnessOffset;
      v = contrastFactor * (v - 128) + 128;
      v = Math.max(0, Math.min(255, v));
      v = 255 * Math.pow(v / 255, invGamma);
      if (invert) {
        v = 255 - v;
      }
      lut[i] = Math.round(v);
    }

    const outRgba = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      outRgba[i] = lut[src[i]];
      outRgba[i + 1] = lut[src[i + 1]];
      outRgba[i + 2] = lut[src[i + 2]];
      outRgba[i + 3] = src[i + 3];
    }

    // 2. Filtro de Nitidez (Sharpen 3x3) opcional
    let finalRgba = outRgba;
    if (sharpen > 0) {
      const amount = (sharpen / 100) * 1.2;
      finalRgba = applySharpen(outRgba, width, height, amount);
    }

    // 3. Extrair Mapa de Luminância Perceptual (Rec. 709)
    const luma = new Float32Array(width * height);
    for (let p = 0, i = 0; p < luma.length; p++, i += 4) {
      const alpha = finalRgba[i + 3] / 255;
      const lum = 0.2126 * finalRgba[i] + 0.7152 * finalRgba[i + 1] + 0.0722 * finalRgba[i + 2];
      luma[p] = lum * alpha;
    }

    return {
      width,
      height,
      rgba: finalRgba,
      luma
    };
  }

  function applySharpen(data, width, height, amount) {
    const out = new Uint8ClampedArray(data.length);
    out.set(data);

    const centerWeight = 1 + 4 * amount;
    const neighborWeight = -amount;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const top = ((y - 1) * width + x) * 4;
        const bottom = ((y + 1) * width + x) * 4;
        const left = (y * width + (x - 1)) * 4;
        const right = (y * width + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            data[idx + c] * centerWeight +
            (data[top + c] + data[bottom + c] + data[left + c] + data[right + c]) * neighborWeight;
          out[idx + c] = Math.max(0, Math.min(255, val));
        }
      }
    }
    return out;
  }

  /**
   * Gera imagens de amostra ricas em detalhes e gradientes para teste imediato
   */
  function generateSampleImage(type = 'portrait', width = 760, height = 560) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (type === 'portrait') {
      drawSculpturePortrait(ctx, width, height);
    } else if (type === 'cyber') {
      drawCyberSynthwave(ctx, width, height);
    } else {
      drawBotanicalMandala(ctx, width, height);
    }

    return canvas;
  }

  function drawSculpturePortrait(ctx, w, h) {
    const bgGrad = ctx.createRadialGradient(w * 0.45, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.65);
    bgGrad.addColorStop(0, '#3a4454');
    bgGrad.addColorStop(0.55, '#181c24');
    bgGrad.addColorStop(1, '#08090c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 230, 180, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.42, h * 0.34, 0, Math.PI * 2);
    ctx.stroke();

    const neckGrad = ctx.createLinearGradient(w * 0.38, h * 0.6, w * 0.62, h * 0.65);
    neckGrad.addColorStop(0, '#d8d2c5');
    neckGrad.addColorStop(0.5, '#8c857b');
    neckGrad.addColorStop(1, '#262421');
    ctx.fillStyle = neckGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.41, h * 0.62);
    ctx.lineTo(w * 0.59, h * 0.62);
    ctx.lineTo(w * 0.68, h * 0.92);
    ctx.lineTo(w * 0.32, h * 0.92);
    ctx.closePath();
    ctx.fill();

    const bustGrad = ctx.createRadialGradient(w * 0.4, h * 0.72, 10, w * 0.5, h * 0.85, w * 0.35);
    bustGrad.addColorStop(0, '#f0ece1');
    bustGrad.addColorStop(0.5, '#9b9488');
    bustGrad.addColorStop(1, '#1e1d1b');
    ctx.fillStyle = bustGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.9, w * 0.32, h * 0.16, 0, Math.PI, 0, false);
    ctx.fill();

    ctx.save();
    const headGrad = ctx.createRadialGradient(w * 0.41, h * 0.36, 15, w * 0.51, h * 0.43, h * 0.28);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.35, '#d9d3c7');
    headGrad.addColorStop(0.7, '#6e685f');
    headGrad.addColorStop(1, '#1a1816');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.43, w * 0.165, h * 0.245, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const drawEye = (cx, cy, light) => {
      const eyeSocket = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.045);
      eyeSocket.addColorStop(0, '#141312');
      eyeSocket.addColorStop(0.6, '#3b3733');
      eyeSocket.addColorStop(1, 'rgba(110,104,95,0)');
      ctx.fillStyle = eyeSocket;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.042, h * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = light ? '#dfd9ce' : '#8f887d';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, w * 0.022, h * 0.013, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawEye(w * 0.435, h * 0.40, true);
    drawEye(w * 0.565, h * 0.40, false);

    const noseGrad = ctx.createLinearGradient(w * 0.47, h * 0.4, w * 0.54, h * 0.4);
    noseGrad.addColorStop(0, '#ffffff');
    noseGrad.addColorStop(0.55, '#c7c0b4');
    noseGrad.addColorStop(1, '#2b2825');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.495, h * 0.38);
    ctx.lineTo(w * 0.47, h * 0.50);
    ctx.lineTo(w * 0.53, h * 0.50);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1b1917';
    ctx.beginPath();
    ctx.ellipse(w * 0.505, h * 0.512, w * 0.028, h * 0.012, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#47423c';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.555, w * 0.045, h * 0.012, 0, Math.PI, 0, false);
    ctx.fill();
    ctx.fillStyle = '#cfc8bc';
    ctx.beginPath();
    ctx.ellipse(w * 0.495, h * 0.565, w * 0.04, h * 0.013, 0, 0, Math.PI, false);
    ctx.fill();

    const curls = [
      [0.36, 0.30, 0.045], [0.40, 0.23, 0.05], [0.47, 0.20, 0.055],
      [0.54, 0.21, 0.05], [0.60, 0.25, 0.05], [0.64, 0.32, 0.045],
      [0.34, 0.37, 0.04], [0.65, 0.39, 0.04], [0.43, 0.27, 0.042],
      [0.51, 0.26, 0.045], [0.58, 0.29, 0.042]
    ];
    for (const [cx, cy, r] of curls) {
      const x = w * cx;
      const y = h * cy;
      const rad = w * r;
      const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#9e978b');
      g.addColorStop(1, '#1c1a18');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCyberSynthwave(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0, '#090418');
    sky.addColorStop(0.45, '#2b0f4c');
    sky.addColorStop(0.8, '#8c1d58');
    sky.addColorStop(1, '#ff5e3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sunY = h * 0.42;
    const sunR = h * 0.24;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#fff275');
    sunGrad.addColorStop(0.5, '#ff8c42');
    sunGrad.addColorStop(1, '#ff1e56');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(w * 0.5, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2b0f4c';
    for (let i = 0; i < 6; i++) {
      const sliceY = sunY + i * (sunR * 0.16);
      const sliceH = 3 + i * 2.4;
      ctx.fillRect(w * 0.5 - sunR - 10, sliceY, sunR * 2 + 20, sliceH);
    }

    const horizon = h * 0.62;
    ctx.fillStyle = '#120824';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const peaks = [
      [0.08, 0.50], [0.18, 0.56], [0.28, 0.45], [0.39, 0.58],
      [0.5, 0.54], [0.62, 0.57], [0.74, 0.44], [0.86, 0.55], [0.95, 0.48], [1, 0.62]
    ];
    for (const [px, py] of peaks) {
      ctx.lineTo(w * px, h * py);
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();

    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, '#190a30');
    floor.addColorStop(1, '#05020a');
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + i * 18, horizon);
      ctx.lineTo(w * 0.5 + i * 140, h);
      ctx.stroke();
    }
    for (let i = 1; i <= 9; i++) {
      const t = Math.pow(i / 9, 1.8);
      const y = horizon + t * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const sphereX = w * 0.24;
    const sphereY = h * 0.30;
    const sphereR = h * 0.12;
    const sg = ctx.createRadialGradient(
      sphereX - sphereR * 0.35,
      sphereY - sphereR * 0.35,
      4,
      sphereX,
      sphereY,
      sphereR
    );
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.4, '#00f5d4');
    sg.addColorStop(0.85, '#00509d');
    sg.addColorStop(1, '#03071e');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sphereX, sphereY, sphereR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBotanicalMandala(ctx, w, h) {
    ctx.fillStyle = '#0c100e';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.min(w, h) * 0.44;

    const layers = 5;
    for (let l = layers; l >= 1; l--) {
      const count = 12 + l * 4;
      const layerR = (l / layers) * maxR;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + l * 0.15;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const g = ctx.createLinearGradient(0, 0, layerR, 0);
        g.addColorStop(0, '#14241b');
        g.addColorStop(0.5, l % 2 === 0 ? '#52b788' : '#d8f3dc');
        g.addColorStop(1, '#ffffff');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(layerR * 0.55, -layerR * 0.18, layerR, 0);
        ctx.quadraticCurveTo(layerR * 0.55, layerR * 0.18, 0, 0);
        ctx.fill();

        ctx.strokeStyle = '#081c15';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    const seeds = 160;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < seeds; i++) {
      const r = Math.sqrt(i / seeds) * (maxR * 0.36);
      const theta = i * goldenAngle;
      const sx = cx + r * Math.cos(theta);
      const sy = cy + r * Math.sin(theta);
      const seedR = 2.5 + (i / seeds) * 4.5;

      const sg = ctx.createRadialGradient(sx - 1, sy - 1, 0.5, sx, sy, seedR);
      sg.addColorStop(0, '#fff3b0');
      sg.addColorStop(0.6, '#e09f3e');
      sg.addColorStop(1, '#33220b');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, seedR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  DegenLab.hexToRgb = hexToRgb;
  DegenLab.preprocessImage = preprocessImage;
  DegenLab.generateSampleImage = generateSampleImage;
})(window);
