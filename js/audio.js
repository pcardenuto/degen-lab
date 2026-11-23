(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});

  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let micStream = null;
  let audioEl = null;
  let synthInterval = null;
  let prevBass = 0;

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }
  }

  function stopAllAudio() {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
      audioEl = null;
    }
    if (synthInterval) {
      clearInterval(synthInterval);
      synthInterval = null;
    }
    if (analyser) {
      try {
        analyser.disconnect();
      } catch (e) {}
    }
  }

  /**
   * Inicia captura reativa via Microfone ao Vivo
   */
  async function startMicAudio() {
    stopAllAudio();
    ensureAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStream = stream;
    const src = audioCtx.createMediaStreamSource(stream);
    src.connect(analyser);
    return 'mic';
  }

  /**
   * Inicia reprodução e análise de arquivo de áudio (.mp3, .wav, .ogg)
   */
  async function startFileAudio(file) {
    stopAllAudio();
    ensureAudioContext();
    const url = URL.createObjectURL(file);
    audioEl = new Audio(url);
    audioEl.loop = true;
    const src = audioCtx.createMediaElementSource(audioEl);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    await audioEl.play();
    return file.name;
  }

  /**
   * Gerador Synth Beat Interno (122 BPM Electro/Techno loop via Web Audio API)
   * Permite testar e gravar a reatividade a áudio com 1 clique sem precisar de microfone ou MP3.
   */
  function startSynthBeat() {
    stopAllAudio();
    ensureAudioContext();

    const master = audioCtx.createGain();
    master.gain.value = 0.25;
    master.connect(analyser);
    analyser.connect(audioCtx.destination);

    let step = 0;
    const notes = [55, 55, 65.41, 55, 73.42, 65.41, 82.41, 49]; // A1, C2, D2, E2, G1

    const triggerStep = () => {
      const now = audioCtx.currentTime;

      // Kick Drum nos passos 0, 4, 8, 12 (4x4)
      if (step % 4 === 0) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(135, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
        g.gain.setValueAtTime(1.0, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.23);
      }

      // Synth Bass Arpeggio
      const bassNote = notes[step % notes.length];
      const bOsc = audioCtx.createOscillator();
      const bFilter = audioCtx.createBiquadFilter();
      const bGain = audioCtx.createGain();
      bOsc.type = 'sawtooth';
      bOsc.frequency.setValueAtTime(bassNote * (step % 2 === 0 ? 1 : 2), now);
      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(step % 4 === 2 ? 1600 : 650, now);
      bGain.gain.setValueAtTime(0.42, now);
      bGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(master);
      bOsc.start(now);
      bOsc.stop(now + 0.12);

      // Hi-Hat / Agudos nos contratempo
      if (step % 2 === 1) {
        const hOsc = audioCtx.createOscillator();
        const hGain = audioCtx.createGain();
        hOsc.type = 'square';
        hOsc.frequency.setValueAtTime(3200 + (step % 3) * 1100, now);
        hGain.gain.setValueAtTime(0.18, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        hOsc.connect(hGain);
        hGain.connect(master);
        hOsc.start(now);
        hOsc.stop(now + 0.06);
      }

      step = (step + 1) % 16;
    };

    triggerStep();
    synthInterval = setInterval(triggerStep, 123); // ~122 BPM 16th notes
    return 'Synth Beat 122 BPM';
  }

  /**
   * Amostra o espectro atual (Bass, Mid, High e detecção de Beat/Kick)
   */
  function sampleAudioSpectrum(audioState) {
    if (!audioState.active || !analyser || !freqData) {
      audioState.bass = 0;
      audioState.mid = 0;
      audioState.high = 0;
      audioState.beat = false;
      return;
    }

    analyser.getByteFrequencyData(freqData);

    // Bins 0..7: Graves (Bass)
    let bassSum = 0;
    for (let i = 0; i < 8; i++) bassSum += freqData[i];
    const bass = Math.min(1, bassSum / (8 * 235));

    // Bins 8..35: Médios (Mid)
    let midSum = 0;
    for (let i = 8; i < 36; i++) midSum += freqData[i];
    const mid = Math.min(1, midSum / (28 * 210));

    // Bins 36..96: Agudos (High)
    let highSum = 0;
    for (let i = 36; i < 96; i++) highSum += freqData[i];
    const high = Math.min(1, highSum / (60 * 170));

    const beat = bass > 0.52 && bass - prevBass > 0.14;
    prevBass = bass;

    audioState.bass = bass;
    audioState.mid = mid;
    audioState.high = high;
    audioState.beat = beat;
  }

  DegenLab.startMicAudio = startMicAudio;
  DegenLab.startFileAudio = startFileAudio;
  DegenLab.startSynthBeat = startSynthBeat;
  DegenLab.stopAllAudio = stopAllAudio;
  DegenLab.sampleAudioSpectrum = sampleAudioSpectrum;
})(window);
