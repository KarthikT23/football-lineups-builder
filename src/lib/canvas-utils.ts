export type ImageSource = HTMLImageElement | HTMLCanvasElement;

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number
) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function quadPath(
  ctx: CanvasRenderingContext2D,
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
) {
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
}

/** Draws `img` into the box, cropping (never stretching) to fill it completely — "background-size: cover". */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: ImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Draws `img` into the box scaled to fit entirely inside it (never cropped) and centered —
 * "background-size: contain". Used for the pitch photo so its goal boxes/corner arcs are never
 * clipped even when the box's aspect ratio doesn't exactly match the photo's; the caller should
 * paint the box's own background first, since any leftover strip on the wider axis shows through.
 */
export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: ImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let dw: number, dh: number;
  if (imgRatio > boxRatio) {
    dw = w;
    dh = dw / imgRatio;
  } else {
    dh = h;
    dw = dh * imgRatio;
  }
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * Resizes a canvas's backing store to match the device pixel ratio so text/lines stay crisp on
 * high-DPI screens, instead of the browser upscaling a lower-resolution bitmap to fill the CSS
 * display size (the cause of blurry text). Drawing code keeps using fixed logical units (e.g.
 * CANVAS_W/CORE_H) unmodified — this only changes the pixel grid underneath and applies a
 * matching transform so "10" still means "10 logical px" in every existing ctx call.
 */
export function syncCanvasDPR(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number
): CanvasRenderingContext2D | null {
  // Even on an ordinary (non-retina) screen, canvas-drawn text still looks softer than real
  // DOM/HTML text at 1x — canvas 2D text is grayscale-antialiased with no subpixel hinting, so
  // matching the screen's own DPI 1:1 isn't enough to match the sidebar's crispness. Rendering
  // at a minimum of 2x and letting the browser downscale it via CSS acts as supersampling and
  // reliably looks sharp regardless of the actual screen density.
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dpr = Math.max(rawDpr, 2);
  const targetW = Math.round(logicalW * dpr);
  const targetH = Math.round(logicalH * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Rotates an image 90° and mirrors it — turns a landscape turf photo into a portrait one that
 * matches the pitch shape, so it can be used as a single image rather than tiled or heavily cropped.
 */
export function rotateAndMirror(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.scale(-1, 1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c;
}

/** A small tileable grain texture, generated once and reused as a canvas fill pattern. */
export function makeGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const gctx = grain.getContext('2d')!;
  const idata = gctx.createImageData(128, 128);
  for (let i = 0; i < idata.data.length; i += 4) {
    const v = 128 + (Math.random() * 46 - 23);
    idata.data[i] = v;
    idata.data[i + 1] = v;
    idata.data[i + 2] = v;
    idata.data[i + 3] = 255;
  }
  gctx.putImageData(idata, 0, 0);
  return ctx.createPattern(grain, 'repeat');
}

/**
 * A muted, dusk-toned crowd/stand texture, generated once and cached — used behind the pitch
 * so the space outside the trapezoid reads as a stadium rather than an empty void or more grass.
 */
export function makeCrowdTexture(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1A2030');
  sky.addColorStop(0.45, '#141C18');
  sky.addColorStop(1, '#0B140E');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // distant crowd — a loose scatter of small muted dots in two bands (near each end of the pitch)
  const bands: Array<[number, number]> = [
    [0, h * 0.15],
    [h * 0.85, h],
  ];
  for (const [y0, y1] of bands) {
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w;
      const y = y0 + Math.random() * (y1 - y0);
      const r = 1 + Math.random() * 1.8;
      const tone = 55 + Math.random() * 75;
      const warmth = Math.random() * 12;
      ctx.fillStyle = `rgba(${tone + warmth},${tone},${tone + 10},${0.35 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** A simple floodlight tower silhouette with a warm glow — drawn directly, not cached. */
export function drawFloodlight(ctx: CanvasRenderingContext2D, x: number, baseY: number, scale = 1) {
  const rigW = 34 * scale;
  const rigH = 9 * scale;
  const poleH = 64 * scale;

  const glow = ctx.createRadialGradient(x, baseY - poleH, 2 * scale, x, baseY - poleH, 58 * scale);
  glow.addColorStop(0, 'rgba(231,163,57,0.30)');
  glow.addColorStop(1, 'rgba(231,163,57,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, baseY - poleH, 58 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#363B34';
  ctx.fillRect(x - 2 * scale, baseY - poleH, 4 * scale, poleH);
  ctx.fillRect(x - rigW / 2, baseY - poleH - rigH, rigW, rigH);

  ctx.fillStyle = '#FFE9B8';
  for (let i = 0; i < 4; i++) {
    const lx = x - rigW / 2 + 6 * scale + (i * (rigW - 12 * scale)) / 3;
    ctx.beginPath();
    ctx.arc(lx, baseY - poleH - rigH / 2, 1.6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
