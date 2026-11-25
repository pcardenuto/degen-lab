(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});

  function getScaledCanvas(canvas, scale = 1) {
    if (!scale || scale <= 1) return canvas;
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  function downloadPng(canvas, filename = 'degen-art.png', scale = 1) {
    const target = getScaledCanvas(canvas, scale);
    target.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, filename);
    }, 'image/png');
  }

  /**
   * Copia a imagem PNG renderizada diretamente para o Clipboard do sistema
   * permitindo colar (Cmd+V / Ctrl+V) direto no Figma, Photoshop, Illustrator ou Canva!
   */
  async function copyCanvasPngToClipboard(canvas, scale = 1) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard de imagem não suportado neste navegador');
    }
    const target = getScaledCanvas(canvas, scale);
    const blob = await new Promise((resolve) => target.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Falha ao codificar PNG');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
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
   * Inicia gravação de vídeo priorizando formato nativo .MP4 (H.264) para Social Media / Reels,
   * com fallback automático para .WebM (VP9/VP8).
   */
  function createCanvasRecorder(canvas, filenamePrefix = 'degen-anim') {
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      return null;
    }

    const stream = canvas.captureStream(30);
    const mimeCandidates = [
      { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8', ext: 'webm' },
      { mime: 'video/webm', ext: 'webm' }
    ];

    let chosenMime = '';
    let chosenExt = 'webm';
    for (const c of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        chosenMime = c.mime;
        chosenExt = c.ext;
        break;
      }
    }

    const options = chosenMime
      ? { mimeType: chosenMime, videoBitsPerSecond: 10000000 }
      : { videoBitsPerSecond: 10000000 };
    const recorder = new MediaRecorder(stream, options);
    recorder.fileExtension = chosenExt;
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chosenMime || 'video/webm' });
      triggerDownload(blob, `${filenamePrefix}-${Date.now()}.${chosenExt}`);
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

    downloadPng(sheet, `degen-spritesheet-${state.mode}-${Date.now()}.png`, 1);
  }

  DegenLab.downloadPng = downloadPng;
  DegenLab.copyCanvasPngToClipboard = copyCanvasPngToClipboard;
  DegenLab.downloadTextFile = downloadTextFile;
  DegenLab.copyToClipboard = copyToClipboard;
  DegenLab.createCanvasRecorder = createCanvasRecorder;
  DegenLab.exportSpriteSheet = exportSpriteSheet;
})(window);
