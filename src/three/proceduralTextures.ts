/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

// Procedural texture generators using HTML5 2D Canvas - zero external file dependencies

/**
 * Procedural Earth Surface Texture with realistic NASA Blue Marble quality continents, coastal shelves, biomes, and ice caps
 */
export function createEarthSurfaceTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient with specular reflection depth
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#031429');
  oceanGrad.addColorStop(0.15, '#072445');
  oceanGrad.addColorStop(0.35, '#0a325c');
  oceanGrad.addColorStop(0.5, '#093c6f');
  oceanGrad.addColorStop(0.65, '#0a325c');
  oceanGrad.addColorStop(0.85, '#072445');
  oceanGrad.addColorStop(1, '#031429');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Shallow turquoise continental shelves along coastlines
  const drawContinentalShelf = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
    drawLandmass(ctx, cx, cy, rx * 1.08, ry * 1.08, 'rgba(14, 165, 233, 0.35)');
  };

  // Coastal shelves
  drawContinentalShelf(width * 0.22, height * 0.35, width * 0.16, height * 0.25);
  drawContinentalShelf(width * 0.32, height * 0.65, width * 0.11, height * 0.30);
  drawContinentalShelf(width * 0.52, height * 0.30, width * 0.12, height * 0.18);
  drawContinentalShelf(width * 0.53, height * 0.55, width * 0.14, height * 0.32);
  drawContinentalShelf(width * 0.72, height * 0.32, width * 0.22, height * 0.28);
  drawContinentalShelf(width * 0.82, height * 0.72, width * 0.10, height * 0.16);

  // North America (Green forests, Appalachian/Rockies mountains, desert southwest)
  drawLandmass(ctx, width * 0.22, height * 0.35, width * 0.16, height * 0.25, '#1e3a1f');
  drawLandmass(ctx, width * 0.18, height * 0.40, width * 0.06, height * 0.08, '#a16207'); // Southwest arid/desert

  // South America (Amazon rainforest green, Andes mountains ridge)
  drawLandmass(ctx, width * 0.32, height * 0.65, width * 0.11, height * 0.30, '#14532d');
  drawLandmass(ctx, width * 0.28, height * 0.70, width * 0.02, height * 0.22, '#78350f'); // Andes

  // Europe (Temperate green & Mediterranean coast)
  drawLandmass(ctx, width * 0.52, height * 0.30, width * 0.12, height * 0.18, '#166534');

  // Africa (Sahara golden desert, Congo rainforest, Savanna)
  drawLandmass(ctx, width * 0.53, height * 0.45, width * 0.15, height * 0.16, '#b45309'); // Sahara
  drawLandmass(ctx, width * 0.54, height * 0.62, width * 0.12, height * 0.18, '#14532d'); // Central Africa
  drawLandmass(ctx, width * 0.55, height * 0.76, width * 0.09, height * 0.12, '#854d0e'); // South Africa

  // Asia (Siberian taiga, Mongolian steppes & Gobi, Tibetan plateau, Southeast tropical)
  drawLandmass(ctx, width * 0.72, height * 0.24, width * 0.23, height * 0.14, '#0f3d1e'); // Siberia taiga
  drawLandmass(ctx, width * 0.73, height * 0.36, width * 0.14, height * 0.11, '#a16207'); // Mongolia & Gobi Desert
  drawLandmass(ctx, width * 0.69, height * 0.42, width * 0.08, height * 0.07, '#713f12'); // Tibetan Plateau
  drawLandmass(ctx, width * 0.75, height * 0.50, width * 0.15, height * 0.14, '#15803d'); // South/SE Asia
  drawLandmass(ctx, width * 0.64, height * 0.46, width * 0.08, height * 0.12, '#ca8a04'); // Middle East

  // Australia (Outback red desert & coastal green fringe)
  drawLandmass(ctx, width * 0.82, height * 0.72, width * 0.10, height * 0.16, '#9a3412');
  drawLandmass(ctx, width * 0.86, height * 0.74, width * 0.03, height * 0.12, '#15803d');

  // Realistic Polar Ice Caps with textured glacial shelf
  const arcticGrad = ctx.createLinearGradient(0, 0, 0, height * 0.09);
  arcticGrad.addColorStop(0, '#f8fafc');
  arcticGrad.addColorStop(0.7, '#e2e8f0');
  arcticGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
  ctx.fillStyle = arcticGrad;
  ctx.fillRect(0, 0, width, height * 0.09);

  const antarcticGrad = ctx.createLinearGradient(0, height * 0.91, 0, height);
  antarcticGrad.addColorStop(0, 'rgba(226, 232, 240, 0)');
  antarcticGrad.addColorStop(0.3, '#e2e8f0');
  antarcticGrad.addColorStop(1, '#ffffff');
  ctx.fillStyle = antarcticGrad;
  ctx.fillRect(0, height * 0.91, width, height * 0.09);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function drawLandmass(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const points = 48;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Multi-harmonic natural fractal coastline wobble
    const wobble = 1 + Math.sin(angle * 5) * 0.15 + Math.cos(angle * 9) * 0.09 + Math.sin(angle * 17) * 0.05;
    const x = cx + Math.cos(angle) * rx * wobble;
    const y = cy + Math.sin(angle) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Procedural Earth Cloud layer texture with realistic storms and weather bands
 */
export function createEarthCloudTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Cloud bands and swirl clusters
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  for (let i = 0; i < 65; i++) {
    const cx = Math.random() * width;
    const cy = height * 0.15 + Math.random() * height * 0.7;
    const rx = 35 + Math.random() * 110;
    const ry = 8 + Math.random() * 32;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (Math.random() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Intertropical Convergence Zone (ITCZ) equatorial cloud filament
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let x = 0; x < width; x += 30) {
    const y = height * 0.5 + Math.sin(x * 0.02) * 18;
    ctx.beginPath();
    ctx.ellipse(x, y, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // High-pressure cyclone spiral storms with arms
  for (let c = 0; c < 6; c++) {
    const cx = (c / 6) * width + Math.random() * 60;
    const cy = (c % 2 === 0 ? height * 0.28 : height * 0.72) + (Math.random() - 0.5) * 35;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let step = 0; step < 20; step++) {
        const theta = arm * (Math.PI * 2 / 3) + step * 0.28;
        const rad = step * 2.8;
        const px = cx + Math.cos(theta) * rad;
        const py = cy + Math.sin(theta) * rad;
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural Gold Multi-Layer Insulation (MLI) Thermal Blanket Texture
 */
export function createGoldMliTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base gold foil color
  ctx.fillStyle = '#d49b28';
  ctx.fillRect(0, 0, size, size);

  // Crinkle grid patterns and seams
  const gridSize = 64;
  ctx.strokeStyle = '#996515';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= size; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Subtle crinkle variations
  ctx.fillStyle = 'rgba(255, 230, 130, 0.18)';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 4 + Math.random() * 16;
    const h = 4 + Math.random() * 16;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/**
 * Procedural Silicon Solar Panel Texture with Wafer Cells & Metallic Grid Lines
 */
export function createSolarPanelTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep photovoltaic dark blue
  ctx.fillStyle = '#081736';
  ctx.fillRect(0, 0, size, size);

  // Individual silicon solar cells
  const cellSize = 64;
  const padding = 3;

  for (let x = 0; x < size; x += cellSize) {
    for (let y = 0; y < size; y += cellSize) {
      // Cell background with subtle crystal gradient
      const cellGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      cellGrad.addColorStop(0, '#0f2b60');
      cellGrad.addColorStop(0.5, '#133575');
      cellGrad.addColorStop(1, '#091c42');
      ctx.fillStyle = cellGrad;
      ctx.fillRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2);

      // Fine silver gridlines
      ctx.strokeStyle = 'rgba(200, 225, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let gx = x + 8; gx < x + cellSize - 8; gx += 12) {
        ctx.beginPath();
        ctx.moveTo(gx, y + padding);
        ctx.lineTo(gx, y + cellSize - padding);
        ctx.stroke();
      }

      // Main thick busbar
      ctx.strokeStyle = 'rgba(240, 248, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + cellSize / 2, y + padding);
      ctx.lineTo(x + cellSize / 2, y + cellSize - padding);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Procedural Spacecraft Hull Panel Texture (Titanium / Carbon with Panel Lines)
 */
export function createHullPanelTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#222938';
  ctx.fillRect(0, 0, size, size);

  // Panel lines
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.strokeRect(size / 2, 4, size / 2 - 4, size - 8);

  // Rivets / Fasteners along seams
  ctx.fillStyle = '#64748b';
  for (let i = 16; i < size; i += 32) {
    ctx.beginPath();
    ctx.arc(i, 8, 2, 0, Math.PI * 2);
    ctx.arc(i, size - 8, 2, 0, Math.PI * 2);
    ctx.arc(8, i, 2, 0, Math.PI * 2);
    ctx.arc(size - 8, i, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Mongolian National Flag Texture with authentic Soyombo emblem
 */
export function createMongolianFlagTexture(): THREE.CanvasTexture {
  const width = 600;
  const height = 300;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const colWidth = width / 3;

  // Red - Blue - Red Triband
  ctx.fillStyle = '#da291c'; // Mongolian Red
  ctx.fillRect(0, 0, colWidth, height);

  ctx.fillStyle = '#0055b8'; // Eternal Blue Sky
  ctx.fillRect(colWidth, 0, colWidth, height);

  ctx.fillStyle = '#da291c'; // Mongolian Red
  ctx.fillRect(colWidth * 2, 0, colWidth, height);

  // Golden Soyombo symbol on the hoist (left red stripe)
  const cx = colWidth / 2;
  const cy = height / 2;

  ctx.fillStyle = '#ffd700'; // Gold
  ctx.strokeStyle = '#ffd700';

  // 1. Fire / Flame at top (3 tongues: past, present, future)
  ctx.beginPath();
  ctx.arc(cx, cy - 85, 14, 0, Math.PI * 2);
  ctx.arc(cx - 15, cy - 78, 9, 0, Math.PI * 2);
  ctx.arc(cx + 15, cy - 78, 9, 0, Math.PI * 2);
  ctx.fill();

  // 2. Sun and Moon (eternity of the Mongolian nation)
  // Moon crescent
  ctx.beginPath();
  ctx.arc(cx, cy - 50, 18, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  // Sun circle
  ctx.beginPath();
  ctx.arc(cx, cy - 56, 11, 0, Math.PI * 2);
  ctx.fill();

  // 3. Top and Bottom Arrow Triangles (pointing down/up to vanquish enemies)
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 32);
  ctx.lineTo(cx + 24, cy - 32);
  ctx.lineTo(cx, cy - 14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 32);
  ctx.lineTo(cx + 24, cy + 32);
  ctx.lineTo(cx, cy + 14);
  ctx.closePath();
  ctx.fill();

  // 4. Two horizontal bars (honesty and fairness)
  ctx.fillRect(cx - 28, cy - 10, 56, 6);
  ctx.fillRect(cx - 28, cy + 4, 56, 6);

  // 5. Taijitu fish (vigilance - fish never close their eyes)
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 12, 0, Math.PI * 2);
  ctx.fill();

  // 6. Two vertical side bars (fortress of unity: two friends are stronger than stone walls)
  ctx.fillRect(cx - 36, cy - 36, 6, 76);
  ctx.fillRect(cx + 30, cy - 36, 6, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Rocket Booster Decal with Mongolian Flag & QUASAR Stencil
 */
export function createRocketDecalTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Clean white base
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Mongolian flag banner
  const flagW = 240;
  const flagH = 120;
  const fx = (width - flagW) / 2;
  const fy = 60;

  ctx.fillStyle = '#da291c';
  ctx.fillRect(fx, fy, flagW / 3, flagH);
  ctx.fillStyle = '#0055b8';
  ctx.fillRect(fx + flagW / 3, fy, flagW / 3, flagH);
  ctx.fillStyle = '#da291c';
  ctx.fillRect(fx + (flagW / 3) * 2, fy, flagW / 3, flagH);

  // Soyombo icon
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(fx + flagW / 6, fy + flagH / 2, 16, 0, Math.PI * 2);
  ctx.fill();

  // Black Aerospace Typography
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QUASAR', width / 2, 230);

  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#0284c7';
  ctx.fillText('MONGOLIA', width / 2, 260);

  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('ORBITAL GUARDIAN // CH-13', width / 2, 290);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Earth Night City Lights Texture (golden clusters on continents)
 */
export function createEarthNightTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep black space
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Helper to sprinkle glowing golden city light dots
  const addCityCluster = (cx: number, cy: number, radius: number, density: number) => {
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 1.5) * radius;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      const r = Math.random();
      if (r < 0.7) {
        ctx.fillStyle = 'rgba(255, 205, 95, 0.85)';
        ctx.fillRect(x, y, 1.5, 1.5);
      } else {
        ctx.fillStyle = 'rgba(255, 235, 175, 0.95)';
        ctx.fillRect(x, y, 2.5, 2.5);
      }
    }
  };

  // Major global metropolitan corridors
  // North America (East Coast, Midwest, California)
  addCityCluster(width * 0.28, height * 0.35, 75, 260);
  addCityCluster(width * 0.22, height * 0.38, 55, 180);
  addCityCluster(width * 0.17, height * 0.38, 45, 140);

  // Western Europe
  addCityCluster(width * 0.51, height * 0.30, 60, 320);
  addCityCluster(width * 0.54, height * 0.35, 45, 180);

  // East Asia & Japan & Ulaanbaatar/Central Asia
  addCityCluster(width * 0.78, height * 0.36, 70, 350); // East China
  addCityCluster(width * 0.84, height * 0.35, 35, 220); // Japan
  addCityCluster(width * 0.74, height * 0.28, 25, 90);  // Ulaanbaatar & Trans-Mongolian rail corridor
  addCityCluster(width * 0.71, height * 0.48, 55, 240); // India

  // South America & Australia coastal hubs
  addCityCluster(width * 0.36, height * 0.70, 45, 140);
  addCityCluster(width * 0.86, height * 0.75, 35, 110);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural Moon Surface Texture with realistic impact craters and lunar maria
 */
export function createMoonTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Highland grey base
  ctx.fillStyle = '#b8bec8';
  ctx.fillRect(0, 0, width, height);

  // Dark basalt Lunar Maria (Oceanus Procellarum, Sea of Tranquility, etc.)
  const drawMare = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.fillStyle = 'rgba(70, 75, 85, 0.7)';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const wobble = 0.85 + Math.sin(angle * 4) * 0.15 + Math.cos(angle * 7) * 0.1;
      const x = cx + Math.cos(angle) * rx * wobble;
      const y = cy + Math.sin(angle) * ry * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };

  drawMare(width * 0.35, height * 0.4, 110, 75);
  drawMare(width * 0.52, height * 0.42, 85, 60);
  drawMare(width * 0.45, height * 0.58, 65, 50);

  // Impact craters with raised white rims and dark shadows
  for (let i = 0; i < 90; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 3 + Math.random() * 16;

    // Rim highlight
    ctx.strokeStyle = 'rgba(240, 245, 255, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx - 0.8, cy - 0.8, r, 0, Math.PI * 2);
    ctx.stroke();

    // Crater pit
    ctx.fillStyle = 'rgba(45, 50, 58, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Central peak for large craters
    if (r > 10) {
      ctx.fillStyle = 'rgba(230, 235, 245, 0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Procedural NASA JWST / Hubble Neon Pink & Magenta Cosmic Nebula Texture
 * Generates an awe-inspiring deep space cosmic vista with glowing pink gas clouds,
 * stellar nurseries, ionization shockfronts, and embedded jewel-like stars.
 */
export function createNeonPinkNebulaTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Cosmic Void Background (Deep velvet violet & dark indigo)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060212');
  bgGrad.addColorStop(0.3, '#0d0322');
  bgGrad.addColorStop(0.5, '#14042f');
  bgGrad.addColorStop(0.7, '#0f0224');
  bgGrad.addColorStop(1, '#060212');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Helper for rendering glowing volumetric nebula dust clouds
  const drawGlowingNebulaCloud = (
    cx: number, 
    cy: number, 
    radius: number, 
    innerColor: string, 
    midColor: string, 
    outerColor: string
  ) => {
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.4, midColor);
    grad.addColorStop(0.75, outerColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // 2. Vast NASA Carina/Webb Neon Pink & Magenta Hydrogen Gas Clouds
  // Main cosmic nebula ridge (running diagonally across the sky)
  drawGlowingNebulaCloud(width * 0.28, height * 0.42, 420, 'rgba(251, 113, 133, 0.75)', 'rgba(244, 63, 94, 0.45)', 'rgba(217, 70, 239, 0.15)');
  drawGlowingNebulaCloud(width * 0.42, height * 0.35, 360, 'rgba(244, 114, 182, 0.70)', 'rgba(236, 72, 153, 0.40)', 'rgba(168, 85, 247, 0.12)');
  drawGlowingNebulaCloud(width * 0.65, height * 0.55, 480, 'rgba(244, 63, 94, 0.65)', 'rgba(225, 29, 72, 0.38)', 'rgba(147, 51, 234, 0.14)');
  drawGlowingNebulaCloud(width * 0.78, height * 0.48, 380, 'rgba(236, 72, 153, 0.60)', 'rgba(217, 70, 239, 0.35)', 'rgba(126, 34, 206, 0.10)');

  // Secondary glowing neon violet / purple pillar formations
  drawGlowingNebulaCloud(width * 0.18, height * 0.68, 320, 'rgba(192, 132, 252, 0.55)', 'rgba(168, 85, 247, 0.30)', 'rgba(107, 33, 168, 0.08)');
  drawGlowingNebulaCloud(width * 0.88, height * 0.25, 300, 'rgba(244, 63, 94, 0.50)', 'rgba(236, 72, 153, 0.25)', 'rgba(88, 28, 135, 0.06)');

  // Contrasting electric cyan / teal stellar ionization fronts (classic NASA Webb contrast)
  drawGlowingNebulaCloud(width * 0.36, height * 0.58, 220, 'rgba(56, 189, 248, 0.45)', 'rgba(14, 165, 233, 0.22)', 'rgba(2, 132, 199, 0.05)');
  drawGlowingNebulaCloud(width * 0.55, height * 0.28, 260, 'rgba(125, 211, 252, 0.40)', 'rgba(56, 189, 248, 0.20)', 'rgba(3, 105, 161, 0.04)');

  // 3. Intricate filamentary cosmic dust ribbons & organic wisps
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.filter = 'blur(12px)';

  for (let w = 0; w < 16; w++) {
    const sx = (w / 16) * width + (Math.random() - 0.5) * 120;
    const sy = height * 0.25 + (Math.random() - 0.5) * 200;
    ctx.strokeStyle = w % 2 === 0 ? 'rgba(251, 113, 133, 0.35)' : 'rgba(217, 70, 239, 0.28)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(
      sx + 120, sy - 80,
      sx + 240, sy + 90,
      sx + 380, sy + 30
    );
    ctx.stroke();
  }

  ctx.filter = 'none'; // reset filter

  // 4. Brilliant Embedded Stars & Stellar Nurseries with JWST 6-Point Diffraction Spikes
  const drawJwstStar = (x: number, y: number, radius: number, glowColor: string) => {
    // Star core glow
    const starGlow = ctx.createRadialGradient(x, y, 0, x, y, radius * 6);
    starGlow.addColorStop(0, '#ffffff');
    starGlow.addColorStop(0.3, glowColor);
    starGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = starGlow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 6, 0, Math.PI * 2);
    ctx.fill();

    // 6-Point Diffraction Spikes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 3; s++) {
      const ang = (s / 3) * Math.PI;
      const len = radius * 12;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  };

  // Major hero stars in the nebula
  drawJwstStar(width * 0.32, height * 0.38, 3.5, 'rgba(254, 205, 211, 0.9)');
  drawJwstStar(width * 0.45, height * 0.32, 2.8, 'rgba(186, 230, 253, 0.9)');
  drawJwstStar(width * 0.62, height * 0.52, 4.0, 'rgba(254, 215, 170, 0.95)');
  drawJwstStar(width * 0.76, height * 0.44, 3.0, 'rgba(244, 114, 182, 0.9)');
  drawJwstStar(width * 0.22, height * 0.65, 2.5, 'rgba(192, 132, 252, 0.85)');

  // 5. Dense Background Star Clusters (hundreds of sharp pinpoint stars)
  for (let s = 0; s < 450; s++) {
    const sx = Math.random() * width;
    const sy = Math.random() * height;
    const sr = Math.random() * 1.4 + 0.3;
    const starRnd = Math.random();
    const sColor = starRnd < 0.45 ? '#ffffff' : starRnd < 0.75 ? '#fda4af' : '#7dd3fc';
    ctx.fillStyle = sColor;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}


