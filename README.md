# Lineform Lab / 线条成像实验室

A browser-native interactive generative-art playground inspired by the Houdini animated spiral-line technique.

**No video is used as the output/background.** Shapes are redrawn in real time using Canvas 2D, animated by code, and respond to pointer hover.

## Features

- Four rendering modes: **Spiral**, **Wave**, **Dots**, **Strokes**.
- Five built-in subjects: **Hand**, **Butterfly**, **Ginkgo**, **Sphere**, **Custom text**.
- Import your own PNG/JPEG/WebP/SVG image (including transparent logos), or a video as the *source mask*.
- Hover interactions: **Repel**, **Attract**, **Off**, with adjustable radius and strength.
- Live controls for density, amplitude, frequency, motion speed, and contrast.
- Pause auto-animation without disabling hover.
- Export 2400 × 2400 PNG and editable SVG vectors.
- Responsive layout. No dependencies, trackers, external fonts, or build step.

## Run

Open `index.html` in a browser, or run a local server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Project layout

```
index.html       # Interface and controls
src/styles.css   # Visual design and responsive layout
src/main.js      # Image-mask sampling, real-time drawing, hover, export
```

## Background

This repository contains a **standalone source implementation** of the interactive Lineform concept. It was reconstructed for GitHub from the published experience and requirements rather than exported byte-for-byte from the original Sites authoring environment.

Originally explored from the Houdini tutorial: https://xhslink.cn/o/17FlIYE0rch

Live concept: https://spiral-image-lab.brisk-corgi-8205.chatgpt.site

No license has been assigned; copyright remains with its respective owners.
