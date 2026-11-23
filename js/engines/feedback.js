(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});
  const { preprocessImage } = DegenLab;

  let fbCanvas = null;
  let fbCtx = null;
  let tempCanvas = null;
  let tempCtx = null;

  function resetFeedbackBuffer() {
    fbCanvas = null;
  }

  /**
   * Motor Feedback (Temporal Feedback Loop & Motion Trails)
   * Simula realimentação óptica de vídeo (câmera apontada para o próprio monitor)
   * com persistência de rastro, túnel de zoom, rotação espiral e defasagem cromática RGB.
   */
  function renderFeedback(sourceCanvas, outputCanvas, state) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const processed = preprocessImage(sourceCanvas, w, h, {
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      sharpen: state.sharpen,
      invert: state.invert
    });

    if (!fbCanvas || fbCanvas.width !== w || fbCanvas.height !== h) {
      fbCanvas = document.createElement('canvas');
      fbCanvas.width = w;
      fbCanvas.height = h;
      fbCtx = fbCanvas.getContext('2d');

      tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      tempCtx = tempCanvas.getContext('2d');

      fbCtx.putImageData(new ImageData(processed.rgba, w, h), 0, 0);
    }

    const srcLayer = document.createElement('canvas');
    srcLayer.width = w;
    srcLayer.height = h;
    srcLayer.getContext('2d').putImageData(new ImageData(processed.rgba, w, h), 0, 0);

    const decay = (state.fbDecay ?? 82) / 100;             // 0.40 a 0.96
    const zoomStep = (state.fbZoom ?? 4) / 100;            // -0.15 a +0.15
    const spinDeg = state.fbSpin ?? 2.5;                   // -15 a +15 graus
    const colorShift = (state.fbColorShift ?? 45) / 100;   // 0 a 1
    const blendMode = state.fbBlend || 'screen';           // 'screen' | 'difference' | 'source-over'

    const anim = state.anim || { active: false, time: 0, style: 'flow', intensity: 0.65 };
    const t = anim.time;

    // Se estiver estático, renderizamos 9 gerações recursivas para exibir o túnel/rastro completo;
    // Se estiver animado, acumulamos temporalmente quadro a quadro com movimento orbital
    const iterations = anim.active ? 1 : 9;
    if (!anim.active) {
      fbCtx.clearRect(0, 0, w, h);
      fbCtx.drawImage(srcLayer, 0, 0);
    }

    for (let step = 0; step < iterations; step++) {
      // Copiar buffer acumulado atual para tempCanvas
      tempCtx.clearRect(0, 0, w, h);
      tempCtx.drawImage(fbCanvas, 0, 0);

      // Calcular transformação espacial do passo de realimentação
      let curScale = 1 + zoomStep * 0.45;
      let curAngle = (spinDeg * Math.PI) / 180;
      let driftX = 0;
      let driftY = 0;

      if (anim.active) {
        if (anim.style === 'pulse') {
          curScale = 1 + Math.sin(t * 3.2) * (0.015 + Math.abs(zoomStep) * 0.6) * anim.intensity;
          curAngle *= Math.cos(t * 2.1) * (0.5 + anim.intensity);
        } else if (anim.style === 'chaos') {
          curScale = 1 + (zoomStep * 0.5) + Math.sin(t * 17) * 0.03 * anim.intensity;
          driftX = Math.sin(t * 13) * 14 * anim.intensity;
          driftY = Math.cos(t * 11) * 10 * anim.intensity;
        } else {
          // Fluxo orbital contínuo (rastro de movimento circular + túnel)
          driftX = Math.cos(t * 2.6) * 9 * anim.intensity;
          driftY = Math.sin(t * 2.6) * 9 * anim.intensity;
        }
      }

      // 1. Limpar e desenhar o rastro transformado do quadro anterior
      fbCtx.save();
      fbCtx.fillStyle = state.bgColor;
      fbCtx.fillRect(0, 0, w, h);

      fbCtx.translate(w * 0.5 + driftX, h * 0.5 + driftY);
      fbCtx.rotate(curAngle);
      fbCtx.scale(curScale, curScale);
      fbCtx.translate(-w * 0.5, -h * 0.5);

      fbCtx.globalAlpha = decay;
      if (colorShift > 0) {
        fbCtx.filter = `hue-rotate(${Math.round(colorShift * 28)}deg) saturate(${100 + Math.round(colorShift * 25)}%)`;
      }
      fbCtx.drawImage(tempCanvas, 0, 0);
      fbCtx.restore();

      // 2. Injetar o quadro atual por cima usando o modo de mesclagem escolhido
      fbCtx.save();
      if (blendMode === 'difference') {
        fbCtx.globalCompositeOperation = 'difference';
        fbCtx.globalAlpha = 1 - decay * 0.62;
      } else if (blendMode === 'screen') {
        fbCtx.globalCompositeOperation = 'screen';
        fbCtx.globalAlpha = 1 - decay * 0.52;
      } else {
        fbCtx.globalCompositeOperation = 'source-over';
        fbCtx.globalAlpha = 1 - decay * 0.72;
      }

      // Pequeno deslocamento orbital na fonte durante animação para gerar motion trails ricos em fotos estáticas
      let srcOx = 0;
      let srcOy = 0;
      if (anim.active) {
        srcOx = Math.sin(t * 3.4) * 12 * anim.intensity;
        srcOy = Math.cos(t * 2.7) * 8 * anim.intensity;
      }
      fbCtx.drawImage(srcLayer, srcOx, srcOy);
      fbCtx.restore();
    }

    outputCanvas.width = w;
    outputCanvas.height = h;
    const outCtx = outputCanvas.getContext('2d');
    outCtx.drawImage(fbCanvas, 0, 0);

    return {
      cols: w,
      rows: h
    };
  }

  DegenLab.renderFeedback = renderFeedback;
  DegenLab.resetFeedbackBuffer = resetFeedbackBuffer;
})(window);
