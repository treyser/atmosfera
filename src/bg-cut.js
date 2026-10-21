// Прибирання фону в Майстерні — усе в браузері, нічого нікуди не надсилається.
// 1) cutToken — для круглих токенів на однотонному тлі: заливка від країв, миттєво.
// 2) cutAI — нейромережа (@imgly/background-removal, AGPL): будь-яка картинка; модель ~40 МБ
//    завантажується один раз, далі береться з кешу браузера.

const dist = (d, i, r, g, b) => Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);

// фон — від країв углиб, поки колір схожий і на сусіда, і на тло; кільце токена — природна межа
export function cutToken(src, tol = 40) {
  const w = src.width, h = src.height;
  const ctx = src.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // колір тла — медіана рамки
  const edge = [];
  for (let x = 0; x < w; x += 4) edge.push((x) * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += 4) edge.push((y * w) * 4, (y * w + w - 1) * 4);
  const med = (k) => edge.map((i) => d[i + k]).sort((a, b) => a - b)[edge.length >> 1];
  const [R, G, B] = [med(0), med(1), med(2)];
  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (p) => { if (!bg[p] && dist(d, p * 4, R, G, B) < tol * 2.2) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q < 0 || bg[q]) continue;
      if (dist(d, q * 4, d[p * 4], d[p * 4 + 1], d[p * 4 + 2]) < tol * 0.6 && dist(d, q * 4, R, G, B) < tol * 2.2) { bg[q] = 1; stack.push(q); }
    }
  }
  // м'який край: альфа — частка «не тла» в околі 3×3
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let n = 0, s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        n++; s += bg[yy * w + xx] ? 0 : 1;
      }
      d[p * 4 + 3] = Math.round((d[p * 4 + 3] * s) / n);
    }
  }
  ctx.putImageData(img, 0, 0);
  return trimSquare(src);
}

// обрізати прозорі краї й лишити квадрат по центру (токен заповнює картинку)
export function trimSquare(src, pad = 0.015) {
  const w = src.width, h = src.height;
  const d = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return src;   // усе прозоре — щось пішло не так, лишаємо як було
  const side = Math.ceil(Math.max(x1 - x0 + 1, y1 - y0 + 1) * (1 + pad * 2));
  const out = document.createElement("canvas");
  out.width = out.height = side;
  out.getContext("2d").drawImage(src, Math.round((side - (x1 - x0 + 1)) / 2) - x0, Math.round((side - (y1 - y0 + 1)) / 2) - y0);
  return out;
}

// частка прозорого: чи взагалі щось вирізали
export function cutShare(c) {
  const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  let t = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 128) t++;
  return t / (d.length / 4);
}

let lib = null;
export async function cutAI(src, onProgress = () => {}) {
  lib ??= import("@imgly/background-removal");
  const { removeBackground } = await lib;
  const blob = await new Promise((r) => src.toBlob(r, "image/png"));
  const out = await removeBackground(blob, {
    model: "isnet_fp16",
    output: { format: "image/png" },
    progress: (key, cur, total) => { if (/fetch/.test(key) && total) onProgress(`Завантажую модель (раз назавжди): ${Math.round((cur / total) * 100)}%`); },
  });
  const bmp = await createImageBitmap(out);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d").drawImage(bmp, 0, 0);
  return c;
}
