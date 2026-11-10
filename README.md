# 线条成像 · Lineform Lab

A browser-based procedural line study inspired by SUPERWORLD's “HOUDINI 教程｜如何绘制动态螺旋线”.

## Experience

A native browser animation studio with four interchangeable drawing styles: elliptical spirals, flowing waves, breathing dots, and drifting dashes. The image source and drawing style are independent. Presets include a hand, butterfly, ginkgo leaf, typography, and a shaded sphere; users can also import an image locally. Images stay in the browser and are never uploaded to a server. PNG exports are rendered at 2400 × 2400, and SVG exports retain editable paths or circles.

## Mouse interaction

The pointer creates a smooth local repulsion or attraction field. Moving away lets the geometry return to its original shape. Interaction continues to work with automatic motion paused or at zero speed. Pointer coordinates are mapped through the centered square drawing area using CSS pixels, independently of display DPR. Touch input supports tapping while preserving vertical page scrolling.

The interface presents live artwork controls instead of a video timeline. The underlying renderer retains source-media support, but the user-facing importer is intentionally focused on static images that become animated procedural drawings.

## Geometry

Each horizontal path is sampled with parameter `u`. A brightness mask `m(u,y,t)` controls both axes:

```
x = u + rx * m * cos(theta)
y = rowY + ry * m * sin(theta)
```

The horizontal derivative can become negative, giving actual back-looping coils. A y-only sine wave would not produce this shape. Low mask values preserve flat lines. This is an independent browser implementation of the visual principle; it does not run Houdini or reproduce its node network.

## Development

The application uses the supplied Vinext / Vite framework with React and Canvas2D. The renderer is isolated in `lib/spiral-renderer.js`; the React page owns the controls, pointer event binding, and local image lifecycle. Continuous paths, circles, and short paths use shared geometry for the canvas, PNG, and SVG outputs. Local flat-path compression retains enough vertices around an active pointer to bend empty regions accurately.

```
npm install
npm run dev
npm run build
```

Reference: https://xhslink.cn/o/17FlIYE0rch
