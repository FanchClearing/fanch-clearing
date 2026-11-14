import { PALETTE } from './sprites.js';

/** 저해상도 canvas 컨텍스트 준비 (CSS로 확대, pixelated) */
export function setupCanvas(canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** 스프라이트(문자열 배열)를 그린다. palette는 { 글자: 색 }, 기본은 PALETTE */
export function drawSprite(ctx, sprite, x, y, scale = 1, palette = PALETTE) {
  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col += 1) {
      const color = palette[line[col]];
      if (!color) continue; // '.' 등 팔레트에 없는 글자는 투명
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x) + col * scale, Math.round(y) + row * scale, scale, scale);
    }
  }
}

/** 1픽셀 선 (Bresenham) */
export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** 시드 고정 난수 (그릴 때마다 같은 배경이 나오도록) */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
