(function (global) {
  const {
    generateSampleImage,
    renderHistogram,
    applyGlobalPostFx,
    startMicAudio,
    startFileAudio,
    startSynthBeat,
    stopAllAudio,
    sampleAudioSpectrum,
    renderAscii,
    buildAsciiHtml,
    buildAsciiSvg,
    CHARSET_PRESETS,
    renderBitmap,
    buildBitmapSvg,
    buildBitmapText,
    renderHalftone,
    buildHalftoneSvg,
    renderLumaMesh,
    buildLumaMeshSvg,
    renderPlexus,
    buildPlexusSvg,
    renderDatamosh,
    triggerDatamoshImpulse,
    resetDatamoshBuffer,
    renderFeedback,
    resetFeedbackBuffer,
    renderVhs,
    renderDecimate,
    buildDecimateSvg,
    renderGlitch,
    renderPixelSort,
    renderWaves,
    buildWavesSvg,
    downloadPng,
    downloadTextFile,
    copyToClipboard,
    createCanvasRecorder,
    exportSpriteSheet
  } = global.DegenLab;

  const MAX_WORKING_DIMENSION = 960;
  const STORAGE_PRESETS_KEY = 'degen_lab_user_presets_v4';

  const state = {
    mode: 'ascii',
    cellSize: 8,
    contrast: 15,
    brightness: 0,
    gamma: 1.0,
    sharpen: 25,
    invert: false,
    fgColor: '#e8f5e9',
    bgColor: '#0d1117',

    // Duotone Universal & Post-FX Rack
    duotoneEnabled: false,
    duotoneMix: 85,
    postBloom: 0,
    postVignette: 0,
    postScanlines: 0,
    postChroma: 0,

    // Animação
    anim: {
      active: false,
      time: 0,
      style: 'flow',
      speed: 1.0,
      intensity: 0.65
    },

    // Áudio-Reatividade
    audio: {
      active: false,
      source: '',
      gain: 1.2,
      bass: 0,
      mid: 0,
      high: 0,
      beat: false
    },

    // ASCII
    asciiChars: CHARSET_PRESETS.standard,
    asciiColorMode: 'mono',
    asciiFontScale: 1.05,

    // Bitmap / Multi-Paleta
    bitmapPaletteMode: '1bit',
    bitmapAlgo: 'atkinson',
    bitmapThreshold: 128,
    bitmapBleed: 100,

    // Halftone
    halftoneShape: 'circle',
    halftoneAngle: 22,
    halftoneScale: 1.15,

    // Luma Mesh 3D
    meshTopology: 'grid',
    meshDepth: 110,
    meshPitch: 38,
    meshYaw: -18,
    meshStroke: 1.2,
    meshColorMode: 'color',

    // Plexus Net (12º Motor)
    plexusStyle: 'network',
    plexusRadius: 165,
    plexusJitter: 65,
    plexusNodeSize: 2.4,
    plexusColorMode: 'color',

    // Data Mosh
    moshVectorStyle: 'flow',
    moshBlockSize: 12,
    moshSmear: 65,
    moshPersistence: 84,
    moshCorruption: 35,

    // Feedback
    fbBlend: 'screen',
    fbDecay: 82,
    fbZoom: 4,
    fbSpin: 2.5,
    fbColorShift: 45,

    // VHS Tape
    vhsChromaBleed: 65,
    vhsTracking: 45,
    vhsFlutter: 40,
    vhsNoise: 35,
    vhsOsd: true,

    // Decimate
    decimateStyle: 'complex',
    decimatePasses: 5,
    decimateDetail: 65,
    decimateWarp: 40,
    decimateColorMode: 'mono',

    // Glitch / CRT
    glitchSeed: 1337,
    glitchSlices: 45,
    glitchRgbShift: 18,
    glitchBlockMosh: 30,
    glitchScanlines: 40,

    // Pixel Sort
    sortDirection: 'vertical',
    sortMetric: 'luma',
    sortMin: 45,
    sortMax: 210,
    sortSpan: 65,
    sortReverse: false,

    // Osciloscópio / Waves
    waveStyle: 'elevation',
    waveAmplitude: 24,
    waveFrequency: 35,
    waveStroke: 1.6,
    waveColorMode: 'mono',

    // Viewport (Zoom, Pan & Split-Screen)
    zoom: 1.0,
    panX: 0,
    panY: 0,
    showingOriginal: false,
    splitActive: false,
    splitPercent: 50
  };

  const FACTORY_PRESETS = {
    matrix_crt: {
      mode: 'ascii',
      cellSize: 8,
      fgColor: '#00ff66',
      bgColor: '#050a06',
      asciiChars: CHARSET_PRESETS.matrix,
      asciiColorMode: 'mono',
      postBloom: 45,
      postScanlines: 35,
      postVignette: 45
    },
    mac_1984: {
      mode: 'bitmap',
      cellSize: 4,
      fgColor: '#1a1917',
      bgColor: '#f4efe6',
      bitmapPaletteMode: '1bit',
      bitmapAlgo: 'atkinson',
      bitmapThreshold: 126,
      bitmapBleed: 100,
      postBloom: 0,
      postScanlines: 0
    },
    gameboy_cam: {
      mode: 'bitmap',
      cellSize: 6,
      bitmapPaletteMode: 'gameboy',
      bitmapAlgo: 'bayer4',
      bitmapThreshold: 128,
      bitmapBleed: 105,
      postBloom: 0,
      postScanlines: 25
    },
    cmyk_press: {
      mode: 'halftone',
      cellSize: 9,
      halftoneShape: 'cmyk',
      halftoneAngle: 18,
      halftoneScale: 1.2,
      postBloom: 0,
      postVignette: 20
    },
    cyber_mesh: {
      mode: 'lumamesh',
      cellSize: 9,
      fgColor: '#00f5d4',
      bgColor: '#070913',
      meshTopology: 'grid',
      meshDepth: 145,
      meshPitch: 42,
      meshYaw: -22,
      meshColorMode: 'color',
      postBloom: 55,
      postChroma: 2
    },
    vhs_1994: {
      mode: 'vhs',
      cellSize: 4,
      vhsChromaBleed: 80,
      vhsTracking: 55,
      vhsFlutter: 45,
      vhsNoise: 40,
      vhsOsd: true,
      postVignette: 50,
      postScanlines: 30
    },
    liquid_sort: {
      mode: 'pixelsort',
      cellSize: 4,
      sortDirection: 'vertical',
      sortMetric: 'luma',
      sortMin: 40,
      sortMax: 215,
      sortSpan: 75,
      postBloom: 35,
      postChroma: 3
    },
    plexus_net: {
      mode: 'plexus',
      cellSize: 10,
      fgColor: '#00e676',
      bgColor: '#080b10',
      plexusStyle: 'network',
      plexusRadius: 175,
      plexusJitter: 75,
      plexusNodeSize: 2.8,
      plexusColorMode: 'color',
      postBloom: 45
    }
  };

  let sourceCanvas = null;
  let lastResult = null;
  let renderQueued = false;
  const undoStack = [];

  // Vídeo / Webcam ao vivo
  let activeVideoEl = null;
  let webcamStream = null;
  let isWebcamActive = false;

  // Loop de Animação e Gravação
  let lastFrameTimestamp = 0;
  let activeRecorder = null;
  let recordTimerInterval = null;
  let recordAutoStopTimeout = null;
  let recordSeconds = 0;

  const outputCanvas = document.getElementById('output-canvas');
  const originalCanvas = document.getElementById('original-canvas');
  const histogramCanvas = document.getElementById('histogram-canvas');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvasStage = document.getElementById('canvas-stage');
  const splitDivider = document.getElementById('split-divider');

  const statDimensions = document.getElementById('stat-dimensions');
  const statGrid = document.getElementById('stat-grid');
  const statTime = document.getElementById('stat-time');
  const zoomLabel = document.getElementById('zoom-label');
  const toastEl = document.getElementById('toast');

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2600);
  }

  function pushUndoSnapshot() {
    const copy = JSON.parse(JSON.stringify(state));
    delete copy.anim;
    delete copy.audio;
    undoStack.push(copy);
    if (undoStack.length > 30) undoStack.shift();
  }

  function performUndo() {
    if (undoStack.length === 0) {
      showToast('Nada para desfazer');
      return;
    }
    const prev = undoStack.pop();
    Object.assign(state, prev);
    syncUiFromState();
    scheduleRender();
    showToast('↶ Última ação desfeita');
  }

  function stopActiveVideoMedia() {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      webcamStream = null;
    }
    if (activeVideoEl) {
      activeVideoEl.pause();
      activeVideoEl.srcObject = null;
      activeVideoEl.src = '';
      activeVideoEl = null;
    }
    isWebcamActive = false;
    document.getElementById('btn-webcam').classList.remove('active');
    document.getElementById('btn-webcam').textContent = '📷 Webcam';
  }

  function setSourceImage(imgOrCanvas, label = 'Imagem carregada', keepVideo = false) {
    if (!keepVideo) {
      stopActiveVideoMedia();
    }

    resetDatamoshBuffer();
    resetFeedbackBuffer();

    let w = imgOrCanvas.videoWidth || imgOrCanvas.width;
    let h = imgOrCanvas.videoHeight || imgOrCanvas.height;

    if (w > MAX_WORKING_DIMENSION || h > MAX_WORKING_DIMENSION) {
      const ratio = Math.min(MAX_WORKING_DIMENSION / w, MAX_WORKING_DIMENSION / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    if (!sourceCanvas || sourceCanvas.width !== w || sourceCanvas.height !== h) {
      sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      originalCanvas.width = w;
      originalCanvas.height = h;
    }

    sourceCanvas.getContext('2d').drawImage(imgOrCanvas, 0, 0, w, h);
    originalCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);

    updateHistogramUi();
    scheduleRender();
    if (label) {
      showToast(`✓ ${label} (${w}×${h}px)`);
    }
  }

  function updateHistogramUi() {
    if (!sourceCanvas) return;
    const avgPct = renderHistogram(sourceCanvas, histogramCanvas, state);
    if (typeof avgPct === 'number') {
      document.getElementById('hist-avg-label').textContent = `Média: ${avgPct}%`;
    }
  }

  function scheduleRender() {
    if (state.anim.active || activeVideoEl || state.audio.active) return;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      performRender();
    });
  }

  function animationLoop(timestamp) {
    if (!state.anim.active && !activeVideoEl && !state.audio.active) return;

    if (!lastFrameTimestamp) lastFrameTimestamp = timestamp;
    const dtSec = Math.min(0.1, (timestamp - lastFrameTimestamp) / 1000);
    lastFrameTimestamp = timestamp;

    // 1. Amostrar espectro de áudio se ativo
    if (state.audio.active) {
      sampleAudioSpectrum(state.audio);
      updateAudioMetersUi();

      const bassBoost = state.audio.bass * state.audio.gain;
      state.anim.time += dtSec * (state.anim.speed + bassBoost * 1.4);

      if (state.audio.beat) {
        if (state.mode === 'datamosh') triggerDatamoshImpulse();
        if (state.mode === 'glitch') state.glitchSeed = Math.floor(Math.random() * 999999);
      }
    } else if (state.anim.active) {
      state.anim.time += dtSec * state.anim.speed;
    }

    // 2. Atualizar frame de vídeo ou webcam se ativo
    if (activeVideoEl && activeVideoEl.readyState >= 2) {
      const w = sourceCanvas.width;
      const h = sourceCanvas.height;
      const ctx = sourceCanvas.getContext('2d');
      ctx.save();
      if (isWebcamActive) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(activeVideoEl, 0, 0, w, h);
      ctx.restore();
      originalCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
    }

    performRender();
    requestAnimationFrame(animationLoop);
  }

  function updateAudioMetersUi() {
    const g = state.audio.gain;
    const bPct = Math.min(100, Math.round(state.audio.bass * g * 100));
    const mPct = Math.min(100, Math.round(state.audio.mid * g * 100));
    const hPct = Math.min(100, Math.round(state.audio.high * g * 100));

    document.getElementById('meter-bass').style.width = `${bPct}%`;
    document.getElementById('meter-mid').style.width = `${mPct}%`;
    document.getElementById('meter-high').style.width = `${hPct}%`;
  }

  function setAnimationActive(active) {
    state.anim.active = active;
    const btn = document.getElementById('btn-toggle-anim');
    const icon = document.getElementById('anim-btn-icon');
    const text = document.getElementById('anim-btn-text');
    const badge = document.getElementById('anim-live-badge');

    btn.classList.toggle('active', active);
    badge.classList.toggle('hidden', !active && !state.audio.active);
    icon.textContent = active ? '⏸' : '▶';
    text.textContent = active ? 'Pausar Animação (Espaço)' : 'Animar Efeito (Espaço)';

    if (active) {
      lastFrameTimestamp = performance.now();
      requestAnimationFrame(animationLoop);
    } else {
      performRender();
    }
  }

  function performRender() {
    if (!sourceCanvas) return;
    const t0 = performance.now();

    // Se áudio estiver ativo mesmo com anim pausada, ativar flag temporária para os motores reagirem
    const prevAnimActive = state.anim.active;
    const prevAnimIntensity = state.anim.intensity;
    if (state.audio.active) {
      state.anim.active = true;
      state.anim.intensity = Math.min(1.5, prevAnimIntensity + state.audio.bass * state.audio.gain * 0.65);
    }

    if (state.mode === 'ascii') {
      lastResult = renderAscii(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'bitmap') {
      lastResult = renderBitmap(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'halftone') {
      lastResult = renderHalftone(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'lumamesh') {
      lastResult = renderLumaMesh(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'plexus') {
      lastResult = renderPlexus(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'datamosh') {
      lastResult = renderDatamosh(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'feedback') {
      lastResult = renderFeedback(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'vhs') {
      lastResult = renderVhs(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'decimate') {
      lastResult = renderDecimate(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'glitch') {
      lastResult = renderGlitch(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'pixelsort') {
      lastResult = renderPixelSort(sourceCanvas, outputCanvas, state);
    } else if (state.mode === 'waves') {
      lastResult = renderWaves(sourceCanvas, outputCanvas, state);
    }

    state.anim.active = prevAnimActive;
    state.anim.intensity = prevAnimIntensity;

    // Aplicar Rack de Pós-Processamento Global (Duotone, Bloom, Scanlines, Vinheta CRT, RGB Final)
    applyGlobalPostFx(outputCanvas, state);

    const dt = Math.max(1, Math.round(performance.now() - t0));

    originalCanvas.style.width = `${outputCanvas.width}px`;
    originalCanvas.style.height = `${outputCanvas.height}px`;

    statDimensions.textContent = `${outputCanvas.width} × ${outputCanvas.height} px`;
    statGrid.textContent =
      state.mode === 'decimate'
        ? `Células: ${lastResult.cols} (${lastResult.rows} níveis)`
        : `Grade: ${lastResult.cols} × ${lastResult.rows}`;
    statTime.textContent = `${dt} ms`;

    updateExportButtonsState();
  }

  function updateExportButtonsState() {
    const isTextCapable = state.mode === 'ascii' || state.mode === 'bitmap';
    const isSvgCapable =
      state.mode === 'ascii' ||
      state.mode === 'bitmap' ||
      state.mode === 'halftone' ||
      state.mode === 'lumamesh' ||
      state.mode === 'plexus' ||
      state.mode === 'decimate' ||
      state.mode === 'waves';

    const btnCopy = document.getElementById('btn-copy-ascii');
    const btnTxt = document.getElementById('btn-export-txt');
    const btnHtml = document.getElementById('btn-export-html');
    const btnSvg = document.getElementById('btn-export-svg');

    btnCopy.disabled = !isTextCapable;
    btnTxt.disabled = !isTextCapable;
    btnHtml.disabled = state.mode !== 'ascii';
    btnSvg.disabled = !isSvgCapable;

    btnCopy.style.opacity = isTextCapable ? '1' : '0.4';
    btnTxt.style.opacity = isTextCapable ? '1' : '0.4';
    btnHtml.style.opacity = state.mode === 'ascii' ? '1' : '0.4';
    btnSvg.style.opacity = isSvgCapable ? '1' : '0.4';
  }

  function updateViewportTransform() {
    canvasWrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setSplitScreen(active, percent = state.splitPercent) {
    state.splitActive = active;
    state.splitPercent = Math.max(2, Math.min(98, percent));

    const btnSplit = document.getElementById('btn-split-compare');
    btnSplit.classList.toggle('active', active);
    splitDivider.classList.toggle('hidden', !active);
    originalCanvas.classList.toggle('split-active', active);

    if (active) {
      originalCanvas.classList.remove('hidden');
      outputCanvas.classList.remove('hidden');
      splitDivider.style.left = `${state.splitPercent}%`;
      originalCanvas.style.clipPath = `inset(0 ${100 - state.splitPercent}% 0 0)`;
    } else {
      originalCanvas.style.clipPath = '';
      if (!state.showingOriginal) {
        originalCanvas.classList.add('hidden');
      }
    }
  }

  /**
   * Randomiza criativamente os parâmetros do motor ativo ("Surprise Me")
   */
  function randomizeCurrentMode() {
    pushUndoSnapshot();
    const rInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    const rPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (state.mode === 'ascii') {
      const presetKey = rPick(['standard', 'detailed', 'blocks', 'minimal', 'binary', 'matrix']);
      state.asciiChars = CHARSET_PRESETS[presetKey];
      document.getElementById('ascii-charset-preset').value = presetKey;
      state.asciiColorMode = rPick(['mono', 'color']);
      state.cellSize = rInt(6, 14);
    } else if (state.mode === 'bitmap') {
      state.bitmapPaletteMode = rPick(['1bit', '1bit', 'gameboy', 'cga', 'cyber', 'pico8', 'c64']);
      state.bitmapAlgo = rPick(['atkinson', 'floyd', 'sierra', 'bayer4', 'bayer8', 'random']);
      state.bitmapThreshold = rInt(85, 170);
      state.bitmapBleed = rInt(70, 130);
      state.cellSize = rInt(2, 8);
    } else if (state.mode === 'halftone') {
      state.halftoneShape = rPick(['circle', 'cmyk', 'line', 'diamond', 'cross', 'square']);
      state.halftoneAngle = rInt(0, 75);
      state.halftoneScale = +(0.85 + Math.random() * 0.65).toFixed(2);
      state.cellSize = rInt(7, 16);
    } else if (state.mode === 'lumamesh') {
      state.meshTopology = rPick(['grid', 'triangles', 'dots', 'facets']);
      state.meshDepth = rInt(60, 210);
      state.meshPitch = rInt(-35, 60);
      state.meshYaw = rInt(-55, 55);
      state.cellSize = rInt(7, 15);
    } else if (state.mode === 'plexus') {
      state.plexusStyle = rPick(['network', 'poly', 'voronoi']);
      state.plexusRadius = rInt(125, 220);
      state.plexusJitter = rInt(35, 95);
      state.plexusNodeSize = +(1.2 + Math.random() * 3.5).toFixed(1);
      state.cellSize = rInt(8, 16);
    } else if (state.mode === 'datamosh') {
      state.moshVectorStyle = rPick(['flow', 'gravity', 'explode']);
      state.moshBlockSize = rInt(4, 12) * 2;
      state.moshSmear = rInt(40, 95);
      state.moshCorruption = rInt(15, 75);
      triggerDatamoshImpulse();
    } else if (state.mode === 'feedback') {
      state.fbBlend = rPick(['screen', 'difference', 'source-over']);
      state.fbDecay = rInt(72, 92);
      state.fbZoom = rInt(-8, 10);
      state.fbSpin = +(rInt(-12, 12) * 0.5).toFixed(1);
      state.fbColorShift = rInt(15, 85);
      resetFeedbackBuffer();
    } else if (state.mode === 'vhs') {
      state.vhsChromaBleed = rInt(40, 95);
      state.vhsTracking = rInt(25, 85);
      state.vhsFlutter = rInt(20, 75);
      state.vhsNoise = rInt(15, 65);
    } else if (state.mode === 'decimate') {
      state.decimateStyle = rPick(['complex', 'quadtree', 'xor']);
      state.decimatePasses = rInt(3, 6);
      state.decimateDetail = rInt(40, 85);
      state.decimateWarp = rInt(15, 75);
      state.decimateColorMode = rPick(['mono', 'color']);
    } else if (state.mode === 'glitch') {
      state.glitchSeed = rInt(1, 999999);
      state.glitchSlices = rInt(25, 85);
      state.glitchRgbShift = rInt(8, 42);
      state.glitchBlockMosh = rInt(15, 70);
    } else if (state.mode === 'pixelsort') {
      state.sortDirection = rPick(['vertical', 'horizontal', 'both']);
      state.sortMetric = rPick(['luma', 'hue', 'saturation']);
      state.sortMin = rInt(20, 85);
      state.sortMax = rInt(160, 235);
      state.sortSpan = rInt(35, 95);
    } else if (state.mode === 'waves') {
      state.waveStyle = rPick(['elevation', 'sine', 'vertical']);
      state.waveAmplitude = rInt(14, 58);
      state.waveFrequency = rInt(20, 75);
      state.waveColorMode = rPick(['mono', 'color']);
    }

    syncUiFromState();
    scheduleRender();
    showToast(`🎲 Variação gerada para ${state.mode.toUpperCase()}!`);
  }

  /**
   * Sincroniza todos os controles do DOM com o objeto `state`
   */
  function syncUiFromState() {
    // Abas de modo
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === state.mode);
    });
    const allModes = [
      'ascii', 'bitmap', 'halftone', 'lumamesh', 'plexus',
      'datamosh', 'feedback', 'vhs', 'decimate', 'glitch', 'pixelsort', 'waves'
    ];
    allModes.forEach((m) => {
      const panel = document.getElementById(`panel-${m}`);
      if (panel) panel.classList.toggle('hidden', m !== state.mode);
    });

    const setRangeVal = (id, labelId, val, text) => {
      const el = document.getElementById(id);
      const lb = document.getElementById(labelId);
      if (el) el.value = val;
      if (lb) lb.textContent = text;
    };

    // Globais
    setRangeVal('cell-size', 'val-cell-size', state.cellSize, `${state.cellSize} px`);
    setRangeVal('img-contrast', 'val-img-contrast', state.contrast, state.contrast > 0 ? `+${state.contrast}` : `${state.contrast}`);
    setRangeVal('img-brightness', 'val-img-brightness', state.brightness, state.brightness > 0 ? `+${state.brightness}` : `${state.brightness}`);
    setRangeVal('img-gamma', 'val-img-gamma', state.gamma, state.gamma.toFixed(2));
    setRangeVal('img-sharpen', 'val-img-sharpen', state.sharpen, `${state.sharpen}%`);
    document.getElementById('img-invert').checked = state.invert;

    // Cores & Duotone
    document.getElementById('color-fg').value = state.fgColor;
    document.getElementById('color-bg').value = state.bgColor;
    document.getElementById('hex-fg').textContent = state.fgColor.toUpperCase();
    document.getElementById('hex-bg').textContent = state.bgColor.toUpperCase();
    document.getElementById('duotone-enabled').checked = state.duotoneEnabled;
    setRangeVal('duotone-mix', 'val-duotone-mix', state.duotoneMix, `${state.duotoneMix}%`);

    // Post-FX
    setRangeVal('post-bloom', 'val-post-bloom', state.postBloom, `${state.postBloom}%`);
    setRangeVal('post-vignette', 'val-post-vignette', state.postVignette, `${state.postVignette}%`);
    setRangeVal('post-scanlines', 'val-post-scanlines', state.postScanlines, `${state.postScanlines}%`);
    setRangeVal('post-chroma', 'val-post-chroma', state.postChroma, `${state.postChroma} px`);

    // ASCII
    document.getElementById('ascii-custom-chars').value = state.asciiChars;
    document.getElementById('ascii-color-mode').value = state.asciiColorMode;
    setRangeVal('ascii-font-scale', 'val-ascii-font-scale', state.asciiFontScale, `${state.asciiFontScale.toFixed(2)}x`);

    // Bitmap
    document.getElementById('bitmap-palette-mode').value = state.bitmapPaletteMode;
    document.getElementById('bitmap-algo').value = state.bitmapAlgo;
    setRangeVal('bitmap-threshold', 'val-bitmap-threshold', state.bitmapThreshold, state.bitmapThreshold);
    setRangeVal('bitmap-bleed', 'val-bitmap-bleed', state.bitmapBleed, `${state.bitmapBleed}%`);

    // Halftone
    document.getElementById('halftone-shape').value = state.halftoneShape;
    setRangeVal('halftone-angle', 'val-halftone-angle', state.halftoneAngle, `${state.halftoneAngle}°`);
    setRangeVal('halftone-scale', 'val-halftone-scale', state.halftoneScale, `${state.halftoneScale.toFixed(2)}x`);

    // Luma Mesh
    document.getElementById('mesh-topology').value = state.meshTopology;
    setRangeVal('mesh-depth', 'val-mesh-depth', state.meshDepth, state.meshDepth);
    setRangeVal('mesh-pitch', 'val-mesh-pitch', state.meshPitch, `${state.meshPitch}°`);
    setRangeVal('mesh-yaw', 'val-mesh-yaw', state.meshYaw, `${state.meshYaw}°`);
    setRangeVal('mesh-stroke', 'val-mesh-stroke', state.meshStroke, `${state.meshStroke.toFixed(1)} px`);
    document.getElementById('mesh-color-mode').value = state.meshColorMode;

    // Plexus
    document.getElementById('plexus-style').value = state.plexusStyle;
    setRangeVal('plexus-radius', 'val-plexus-radius', state.plexusRadius, `${state.plexusRadius}%`);
    setRangeVal('plexus-jitter', 'val-plexus-jitter', state.plexusJitter, `${state.plexusJitter}%`);
    setRangeVal('plexus-node-size', 'val-plexus-node-size', state.plexusNodeSize, `${state.plexusNodeSize.toFixed(1)} px`);
    document.getElementById('plexus-color-mode').value = state.plexusColorMode;

    // Data Mosh
    document.getElementById('mosh-vector-style').value = state.moshVectorStyle;
    setRangeVal('mosh-block-size', 'val-mosh-block-size', state.moshBlockSize, `${state.moshBlockSize} px`);
    setRangeVal('mosh-smear', 'val-mosh-smear', state.moshSmear, `${state.moshSmear}%`);
    setRangeVal('mosh-persistence', 'val-mosh-persistence', state.moshPersistence, `${state.moshPersistence}%`);
    setRangeVal('mosh-corruption', 'val-mosh-corruption', state.moshCorruption, `${state.moshCorruption}%`);

    // Feedback
    document.getElementById('fb-blend').value = state.fbBlend;
    setRangeVal('fb-decay', 'val-fb-decay', state.fbDecay, `${state.fbDecay}%`);
    setRangeVal('fb-zoom', 'val-fb-zoom', state.fbZoom, state.fbZoom > 0 ? `+${state.fbZoom}%` : `${state.fbZoom}%`);
    setRangeVal('fb-spin', 'val-fb-spin', state.fbSpin, `${state.fbSpin.toFixed(1)}°`);
    setRangeVal('fb-color-shift', 'val-fb-color-shift', state.fbColorShift, `${state.fbColorShift}%`);

    // VHS
    setRangeVal('vhs-chroma', 'val-vhs-chroma', state.vhsChromaBleed, `${state.vhsChromaBleed}%`);
    setRangeVal('vhs-tracking', 'val-vhs-tracking', state.vhsTracking, `${state.vhsTracking}%`);
    setRangeVal('vhs-flutter', 'val-vhs-flutter', state.vhsFlutter, `${state.vhsFlutter}%`);
    setRangeVal('vhs-noise', 'val-vhs-noise', state.vhsNoise, `${state.vhsNoise}%`);
    document.getElementById('vhs-osd').checked = state.vhsOsd;

    // Decimate
    document.getElementById('decimate-style').value = state.decimateStyle;
    setRangeVal('decimate-passes', 'val-decimate-passes', state.decimatePasses, state.decimatePasses);
    document.getElementById('decimate-color-mode').value = state.decimateColorMode;
    setRangeVal('decimate-detail', 'val-decimate-detail', state.decimateDetail, `${state.decimateDetail}%`);
    setRangeVal('decimate-warp', 'val-decimate-warp', state.decimateWarp, `${state.decimateWarp}%`);

    // Glitch
    setRangeVal('glitch-slices', 'val-glitch-slices', state.glitchSlices, `${state.glitchSlices}%`);
    setRangeVal('glitch-rgb', 'val-glitch-rgb', state.glitchRgbShift, `${state.glitchRgbShift} px`);
    setRangeVal('glitch-blocks', 'val-glitch-blocks', state.glitchBlockMosh, `${state.glitchBlockMosh}%`);
    setRangeVal('glitch-scanlines', 'val-glitch-scanlines', state.glitchScanlines, `${state.glitchScanlines}%`);

    // Pixel Sort
    document.getElementById('sort-direction').value = state.sortDirection;
    document.getElementById('sort-metric').value = state.sortMetric;
    setRangeVal('sort-min', 'val-sort-min', state.sortMin, state.sortMin);
    setRangeVal('sort-max', 'val-sort-max', state.sortMax, state.sortMax);
    setRangeVal('sort-span', 'val-sort-span', state.sortSpan, `${state.sortSpan}%`);
    document.getElementById('sort-reverse').checked = state.sortReverse;

    // Waves
    document.getElementById('wave-style').value = state.waveStyle;
    setRangeVal('wave-amplitude', 'val-wave-amplitude', state.waveAmplitude, `${state.waveAmplitude} px`);
    setRangeVal('wave-frequency', 'val-wave-frequency', state.waveFrequency, `${state.waveFrequency}%`);
    setRangeVal('wave-stroke', 'val-wave-stroke', state.waveStroke, `${state.waveStroke.toFixed(1)} px`);
    document.getElementById('wave-color-mode').value = state.waveColorMode;

    updateHistogramUi();
  }

  /* ==========================================================================
     Gerenciador de Presets (Fábrica + LocalStorage + JSON)
     ========================================================================== */

  function loadUserPresetsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_PRESETS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function refreshUserPresetsDropdown() {
    const group = document.getElementById('user-presets-group');
    group.innerHTML = '';
    const userPresets = loadUserPresetsFromStorage();
    Object.keys(userPresets).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = `user:${name}`;
      opt.textContent = `★ ${name}`;
      group.appendChild(opt);
    });
  }

  function applyPresetObject(presetObj, label) {
    pushUndoSnapshot();
    const safeCopy = { ...presetObj };
    delete safeCopy.anim;
    delete safeCopy.audio;
    Object.assign(state, safeCopy);
    syncUiFromState();
    scheduleRender();
    showToast(`✓ Preset aplicado: ${label}`);
  }

  function initControls() {
    refreshUserPresetsDropdown();

    // 1. Abas dos 12 Motores
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        pushUndoSnapshot();
        const mode = tab.dataset.mode;
        state.mode = mode;

        if ((mode === 'bitmap' || mode === 'glitch' || mode === 'pixelsort' || mode === 'vhs') && state.cellSize > 10) {
          state.cellSize = 4;
        } else if ((mode === 'ascii' || mode === 'halftone' || mode === 'waves' || mode === 'lumamesh' || mode === 'plexus' || mode === 'decimate') && state.cellSize < 6) {
          state.cellSize = 8;
        }

        syncUiFromState();
        scheduleRender();
      });
    });

    // 2. Botões de Topo: Undo & Surprise Me
    document.getElementById('btn-undo').addEventListener('click', performUndo);
    document.getElementById('btn-randomize').addEventListener('click', randomizeCurrentMode);

    // 3. Presets
    document.getElementById('preset-select').addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      if (val.startsWith('factory:')) {
        const key = val.replace('factory:', '');
        if (FACTORY_PRESETS[key]) {
          applyPresetObject(FACTORY_PRESETS[key], e.target.options[e.target.selectedIndex].text);
        }
      } else if (val.startsWith('user:')) {
        const name = val.replace('user:', '');
        const userPresets = loadUserPresetsFromStorage();
        if (userPresets[name]) {
          applyPresetObject(userPresets[name], name);
        }
      }
    });

    document.getElementById('btn-save-preset').addEventListener('click', () => {
      const name = `Preset ${state.mode.toUpperCase()} #${Math.floor(100 + Math.random() * 900)}`;
      const userPresets = loadUserPresetsFromStorage();
      const snapshot = JSON.parse(JSON.stringify(state));
      delete snapshot.anim;
      delete snapshot.audio;
      userPresets[name] = snapshot;
      try {
        localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(userPresets));
        refreshUserPresetsDropdown();
        document.getElementById('preset-select').value = `user:${name}`;
        showToast(`💾 Salvo como "${name}"`);
      } catch (err) {
        showToast('⚠ Não foi possível salvar no LocalStorage');
      }
    });

    document.getElementById('btn-export-preset').addEventListener('click', () => {
      const snapshot = JSON.parse(JSON.stringify(state));
      delete snapshot.anim;
      delete snapshot.audio;
      downloadTextFile(
        JSON.stringify(snapshot, null, 2),
        `degen-preset-${state.mode}-${Date.now()}.json`,
        'application/json;charset=utf-8'
      );
      showToast('⬇ Preset JSON exportado!');
    });

    document.getElementById('preset-file-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          applyPresetObject(parsed, file.name);
        } catch (err) {
          showToast('⚠ Arquivo JSON de preset inválido');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // 4. Animação & Áudio-Reatividade
    document.getElementById('btn-toggle-anim').addEventListener('click', () => {
      setAnimationActive(!state.anim.active);
    });

    document.getElementById('anim-style').addEventListener('change', (e) => {
      state.anim.style = e.target.value;
      if (!state.anim.active) setAnimationActive(true);
    });

    bindRange('anim-speed', 'val-anim-speed', (v) => {
      state.anim.speed = parseFloat(v);
      return `${parseFloat(v).toFixed(1)}x`;
    });

    bindRange('anim-intensity', 'val-anim-intensity', (v) => {
      state.anim.intensity = parseInt(v, 10) / 100;
      return `${v}%`;
    });

    const audioStatusLabel = document.getElementById('audio-status-label');
    const btnAudioSynth = document.getElementById('btn-audio-synth');
    const btnAudioMic = document.getElementById('btn-audio-mic');

    const disableAudioMode = () => {
      stopAllAudio();
      state.audio.active = false;
      state.audio.source = '';
      btnAudioSynth.classList.remove('active');
      btnAudioMic.classList.remove('active');
      audioStatusLabel.textContent = 'Desligado';
      audioStatusLabel.classList.remove('live');
      updateAudioMetersUi();
    };

    btnAudioSynth.addEventListener('click', () => {
      if (state.audio.active && state.audio.source === 'synth') {
        disableAudioMode();
        showToast('🎹 Synth Beat desligado');
        return;
      }
      const label = startSynthBeat();
      state.audio.active = true;
      state.audio.source = 'synth';
      btnAudioSynth.classList.add('active');
      btnAudioMic.classList.remove('active');
      audioStatusLabel.textContent = `● ${label}`;
      audioStatusLabel.classList.add('live');
      document.getElementById('anim-live-badge').classList.remove('hidden');
      lastFrameTimestamp = performance.now();
      requestAnimationFrame(animationLoop);
      showToast('🎹 Synth Beat 122 BPM modulando os efeitos!');
    });

    btnAudioMic.addEventListener('click', async () => {
      if (state.audio.active && state.audio.source === 'mic') {
        disableAudioMode();
        showToast('🎤 Microfone desligado');
        return;
      }
      try {
        await startMicAudio();
        state.audio.active = true;
        state.audio.source = 'mic';
        btnAudioMic.classList.add('active');
        btnAudioSynth.classList.remove('active');
        audioStatusLabel.textContent = '● Microfone Ao Vivo';
        audioStatusLabel.classList.add('live');
        document.getElementById('anim-live-badge').classList.remove('hidden');
        lastFrameTimestamp = performance.now();
        requestAnimationFrame(animationLoop);
        showToast('🎤 Reatividade por Microfone ativada!');
      } catch (err) {
        showToast('⚠ Permissão de microfone negada ou indisponível');
      }
    });

    document.getElementById('audio-file-input').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const name = await startFileAudio(file);
        state.audio.active = true;
        state.audio.source = 'file';
        btnAudioSynth.classList.remove('active');
        btnAudioMic.classList.remove('active');
        audioStatusLabel.textContent = `● ${name.slice(0, 16)}`;
        audioStatusLabel.classList.add('live');
        document.getElementById('anim-live-badge').classList.remove('hidden');
        lastFrameTimestamp = performance.now();
        requestAnimationFrame(animationLoop);
        showToast(`🎵 Tocando e analisando: ${name}`);
      } catch (err) {
        showToast('⚠ Erro ao reproduzir arquivo de áudio');
      }
      e.target.value = '';
    });

    bindRange('audio-gain', 'val-audio-gain', (v) => {
      state.audio.gain = parseInt(v, 10) / 100;
      return `${v}%`;
    });

    // 5. Amostras & Webcam
    document.querySelectorAll('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sampleType = btn.dataset.sample;
        const names = {
          portrait: 'Amostra: Estátua Clássica',
          cyber: 'Amostra: Cyber Synthwave',
          flora: 'Amostra: Mandala Botânica'
        };
        const canvas = generateSampleImage(sampleType, 760, 560);
        setSourceImage(canvas, names[sampleType]);
      });
    });

    document.getElementById('btn-webcam').addEventListener('click', async () => {
      if (isWebcamActive) {
        stopActiveVideoMedia();
        const canvas = generateSampleImage('portrait', 760, 560);
        setSourceImage(canvas, 'Webcam encerrada');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('⚠ Webcam não disponível neste navegador');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        stopActiveVideoMedia();
        webcamStream = stream;
        isWebcamActive = true;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        activeVideoEl = video;
        document.getElementById('btn-webcam').classList.add('active');
        document.getElementById('btn-webcam').textContent = '⏹ Parar Webcam';

        setSourceImage(video, 'Webcam ao Vivo conectada', true);
        lastFrameTimestamp = performance.now();
        requestAnimationFrame(animationLoop);
      } catch (err) {
        showToast('⚠ Permissão de câmera negada ou indisponível');
      }
    });

    // 6. Upload de Foto / Vídeo + Drag & Drop + Colar
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadUserMediaFile(e.target.files[0]);
        e.target.value = '';
      }
    });

    const dropZone = document.getElementById('drop-zone');
    const dropOverlay = document.getElementById('drop-overlay');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropOverlay.classList.remove('hidden');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropOverlay.classList.add('hidden');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropOverlay.classList.add('hidden');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadUserMediaFile(e.dataTransfer.files[0]);
      }
    });

    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) loadUserMediaFile(file);
          break;
        }
      }
    });

    // 7. Controles dos 12 Motores
    const presetSelect = document.getElementById('ascii-charset-preset');
    const customCharsInput = document.getElementById('ascii-custom-chars');

    presetSelect.addEventListener('change', () => {
      pushUndoSnapshot();
      const val = presetSelect.value;
      if (val !== 'custom' && CHARSET_PRESETS[val]) {
        customCharsInput.value = CHARSET_PRESETS[val];
        state.asciiChars = CHARSET_PRESETS[val];
        scheduleRender();
      } else {
        customCharsInput.focus();
      }
    });

    customCharsInput.addEventListener('input', () => {
      presetSelect.value = 'custom';
      state.asciiChars = customCharsInput.value || '@ ';
      scheduleRender();
    });

    document.getElementById('ascii-color-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.asciiColorMode = e.target.value;
      scheduleRender();
    });

    bindRange('ascii-font-scale', 'val-ascii-font-scale', (v) => {
      state.asciiFontScale = parseFloat(v);
      return `${parseFloat(v).toFixed(2)}x`;
    });

    // Bitmap & Multi-Paleta
    document.getElementById('bitmap-palette-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.bitmapPaletteMode = e.target.value;
      scheduleRender();
    });

    document.getElementById('bitmap-algo').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.bitmapAlgo = e.target.value;
      scheduleRender();
    });

    bindRange('bitmap-threshold', 'val-bitmap-threshold', (v) => {
      state.bitmapThreshold = parseInt(v, 10);
      updateHistogramUi();
      return v;
    });

    bindRange('bitmap-bleed', 'val-bitmap-bleed', (v) => {
      state.bitmapBleed = parseInt(v, 10);
      return `${v}%`;
    });

    // Halftone
    document.getElementById('halftone-shape').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.halftoneShape = e.target.value;
      scheduleRender();
    });

    bindRange('halftone-angle', 'val-halftone-angle', (v) => {
      state.halftoneAngle = parseInt(v, 10);
      return `${v}°`;
    });

    bindRange('halftone-scale', 'val-halftone-scale', (v) => {
      state.halftoneScale = parseFloat(v);
      return `${parseFloat(v).toFixed(2)}x`;
    });

    // Luma Mesh 3D
    document.getElementById('mesh-topology').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.meshTopology = e.target.value;
      scheduleRender();
    });

    bindRange('mesh-depth', 'val-mesh-depth', (v) => {
      state.meshDepth = parseInt(v, 10);
      return v;
    });

    bindRange('mesh-pitch', 'val-mesh-pitch', (v) => {
      state.meshPitch = parseInt(v, 10);
      return `${v}°`;
    });

    bindRange('mesh-yaw', 'val-mesh-yaw', (v) => {
      state.meshYaw = parseInt(v, 10);
      return `${v}°`;
    });

    bindRange('mesh-stroke', 'val-mesh-stroke', (v) => {
      state.meshStroke = parseFloat(v);
      return `${parseFloat(v).toFixed(1)} px`;
    });

    document.getElementById('mesh-color-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.meshColorMode = e.target.value;
      scheduleRender();
    });

    // Plexus Net (12º Motor)
    document.getElementById('plexus-style').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.plexusStyle = e.target.value;
      scheduleRender();
    });

    bindRange('plexus-radius', 'val-plexus-radius', (v) => {
      state.plexusRadius = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('plexus-jitter', 'val-plexus-jitter', (v) => {
      state.plexusJitter = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('plexus-node-size', 'val-plexus-node-size', (v) => {
      state.plexusNodeSize = parseFloat(v);
      return `${parseFloat(v).toFixed(1)} px`;
    });

    document.getElementById('plexus-color-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.plexusColorMode = e.target.value;
      scheduleRender();
    });

    // Data Mosh
    document.getElementById('btn-drop-iframe').addEventListener('click', () => {
      triggerDatamoshImpulse();
      performRender();
      showToast('💥 I-Frame descartado! Vetores P-Frame injetados.');
    });

    document.getElementById('btn-reset-mosh').addEventListener('click', () => {
      resetDatamoshBuffer();
      scheduleRender();
      showToast('Buffer Data Mosh restaurado');
    });

    document.getElementById('mosh-vector-style').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.moshVectorStyle = e.target.value;
      scheduleRender();
    });

    bindRange('mosh-block-size', 'val-mosh-block-size', (v) => {
      state.moshBlockSize = parseInt(v, 10);
      return `${v} px`;
    });

    bindRange('mosh-smear', 'val-mosh-smear', (v) => {
      state.moshSmear = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('mosh-persistence', 'val-mosh-persistence', (v) => {
      state.moshPersistence = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('mosh-corruption', 'val-mosh-corruption', (v) => {
      state.moshCorruption = parseInt(v, 10);
      return `${v}%`;
    });

    // Feedback
    document.getElementById('btn-reset-feedback').addEventListener('click', () => {
      resetFeedbackBuffer();
      scheduleRender();
      showToast('Buffer de Feedback limpo');
    });

    document.getElementById('fb-blend').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.fbBlend = e.target.value;
      scheduleRender();
    });

    bindRange('fb-decay', 'val-fb-decay', (v) => {
      state.fbDecay = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('fb-zoom', 'val-fb-zoom', (v) => {
      const n = parseInt(v, 10);
      state.fbZoom = n;
      return n > 0 ? `+${n}%` : `${n}%`;
    });

    bindRange('fb-spin', 'val-fb-spin', (v) => {
      state.fbSpin = parseFloat(v);
      return `${parseFloat(v).toFixed(1)}°`;
    });

    bindRange('fb-color-shift', 'val-fb-color-shift', (v) => {
      state.fbColorShift = parseInt(v, 10);
      return `${v}%`;
    });

    // VHS Tape
    bindRange('vhs-chroma', 'val-vhs-chroma', (v) => {
      state.vhsChromaBleed = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('vhs-tracking', 'val-vhs-tracking', (v) => {
      state.vhsTracking = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('vhs-flutter', 'val-vhs-flutter', (v) => {
      state.vhsFlutter = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('vhs-noise', 'val-vhs-noise', (v) => {
      state.vhsNoise = parseInt(v, 10);
      return `${v}%`;
    });

    document.getElementById('vhs-osd').addEventListener('change', (e) => {
      state.vhsOsd = e.target.checked;
      scheduleRender();
    });

    // Decimate
    document.getElementById('decimate-style').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.decimateStyle = e.target.value;
      scheduleRender();
    });

    bindRange('decimate-passes', 'val-decimate-passes', (v) => {
      state.decimatePasses = parseInt(v, 10);
      return v;
    });

    document.getElementById('decimate-color-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.decimateColorMode = e.target.value;
      scheduleRender();
    });

    bindRange('decimate-detail', 'val-decimate-detail', (v) => {
      state.decimateDetail = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('decimate-warp', 'val-decimate-warp', (v) => {
      state.decimateWarp = parseInt(v, 10);
      return `${v}%`;
    });

    // Glitch Digital
    document.getElementById('btn-reroll-glitch').addEventListener('click', () => {
      state.glitchSeed = Math.floor(Math.random() * 999999) + 1;
      scheduleRender();
    });

    bindRange('glitch-slices', 'val-glitch-slices', (v) => {
      state.glitchSlices = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('glitch-rgb', 'val-glitch-rgb', (v) => {
      state.glitchRgbShift = parseInt(v, 10);
      return `${v} px`;
    });

    bindRange('glitch-blocks', 'val-glitch-blocks', (v) => {
      state.glitchBlockMosh = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('glitch-scanlines', 'val-glitch-scanlines', (v) => {
      state.glitchScanlines = parseInt(v, 10);
      return `${v}%`;
    });

    // Pixel Sorting
    document.getElementById('sort-direction').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.sortDirection = e.target.value;
      scheduleRender();
    });

    document.getElementById('sort-metric').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.sortMetric = e.target.value;
      scheduleRender();
    });

    bindRange('sort-min', 'val-sort-min', (v) => {
      state.sortMin = parseInt(v, 10);
      updateHistogramUi();
      return v;
    });

    bindRange('sort-max', 'val-sort-max', (v) => {
      state.sortMax = parseInt(v, 10);
      updateHistogramUi();
      return v;
    });

    bindRange('sort-span', 'val-sort-span', (v) => {
      state.sortSpan = parseInt(v, 10);
      return `${v}%`;
    });

    document.getElementById('sort-reverse').addEventListener('change', (e) => {
      state.sortReverse = e.target.checked;
      scheduleRender();
    });

    // Osciloscópio / Waves
    document.getElementById('wave-style').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.waveStyle = e.target.value;
      scheduleRender();
    });

    bindRange('wave-amplitude', 'val-wave-amplitude', (v) => {
      state.waveAmplitude = parseInt(v, 10);
      return `${v} px`;
    });

    bindRange('wave-frequency', 'val-wave-frequency', (v) => {
      state.waveFrequency = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('wave-stroke', 'val-wave-stroke', (v) => {
      state.waveStroke = parseFloat(v);
      return `${parseFloat(v).toFixed(1)} px`;
    });

    document.getElementById('wave-color-mode').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.waveColorMode = e.target.value;
      scheduleRender();
    });

    // 8. Controles de Sinal, Imagem & Histograma
    bindRange('cell-size', 'val-cell-size', (v) => {
      state.cellSize = parseInt(v, 10);
      return `${v} px`;
    });

    bindRange('img-contrast', 'val-img-contrast', (v) => {
      const n = parseInt(v, 10);
      state.contrast = n;
      updateHistogramUi();
      return n > 0 ? `+${n}` : `${n}`;
    });

    bindRange('img-brightness', 'val-img-brightness', (v) => {
      const n = parseInt(v, 10);
      state.brightness = n;
      updateHistogramUi();
      return n > 0 ? `+${n}` : `${n}`;
    });

    bindRange('img-gamma', 'val-img-gamma', (v) => {
      state.gamma = parseFloat(v);
      updateHistogramUi();
      return parseFloat(v).toFixed(2);
    });

    bindRange('img-sharpen', 'val-img-sharpen', (v) => {
      state.sharpen = parseInt(v, 10);
      return `${v}%`;
    });

    document.getElementById('img-invert').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.invert = e.target.checked;
      updateHistogramUi();
      scheduleRender();
    });

    document.getElementById('btn-reset-adjustments').addEventListener('click', () => {
      pushUndoSnapshot();
      state.contrast = 15;
      state.brightness = 0;
      state.gamma = 1.0;
      state.sharpen = 25;
      state.invert = false;
      resetDatamoshBuffer();
      resetFeedbackBuffer();
      syncUiFromState();
      scheduleRender();
      showToast('Ajustes de imagem restaurados');
    });

    // 9. Paleta & Duotone Universal
    const colorFgInput = document.getElementById('color-fg');
    const colorBgInput = document.getElementById('color-bg');
    const hexFgSpan = document.getElementById('hex-fg');
    const hexBgSpan = document.getElementById('hex-bg');
    const paletteChips = document.querySelectorAll('.palette-chip');

    const applyColors = (fg, bg) => {
      state.fgColor = fg;
      state.bgColor = bg;
      colorFgInput.value = fg;
      colorBgInput.value = bg;
      hexFgSpan.textContent = fg.toUpperCase();
      hexBgSpan.textContent = bg.toUpperCase();
      scheduleRender();
    };

    paletteChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        pushUndoSnapshot();
        paletteChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        applyColors(chip.dataset.fg, chip.dataset.bg);
      });
    });

    colorFgInput.addEventListener('input', (e) => {
      paletteChips.forEach((c) => c.classList.remove('active'));
      applyColors(e.target.value, state.bgColor);
    });

    colorBgInput.addEventListener('input', (e) => {
      paletteChips.forEach((c) => c.classList.remove('active'));
      applyColors(state.fgColor, e.target.value);
    });

    document.getElementById('btn-swap-colors').addEventListener('click', () => {
      pushUndoSnapshot();
      applyColors(state.bgColor, state.fgColor);
    });

    document.getElementById('duotone-enabled').addEventListener('change', (e) => {
      pushUndoSnapshot();
      state.duotoneEnabled = e.target.checked;
      scheduleRender();
    });

    bindRange('duotone-mix', 'val-duotone-mix', (v) => {
      state.duotoneMix = parseInt(v, 10);
      return `${v}%`;
    });

    // 10. Rack de Pós-Efeitos Global (Post-FX)
    bindRange('post-bloom', 'val-post-bloom', (v) => {
      state.postBloom = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('post-vignette', 'val-post-vignette', (v) => {
      state.postVignette = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('post-scanlines', 'val-post-scanlines', (v) => {
      state.postScanlines = parseInt(v, 10);
      return `${v}%`;
    });

    bindRange('post-chroma', 'val-post-chroma', (v) => {
      state.postChroma = parseInt(v, 10);
      return `${v} px`;
    });

    document.getElementById('btn-reset-postfx').addEventListener('click', () => {
      pushUndoSnapshot();
      state.postBloom = 0;
      state.postVignette = 0;
      state.postScanlines = 0;
      state.postChroma = 0;
      syncUiFromState();
      scheduleRender();
      showToast('Rack de Pós-Efeitos zerado');
    });

    // 11. Palco: Split-Screen Curtain, Comparação, Wheel Zoom & Drag Pan
    document.getElementById('btn-split-compare').addEventListener('click', () => {
      setSplitScreen(!state.splitActive);
    });

    let draggingSplit = false;
    splitDivider.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      draggingSplit = true;
    });

    const btnCompare = document.getElementById('btn-compare');
    const toggleOriginal = (show) => {
      if (state.splitActive) return;
      state.showingOriginal = show;
      originalCanvas.classList.toggle('hidden', !show);
      outputCanvas.classList.toggle('hidden', show);
      btnCompare.classList.toggle('active', show);
    };

    btnCompare.addEventListener('mousedown', () => toggleOriginal(true));
    window.addEventListener('mouseup', () => {
      if (state.showingOriginal) toggleOriginal(false);
    });

    const setZoom = (z) => {
      state.zoom = Math.max(0.25, Math.min(3.5, z));
      updateViewportTransform();
    };

    document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.15));
    document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.15));
    const fitToStage = () => {
      if (!outputCanvas.width) return;
      const availW = canvasStage.clientWidth - 40;
      const availH = canvasStage.clientHeight - 40;
      const fit = Math.min(1.5, Math.min(availW / outputCanvas.width, availH / outputCanvas.height));
      state.panX = 0;
      state.panY = 0;
      setZoom(fit);
    };
    document.getElementById('btn-zoom-fit').addEventListener('click', fitToStage);
    canvasStage.addEventListener('dblclick', fitToStage);

    // Zoom na roda do mouse (Scroll Wheel)
    canvasStage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(state.zoom + delta);
    }, { passive: false });

    // Pan (Arrastar palco) e Arrastar Cortina Split-Screen
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    canvasStage.addEventListener('mousedown', (e) => {
      if (draggingSplit) return;
      isPanning = true;
      panStartX = e.clientX - state.panX;
      panStartY = e.clientY - state.panY;
      canvasStage.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (draggingSplit && state.splitActive) {
        const rect = canvasWrapper.getBoundingClientRect();
        if (rect.width > 0) {
          const pct = ((e.clientX - rect.left) / rect.width) * 100;
          setSplitScreen(true, pct);
        }
        return;
      }
      if (isPanning) {
        state.panX = e.clientX - panStartX;
        state.panY = e.clientY - panStartY;
        updateViewportTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      draggingSplit = false;
      if (isPanning) {
        isPanning = false;
        canvasStage.classList.remove('panning');
      }
    });

    // 12. Atalhos de Teclado Globais
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        performUndo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setAnimationActive(!state.anim.active);
      } else if (e.key.toLowerCase() === 'c') {
        setSplitScreen(!state.splitActive);
      } else if (e.key.toLowerCase() === 'd') {
        randomizeCurrentMode();
      } else if (e.key.toLowerCase() === 'i') {
        pushUndoSnapshot();
        state.invert = !state.invert;
        document.getElementById('img-invert').checked = state.invert;
        updateHistogramUi();
        scheduleRender();
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        document.getElementById('btn-record-video').click();
      }
    });

    // 13. Exportação, Sprite Sheet & Gravação de Vídeo com Timer
    const btnRecord = document.getElementById('btn-record-video');
    const stopRecordingNow = () => {
      if (activeRecorder && activeRecorder.state === 'recording') {
        activeRecorder.stop();
        activeRecorder = null;
        clearInterval(recordTimerInterval);
        clearTimeout(recordAutoStopTimeout);
        btnRecord.classList.remove('recording');
        btnRecord.textContent = '⏺ Gravar Vídeo';
        showToast('🎬 Vídeo WebM exportado com sucesso!');
      }
    };

    btnRecord.addEventListener('click', () => {
      if (activeRecorder && activeRecorder.state === 'recording') {
        stopRecordingNow();
        return;
      }

      if (!state.anim.active && !activeVideoEl && !state.audio.active) {
        setAnimationActive(true);
      }

      const recorder = createCanvasRecorder(outputCanvas, `degen-${state.mode}`);
      if (!recorder) {
        showToast('⚠ Gravação de vídeo não suportada neste navegador');
        return;
      }

      activeRecorder = recorder;
      recordSeconds = 0;
      const maxDur = parseInt(document.getElementById('record-duration').value, 10) || 0;

      btnRecord.classList.add('recording');
      btnRecord.textContent = maxDur > 0 ? `⏹ 0/${maxDur}s` : '⏹ Parar (00s)';
      showToast(
        maxDur > 0
          ? `⏺ Gravando loop de ${maxDur} segundos...`
          : '⏺ Gravando animação... Clique novamente para parar.'
      );

      recordTimerInterval = setInterval(() => {
        recordSeconds++;
        if (maxDur > 0) {
          btnRecord.textContent = `⏹ ${recordSeconds}/${maxDur}s`;
        } else {
          const s = String(recordSeconds).padStart(2, '0');
          btnRecord.textContent = `⏹ Parar (${s}s)`;
        }
      }, 1000);

      if (maxDur > 0) {
        recordAutoStopTimeout = setTimeout(() => {
          stopRecordingNow();
        }, maxDur * 1000);
      }
    });

    document.getElementById('btn-export-spritesheet').addEventListener('click', () => {
      exportSpriteSheet(outputCanvas, performRender, state);
      showToast('🎞 Sprite Sheet 6× exportada em PNG!');
    });

    document.getElementById('btn-export-png').addEventListener('click', () => {
      downloadPng(outputCanvas, `degen-${state.mode}-${Date.now()}.png`);
      showToast('⬇ Imagem PNG exportada!');
    });

    document.getElementById('btn-export-svg').addEventListener('click', () => {
      if (!lastResult) return;
      let svg = '';
      if (state.mode === 'ascii') {
        svg = buildAsciiSvg(lastResult);
      } else if (state.mode === 'bitmap') {
        svg = buildBitmapSvg(lastResult);
      } else if (state.mode === 'halftone') {
        svg = buildHalftoneSvg(lastResult);
      } else if (state.mode === 'lumamesh') {
        svg = buildLumaMeshSvg(lastResult);
      } else if (state.mode === 'plexus') {
        svg = buildPlexusSvg(lastResult);
      } else if (state.mode === 'decimate') {
        svg = buildDecimateSvg(lastResult);
      } else if (state.mode === 'waves') {
        svg = buildWavesSvg(lastResult);
      }
      if (!svg) {
        showToast('SVG disponível em ASCII, Bitmap, Halftone, Luma Mesh, Plexus, Decimate e Osciloscópio');
        return;
      }
      downloadTextFile(svg, `degen-${state.mode}-${Date.now()}.svg`, 'image/svg+xml;charset=utf-8');
      showToast('⬇ Vetor SVG exportado!');
    });

    document.getElementById('btn-export-txt').addEventListener('click', () => {
      if (!lastResult) return;
      const text =
        state.mode === 'ascii'
          ? lastResult.text
          : state.mode === 'bitmap'
          ? buildBitmapText(lastResult)
          : '';
      if (!text) {
        showToast('Mude para o modo ASCII ou Bitmap para exportar TXT');
        return;
      }
      downloadTextFile(text, `degen-${state.mode}-${Date.now()}.txt`);
      showToast('⬇ Arquivo TXT exportado!');
    });

    document.getElementById('btn-export-html').addEventListener('click', () => {
      if (!lastResult || state.mode !== 'ascii') {
        showToast('Exportação HTML disponível no modo ASCII');
        return;
      }
      const html = buildAsciiHtml(lastResult);
      downloadTextFile(html, `degen-ascii-${Date.now()}.html`, 'text/html;charset=utf-8');
      showToast('⬇ Página HTML exportada!');
    });

    document.getElementById('btn-copy-ascii').addEventListener('click', async () => {
      if (!lastResult) return;
      const text =
        state.mode === 'ascii'
          ? lastResult.text
          : state.mode === 'bitmap'
          ? buildBitmapText(lastResult)
          : '';
      if (!text) {
        showToast('Mude para o modo ASCII ou Bitmap para copiar texto');
        return;
      }
      await copyToClipboard(text);
      showToast('📋 Arte copiada para a área de transferência!');
    });
  }

  function bindRange(inputId, labelId, formatter) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    input.addEventListener('mousedown', () => pushUndoSnapshot());
    input.addEventListener('input', () => {
      label.textContent = formatter(input.value);
      scheduleRender();
    });
  }

  function loadUserMediaFile(file) {
    if (file.type.startsWith('video/')) {
      stopActiveVideoMedia();
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = async () => {
        await video.play();
        activeVideoEl = video;
        setSourceImage(video, `Vídeo: ${file.name}`, true);
        lastFrameTimestamp = performance.now();
        requestAnimationFrame(animationLoop);
      };
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('⚠ Formato não suportado (use Imagem ou Vídeo)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img, file.name);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.addEventListener('DOMContentLoaded', () => {
    initControls();
    const initialSample = generateSampleImage('portrait', 760, 560);
    setSourceImage(initialSample, 'Amostra: Estátua Clássica');
  });
})(window);
