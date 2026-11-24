(function (global) {
  const DegenLab = (global.DegenLab = global.DegenLab || {});

  const API_KEY_STORAGE = 'degen_lab_gemini_api_key_v5';

  // Dicionários de Engenharia de Prompt para Designers
  const LIGHTING_DIRECTIVES = {
    chiaroscuro:
      'dramatic Caravaggio chiaroscuro studio lighting, hard directional key light at 45 degrees, deep sculpted shadows, rich midtone roll-off, high tonal contrast ratio',
    rimlight:
      'intense specular dual rim lighting carving out the outer silhouette edges, high-contrast edge separation, moody volumetric core shadow',
    studio_highkey:
      'clean editorial commercial studio softbox lighting, smooth continuous tonal gradients, crisp specular highlights, balanced exposure',
    neon_cyber:
      'high-contrast split-complementary neon lighting, electric cyan key light from left and hot magenta rim light from right, deep dark shadows',
    silhouette:
      'extreme graphic contrast, stark backlit silhouette with razor-sharp contour separation, posterized tonal planes'
  };

  const MATERIAL_DIRECTIVES = {
    marble:
      'matte classical Carrara marble and raw plaster sculpture texture, smooth subsurface scattering, clear geometric form without noisy surface clutter',
    chrome:
      'liquid mercury and highly reflective polished chrome surface, sharp anisotropic specular reflections, bold dark/light ribbons',
    brutalist:
      'Swiss International Typographic Style and brutalist architectural concrete monolith geometry, bold modular shapes, bauhaus structural precision',
    editorial:
      'high-fashion medium-format Hasselblad 80mm analog portrait photography, crisp skin and fabric micro-contrast, expressive subject',
    cyber_mech:
      'intricate biomechanical android hardware, exposed matte carbon panels, glowing optical sensors and braided industrial cables',
    botanical:
      'exotic macro botanical structure, fibonacci spiral symmetry, crisp organic veins and dew droplets with strong tonal depth'
  };

  const LENS_DIRECTIVES = {
    portrait_85mm: '85mm f/1.4 prime portrait lens, centered heroic framing, tack-sharp subject focus',
    isometric: '3D orthographic isometric projection, clean architectural axonometric angle',
    wide_24mm: '24mm wide-angle dynamic low-angle perspective, monumental scale and strong depth',
    macro: '100mm 1:1 extreme macro close-up lens, intricate structural detail filling the frame',
    topdown: 'symmetrical flat-lay zenithal top-down composition, geometric balance'
  };

  const BG_DIRECTIVES = {
    pitch_black:
      'completely isolated on a pure pitch-black void background (#000000) with zero background clutter',
    paper_white:
      'isolated on a clean seamless pure white studio cyclorama background (#FFFFFF)',
    radial_halo:
      'dark studio background with a subtle geometric radial halo glow behind the main subject',
    env_depth:
      'layered atmospheric background with subtle perspective grid and depth fog separating foreground from background'
  };

  const ENGINE_OPTIMIZATION_HINTS = {
    ascii:
      'Optimized for ASCII typography mapping: bold recognizable silhouette, clear macro-shapes, distinct separation between shadow, midtone, and highlight zones.',
    bitmap:
      'Optimized for 1-bit Atkinson & Bayer dithering: smooth continuous gradients across curved surfaces paired with crisp high-contrast structural edges.',
    halftone:
      'Optimized for CMYK & halftone screen printing: vibrant primary color separation and broad, well-defined tonal areas.',
    lumamesh:
      'Optimized for 3D Luminance Depth Extrusion (Z-depth map): bright foreground subject fading smoothly toward darker recessed edges.',
    plexus:
      'Optimized for Plexus constellation triangulation: well-distributed high-contrast feature nodes and clear structural contours.',
    waves:
      'Optimized for Rutt-Etra 3D oscilloscope scanline elevation: smooth luminance relief with a strong central focal form.',
    datamosh:
      'Optimized for P-Frame macroblock datamoshing: bold chromatic blocks and strong directional motion lines.',
    feedback:
      'Optimized for optical feedback trails: luminous high-contrast subject isolated against a dark surround.',
    vhs:
      'Optimized for 1990s analog NTSC VHS tape aesthetic: saturated retro colors and sharp vertical edges for chroma bleed.',
    decimate:
      'Optimized for recursive quadtree subdivision: combination of large calm negative-space zones and intricate high-contrast focal details.',
    glitch:
      'Optimized for RGB split and slice glitching: strong vertical alignment and high-contrast graphic focal point.',
    pixelsort:
      'Optimized for Kim Asendorf pixel sorting: dramatic highlight-to-shadow vertical transitions.'
  };

  function getSavedApiKey() {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    } catch (e) {
      return '';
    }
  }

  function saveApiKey(key) {
    try {
      localStorage.setItem(API_KEY_STORAGE, (key || '').trim());
    } catch (e) {}
  }

  /**
   * Compila o prompt técnico estruturado a partir dos controles de Direção de Arte do Designer
   */
  function compileDesignerPrompt(config, activeEngineMode = 'ascii') {
    const subject = (config.prompt || '').trim() || 'Classical futuristic sculptural bust with geometric visor';
    const lighting = LIGHTING_DIRECTIVES[config.lighting] || LIGHTING_DIRECTIVES.chiaroscuro;
    const material = MATERIAL_DIRECTIVES[config.material] || MATERIAL_DIRECTIVES.marble;
    const lens = LENS_DIRECTIVES[config.lens] || LENS_DIRECTIVES.portrait_85mm;
    const bg = BG_DIRECTIVES[config.background] || BG_DIRECTIVES.pitch_black;
    const negative = (config.negative || '').trim();

    const parts = [
      `Subject & Concept: ${subject}.`,
      `Art Direction & Materiality: ${material}.`,
      `Lighting & Tonal Contrast: ${lighting}.`,
      `Camera & Framing: ${lens}.`,
      `Background Treatment: ${bg}.`
    ];

    if (config.optimizeForEngine && ENGINE_OPTIMIZATION_HINTS[activeEngineMode]) {
      parts.push(`Generative Pipeline Optimization: ${ENGINE_OPTIMIZATION_HINTS[activeEngineMode]}`);
    }

    if (config.mode === 'remix-source' || config.mode === 'remix-output') {
      parts.push(
        'Image-to-Image Instruction: Preserve the core composition, pose, and structural proportions of the reference image while transforming its lighting, surface material, and contrast according to this art direction.'
      );
    }

    if (negative) {
      parts.push(`Avoid / Negative Constraints: ${negative}.`);
    }

    return parts.join('\n');
  }

  function getTargetDimensions(aspectRatio) {
    if (aspectRatio === '1:1') return { width: 720, height: 720 };
    if (aspectRatio === '16:9') return { width: 880, height: 495 };
    if (aspectRatio === '3:4') return { width: 560, height: 746 };
    return { width: 760, height: 560 }; // 4:3 padrão
  }

  /**
   * Chama o motor Nano Banana / Gemini Image Generation API no navegador (100% compatível com CORS no Safari/Chrome/GitHub Pages).
   * Usa ?key= na URL sem cabeçalhos customizados que bloqueiam o preflight CORS ("Load failed"),
   * e descobre automaticamente os modelos de imagem disponíveis na chave do usuário.
   */
  async function generateWithNanoBananaApi(config, activeEngineMode, referenceCanvas) {
    const apiKey = (config.apiKey || getSavedApiKey()).trim();
    if (!apiKey) {
      throw new Error('Insira sua Gemini API Key (Google AI Studio) ou use o botão "Sintetizar Procedural Offline".');
    }

    saveApiKey(apiKey);
    const compiledPrompt = compileDesignerPrompt(config, activeEngineMode);
    const dims = getTargetDimensions(config.aspectRatio);
    const refForApi = config.mode !== 'text2img' ? referenceCanvas : null;

    // 1. Montar fila de modelos candidatos (incluindo descoberta dinâmica da conta do usuário)
    const defaultCandidates = [
      config.model,
      'gemini-2.5-flash-image',
      'gemini-2.5-flash-image-preview',
      'gemini-2.0-flash-preview-image-generation',
      'gemini-2.0-flash-exp-image-generation',
      'gemini-nano-banana-2.1',
      'gemini-3.1-flash-lite-image',
      'gemini-3-pro-image',
      'imagen-3.0-generate-002'
    ].filter((m) => m && m !== 'offline-synth' && m !== 'auto');

    // Descobrir modelos habilitados na chave do usuário via GET /v1beta/models
    let discoveredModels = [];
    try {
      discoveredModels = await discoverAvailableImageModels(apiKey);
    } catch (e) {}

    const allCandidates = [...new Set([...discoveredModels, ...defaultCandidates])];
    const errors = [];

    for (const rawModel of allCandidates) {
      const modelName = rawModel.replace(/^models\//, '');

      // Se for modelo da família Imagen (:predict)
      if (modelName.startsWith('imagen-') && !refForApi) {
        try {
          const imgCanvas = await callImagenPredictEndpoint(
            apiKey,
            modelName,
            compiledPrompt,
            config.aspectRatio,
            dims
          );
          return { canvas: imgCanvas, prompt: compiledPrompt, modelUsed: modelName };
        } catch (err) {
          errors.push(`${modelName}: ${err.message}`);
          continue;
        }
      }

      // Tentativa principal CORS-safe via :generateContent?key=...
      try {
        const imgCanvas = await callGeminiGenerateContentImage(
          apiKey,
          modelName,
          compiledPrompt,
          refForApi,
          dims
        );
        return { canvas: imgCanvas, prompt: compiledPrompt, modelUsed: modelName };
      } catch (err) {
        errors.push(`${modelName}: ${err.message}`);
      }

      // Tentativa secundária CORS-safe via /v1beta/interactions?key=... (sem headers bloqueados por preflight)
      try {
        const imgCanvas = await callGeminiInteractionsImage(
          apiKey,
          modelName,
          compiledPrompt,
          refForApi,
          config.aspectRatio,
          dims
        );
        return { canvas: imgCanvas, prompt: compiledPrompt, modelUsed: modelName };
      } catch (err) {}
    }

    const detailedErr = errors.find((e) => !e.includes('404') && !e.includes('not found')) || errors[0] || 'Verifique sua Gemini API Key.';
    throw new Error(detailedErr);
  }

  /**
   * Consulta GET /v1beta/models?key=... para descobrir quais modelos de geração de imagem estão ativos na chave do usuário
   */
  async function discoverAvailableImageModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return [];
    const data = await resp.json();
    const models = data.models || [];
    const found = [];

    for (const m of models) {
      const name = (m.name || '').replace(/^models\//, '');
      if (
        name.includes('image') ||
        name.includes('banana') ||
        name.includes('imagen') ||
        name === 'gemini-2.0-flash-exp'
      ) {
        found.push(name);
      }
    }
    return found;
  }

  /**
   * Chamada CORS-safe via Gemini Interactions API (POST /v1beta/interactions?key=...)
   * Sem headers não-padrão (como Api-Revision) que causam "TypeError: Load failed" no Safari/WebKit.
   */
  async function callGeminiInteractionsImage(apiKey, modelName, promptText, refCanvas, aspectRatio, dims) {
    const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`;

    const inputItems = [{ type: 'text', text: promptText }];
    if (refCanvas) {
      const dataUrl = refCanvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      inputItems.push({
        type: 'image',
        mime_type: 'image/png',
        data: base64Data
      });
    }

    const body = {
      model: modelName,
      input: inputItems,
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: aspectRatio || '4:3'
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let errMsg = `Erro HTTP ${resp.status}`;
      try {
        const errJson = await resp.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await resp.json();
    const interaction = data.interaction || data;

    if (interaction.output_image && interaction.output_image.data) {
      const mime = interaction.output_image.mime_type || 'image/png';
      return await base64ToCanvas(`data:${mime};base64,${interaction.output_image.data}`, dims.width, dims.height);
    }

    const steps = interaction.steps || [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item.type === 'image' && item.data) {
            const mime = item.mime_type || 'image/png';
            return await base64ToCanvas(`data:${mime};base64,${item.data}`, dims.width, dims.height);
          }
        }
      }
    }

    throw new Error(`O modelo ${modelName} não retornou uma imagem.`);
  }

  async function callGeminiGenerateContentImage(apiKey, modelName, promptText, refCanvas, dims) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const parts = [{ text: promptText }];

    if (refCanvas) {
      const dataUrl = refCanvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let errMsg = `Erro HTTP ${resp.status}`;
      try {
        const errJson = await resp.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await resp.json();
    const candidates = data.candidates || [];
    for (const cand of candidates) {
      const cParts = cand.content?.parts || [];
      for (const p of cParts) {
        const inline = p.inlineData || p.inline_data;
        if (inline && inline.data) {
          const mime = inline.mimeType || inline.mime_type || 'image/png';
          return await base64ToCanvas(`data:${mime};base64,${inline.data}`, dims.width, dims.height);
        }
      }
    }

    throw new Error(`O modelo ${modelName} não retornou um buffer de imagem.`);
  }

  async function callImagenPredictEndpoint(apiKey, modelName, promptText, aspectRatio, dims) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${encodeURIComponent(apiKey)}`;
    const body = {
      instances: [{ prompt: promptText }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio || '4:3'
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      let errMsg = `Erro Imagen HTTP ${resp.status}`;
      try {
        const errJson = await resp.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await resp.json();
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) {
      throw new Error('Imagen 3 não retornou bytesBase64Encoded.');
    }

    return await base64ToCanvas(`data:image/png;base64,${b64}`, dims.width, dims.height);
  }

  function base64ToCanvas(dataUrl, targetW, targetH) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        // Cover crop centralizado mantendo proporção sem distorcer
        const scale = Math.max(targetW / img.width, targetH / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const dx = (targetW - sw) * 0.5;
        const dy = (targetH - sh) * 0.5;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, dx, dy, sw, sh);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Falha ao decodificar imagem gerada'));
      img.src = dataUrl;
    });
  }

  /**
   * Gerador Procedural Paramétrico para Designers (100% Offline & Instantâneo)
   * Sintetiza composições de alto contraste baseadas exatamente nos controles de
   * Iluminação, Material, Lente, Fundo e Briefing quando offline ou sem API Key!
   */
  function generateProceduralDesignerCanvas(config, referenceCanvas) {
    const dims = getTargetDimensions(config.aspectRatio);
    const w = dims.width;
    const h = dims.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Semente baseada no texto do prompt + timestamp para permitir variações criativas
    const promptStr = (config.prompt || 'designer-synth') + ':' + (config.seed || Date.now());
    let hash = 2166136261;
    for (let i = 0; i < promptStr.length; i++) {
      hash ^= promptStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    let seed = Math.abs(hash) % 2147483646 + 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Paleta de iluminação procedural conforme escolha do Designer
    const isNeon = config.lighting === 'neon_cyber';
    const isHighKey = config.lighting === 'studio_highkey' || config.background === 'paper_white';
    const isRim = config.lighting === 'rimlight';
    const isSilhouette = config.lighting === 'silhouette';

    const keyColor = isNeon ? '#00f5d4' : '#ffffff';
    const midColor = isNeon ? '#7b2cbf' : isHighKey ? '#b8c0cc' : '#8d8880';
    const shadowColor = isNeon ? '#10002b' : isHighKey ? '#3e4452' : '#121318';

    // 1. Renderizar Fundo conforme Tratamento de Fundo
    if (config.background === 'paper_white') {
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, w, h);
    } else if (config.background === ' pitch_black' || config.background === 'pitch_black') {
      ctx.fillStyle = '#040507';
      ctx.fillRect(0, 0, w, h);
    } else if (config.background === 'radial_halo') {
      const bgG = ctx.createRadialGradient(w * 0.5, h * 0.48, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
      bgG.addColorStop(0, isNeon ? '#3c096c' : '#404858');
      bgG.addColorStop(0.55, '#141720');
      bgG.addColorStop(1, '#040507');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, w, h);

      // Anéis técnicos de direção de arte
      ctx.strokeStyle = isNeon ? 'rgba(0, 245, 212, 0.35)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.48, Math.min(w, h) * 0.36, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // env_depth: Grid arquitetônico em perspectiva
      const bgG = ctx.createLinearGradient(0, 0, 0, h);
      bgG.addColorStop(0, '#070910');
      bgG.addColorStop(0.55, '#1b2234');
      bgG.addColorStop(1, '#06070b');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = isNeon ? 'rgba(255, 42, 109, 0.28)' : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.2;
      const horizon = h * 0.58;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 22, horizon);
        ctx.lineTo(w * 0.5 + i * 130, h);
        ctx.stroke();
      }
      for (let j = 1; j <= 7; j++) {
        const y = horizon + Math.pow(j / 7, 1.7) * (h - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // Se estiver em modo Remix, mesclar e estilizar a imagem de referência com alto contraste
    if ((config.mode === 'remix-source' || config.mode === 'remix-output') && referenceCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.filter = isNeon
        ? 'contrast(155%) saturate(180%) hue-rotate(45deg)'
        : isSilhouette
        ? 'contrast(260%) grayscale(100%)'
        : 'contrast(145%) brightness(108%)';
      ctx.drawImage(referenceCanvas, 0, 0, w, h);
      ctx.restore();
    }

    const cx = w * 0.5;
    const cy = h * 0.49;
    const baseR = Math.min(w, h) * (config.lens === 'macro' ? 0.42 : config.lens === 'wide_24mm' ? 0.34 : 0.32);

    // 2. Renderizar Geometria Central de acordo com Material & Estética
    if (config.material === 'brutalist') {
      // Composição Brutalista / Bauhaus Arquitetônica
      const blocks = 7;
      for (let i = 0; i < blocks; i++) {
        const bw = baseR * (0.45 + rand() * 1.1);
        const bh = baseR * (0.45 + rand() * 1.1);
        const bx = cx + (rand() - 0.5) * baseR * 1.4 - bw * 0.5;
        const by = cy + (rand() - 0.5) * baseR * 1.2 - bh * 0.5;

        const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        g.addColorStop(0, isSilhouette ? '#050505' : keyColor);
        g.addColorStop(0.5, midColor);
        g.addColorStop(1, shadowColor);

        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);

        ctx.strokeStyle = isRim ? '#ffffff' : '#08090c';
        ctx.lineWidth = isRim ? 2.5 : 1.5;
        ctx.strokeRect(bx, by, bw, bh);

        // Escadaria ou grade interna brutalista
        if (i % 2 === 0) {
          ctx.fillStyle = '#08090d';
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            ctx.fillRect(bx + (bw / steps) * s, by + (bh / steps) * s, bw / (steps * 1.5), bh - (bh / steps) * s);
          }
        }
      }
    } else if (config.material === 'chrome' || config.material === 'cyber_mech') {
      // Esfera/Torus Biomecânico Cromado Especular com Anéis Orbitais
      const rings = 5;
      for (let r = rings; r >= 1; r--) {
        const rad = baseR * (0.35 + (r / rings) * 0.78);
        const tilt = (r - 2.5) * 0.28;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);

        const rg = ctx.createRadialGradient(-rad * 0.35, -rad * 0.35, rad * 0.05, 0, 0, rad);
        if (isNeon) {
          rg.addColorStop(0, '#ffffff');
          rg.addColorStop(0.25, '#00f5d4');
          rg.addColorStop(0.55, '#120826');
          rg.addColorStop(0.82, '#ff2a6d');
          rg.addColorStop(1, '#05030a');
        } else {
          rg.addColorStop(0, '#ffffff');
          rg.addColorStop(0.22, '#d8e2ec');
          rg.addColorStop(0.48, '#202630');
          rg.addColorStop(0.75, '#eef4f8');
          rg.addColorStop(1, '#0a0c10');
        }

        ctx.strokeStyle = rg;
        ctx.lineWidth = baseR * 0.14;
        ctx.beginPath();
        ctx.ellipse(0, 0, rad, rad * 0.58, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Núcleo Esférico Especular
      const coreR = baseR * 0.42;
      const cg = ctx.createRadialGradient(cx - coreR * 0.35, cy - coreR * 0.35, 3, cx, cy, coreR);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.4, midColor);
      cg.addColorStop(0.85, shadowColor);
      cg.addColorStop(1, isRim ? '#ffffff' : '#050608');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.material === 'botanical') {
      // Geometria Orgânica / Flor Macro com Sombreamento Profundo
      const petals = 18;
      for (let layer = 4; layer >= 1; layer--) {
        const lRad = baseR * (0.35 + layer * 0.22);
        for (let i = 0; i < petals; i++) {
          const ang = (i / petals) * Math.PI * 2 + layer * 0.18;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(ang);

          const pg = ctx.createLinearGradient(0, 0, lRad, 0);
          pg.addColorStop(0, shadowColor);
          pg.addColorStop(0.6, midColor);
          pg.addColorStop(1, keyColor);

          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(lRad * 0.55, -lRad * 0.22, lRad, 0);
          ctx.quadraticCurveTo(lRad * 0.55, lRad * 0.22, 0, 0);
          ctx.fill();
          ctx.strokeStyle = isRim ? keyColor : '#090b10';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      // Escultura Clássica / Retrato Editorial / Visor Futurista com Chiaroscuro
      const lightOffsetX = config.lighting === 'rimlight' ? 0 : -baseR * 0.38;
      const lightOffsetY = -baseR * 0.32;

      // Ombros / Busto
      const bustG = ctx.createRadialGradient(cx + lightOffsetX, cy + baseR * 0.8, 10, cx, cy + baseR * 1.1, baseR * 1.15);
      bustG.addColorStop(0, isSilhouette ? '#151515' : keyColor);
      bustG.addColorStop(0.5, midColor);
      bustG.addColorStop(1, shadowColor);
      ctx.fillStyle = bustG;
      ctx.beginPath();
      ctx.ellipse(cx, cy + baseR * 1.25, baseR * 1.05, baseR * 0.55, 0, Math.PI, 0, false);
      ctx.fill();

      // Cabeça Esculpida
      const headG = ctx.createRadialGradient(
        cx + lightOffsetX,
        cy + lightOffsetY,
        baseR * 0.08,
        cx,
        cy,
        baseR * 0.95
      );
      if (isSilhouette) {
        headG.addColorStop(0, '#0a0a0d');
        headG.addColorStop(0.88, '#14161d');
        headG.addColorStop(1, '#ffffff');
      } else {
        headG.addColorStop(0, keyColor);
        headG.addColorStop(0.45, midColor);
        headG.addColorStop(0.88, shadowColor);
        headG.addColorStop(1, isRim ? keyColor : '#07080c');
      }

      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.ellipse(cx, cy - baseR * 0.06, baseR * 0.58, baseR * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      // Visor Geométrico / Traços Faciais Esculturais de Alto Contraste
      const visorG = ctx.createLinearGradient(cx - baseR * 0.5, cy - baseR * 0.15, cx + baseR * 0.5, cy);
      visorG.addColorStop(0, isNeon ? '#ff2a6d' : '#11131a');
      visorG.addColorStop(0.5, '#ffffff');
      visorG.addColorStop(1, '#08090d');
      ctx.fillStyle = visorG;
      ctx.beginPath();
      ctx.roundRect(cx - baseR * 0.44, cy - baseR * 0.22, baseR * 0.88, baseR * 0.22, 8);
      ctx.fill();

      // Nariz & Lábios Esculpidos
      ctx.fillStyle = keyColor;
      ctx.beginPath();
      ctx.moveTo(cx, cy - baseR * 0.1);
      ctx.lineTo(cx - baseR * 0.1, cy + baseR * 0.22);
      ctx.lineTo(cx + baseR * 0.08, cy + baseR * 0.22);
      ctx.closePath();
      ctx.fill();

      // Halo / Geometria Sagrada flutuante ao redor
      ctx.strokeStyle = keyColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy - baseR * 0.08, baseR * 0.88, -Math.PI * 0.75, Math.PI * 0.25);
      ctx.stroke();
    }

    return {
      canvas,
      prompt: compileDesignerPrompt(config, 'ascii'),
      modelUsed: 'Procedural Synth Engine (Offline)'
    };
  }

  DegenLab.getSavedApiKey = getSavedApiKey;
  DegenLab.saveApiKey = saveApiKey;
  DegenLab.compileDesignerPrompt = compileDesignerPrompt;
  DegenLab.generateWithNanoBananaApi = generateWithNanoBananaApi;
  DegenLab.generateProceduralDesignerCanvas = generateProceduralDesignerCanvas;
})(window);
