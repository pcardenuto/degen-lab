(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});

  function downloadPng(canvas, filename = 'degen-art.png') {
    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, filename);
    }, 'image/png');
  }

  function downloadTextFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    triggerDownload(blob, filename);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }

  /**
   * Inicia gravação de vídeo (.webm) diretamente do Canvas a 30 FPS
   */
  function createCanvasRecorder(canvas, filenamePrefix = 'degen-anim') {
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      return null;
    }

    const stream = canvas.captureStream(30);
    const mimeCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    let mimeType = '';
    for (const candidate of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        mimeType = candidate;
        break;
      }
    }

    const options = mimeType ? { mimeType, videoBitsPerSecond: 6000000 } : {};
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      triggerDownload(blob, `${filenamePrefix}-${Date.now()}.webm`);
    };

    recorder.start(100);
    return recorder;
  }

  /**
   * Gera e baixa uma Sprite Sheet / Contact Sheet 3x2 com 6 quadros consecutivos da animação
   */
  function exportSpriteSheet(outputCanvas, renderStepFn, state) {
    const fw = outputCanvas.width;
    const fh = outputCanvas.height;
    if (!fw || !fh) return;

    const cols = 3;
    const rows = 2;
    const pad = 12;
    const sheet = document.createElement('canvas');
    sheet.width = cols * fw + (cols + 1) * pad;
    sheet.height = rows * fh + (rows + 1) * pad;
    const sCtx = sheet.getContext('2d');

    sCtx.fillStyle = '#07090d';
    sCtx.fillRect(0, 0, sheet.width, sheet.height);

    const savedActive = state.anim.active;
    const savedTime = state.anim.time;
    state.anim.active = true;

    for (let i = 0; i < 6; i++) {
      state.anim.time = savedTime + i * 0.42;
      renderStepFn();

      const col = i % cols;
      const row = Math.floor(i / cols);
      const dx = pad + col * (fw + pad);
      const dy = pad + row * (fh + pad);

      sCtx.drawImage(outputCanvas, dx, dy, fw, fh);
      sCtx.strokeStyle = '#242c3a';
      sCtx.lineWidth = 1;
      sCtx.strokeRect(dx, dy, fw, fh);
    }

    state.anim.active = savedActive;
    state.anim.time = savedTime;
    renderStepFn();

    downloadPng(sheet, `degen-spritesheet-${state.mode}-${Date.now()}.png`);
  }

  DegenLab.downloadPng = downloadPng;
  DegenLab.downloadTextFile = downloadTextFile;
  DegenLab.copyToClipboard = copyToClipboard;
  DegenLab.createCanvasRecorder = createCanvasRecorder;
  DegenLab.exportSpriteSheet = exportSpriteSheet;
})(window);
