# DEGEN // LAB v4.0 PRO STUDIO — Estúdio de Arte Generativa & Sintetizador Visual

Aplicação web completa para transformar **fotos**, **vídeos** ou **webcam ao vivo** em **12 estilos de arte generativa/degenerativa**, com **layout Dual-Sidebar**, **animação a 60 FPS**, **sintetizador reativo a áudio (VJ)**, **Rack de Pós-Efeitos Global (Post-FX)**, **exportação SVG vetorial**, **Sprite Sheet 6×** e **gravação de vídeo (`.webm`) com timer de loop**.

---

## Como Executar Localmente (Mac ou Windows)

- **Modo Modular:** Abra `index.html` diretamente no navegador (Chrome, Edge, Brave ou Firefox) ou sirva via HTTP (`python3 -m http.server 8080`).
- **Modo Portátil (Arquivo Único):** Abra `DEGEN-LAB-v4-Portable.html` diretamente em qualquer navegador — todos os estilos e motores já estão embutidos nele.

---

## Como Publicar no GitHub Pages (Deixar Sempre Online)

Este diretório já está inicializado como um repositório **Git** na branch `main` (com `.nojekyll` e workflow de GitHub Pages configurados). Para colocar no ar:

1. Crie um novo repositório vazio no seu GitHub (ex: `degen-lab`).
2. No terminal (dentro desta pasta), conecte o repositório remoto e envie os arquivos:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/degen-lab.git
   git push -u origin main
   ```
3. No GitHub, acesse a aba **Settings → Pages** do repositório:
   - Em **Build and deployment → Source**, selecione **Deploy from a branch** (branch `main`, pasta `/ (root)`) **ou** **GitHub Actions**.
4. Em poucos segundos, sua ferramenta estará online em:
   `https://SEU-USUARIO.github.io/degen-lab/`

---

## Estrutura de Arquivos do Projeto

```text
DEGEN-LAB/
├── index.html                  # Aplicação principal (Layout Dual-Sidebar v4.0)
├── styles.css                  # Design System industrial escuro
├── DEGEN-LAB-v4-Portable.html  # Versão portátil em arquivo único (100% offline)
├── DEGEN-LAB-v4-Studio.zip     # Pacote compactado do projeto
├── .gitignore                  # Regras de exclusão Git (macOS / Windows)
├── .nojekyll                   # Otimização para publicação estática no GitHub Pages
├── .github/workflows/pages.yml # Workflow de deploy automático para GitHub Pages
└── js/
    ├── app.js                  # Controlador principal, presets, undo, zoom/pan e atalhos
    ├── preprocess.js           # LUT de brilho/contraste/gamma, sharpen 3x3 e amostras
    ├── postfx.js               # Histograma ao vivo, Duotone Universal, Bloom e Lente CRT
    ├── audio.js                # Sintetizador reativo a áudio (Synth Beat 122 BPM, Mic e MP3)
    ├── exporters.js            # Exportação PNG, SVG, TXT, HTML, Sprite 6x e Vídeo WebM
    └── engines/                # Os 12 Motores Generativos
        ├── ascii.js            # 01. ASCII Art
        ├── bitmap.js           # 02. Bitmap 1-Bit & Multi-Paleta (GameBoy, CGA, PICO-8, C64)
        ├── halftone.js         # 03. Halftone / Retícula & CMYK Offset
        ├── lumamesh.js         # 04. Luma Mesh 3D (Light Grid + SVG)
        ├── plexus.js           # 05. Plexus / Voronoi Constellation (+ SVG)
        ├── waves.js            # 06. Osciloscópio / Rutt-Etra Wave Lines (+ SVG)
        ├── datamosh.js         # 07. Data Mosh (P-Frame Motion Glitch)
        ├── feedback.js         # 08. Feedback Loop (Temporal Motion Trails)
        ├── vhs.js              # 09. VHS Analog Tape Deck (NTSC Chroma Bleed & OSD)
        ├── decimate.js         # 10. Decimate (Multi-Pass Quadtree & XOR + SVG)
        ├── glitch.js           # 11. Glitch Digital & CRT
        └── pixelsort.js        # 12. Pixel Sorting
```
