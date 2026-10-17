// Наповнення з Майстерні: JSON-файли на сайті (public/data/*.json).
// Розширення читає їх під час відкриття й тримає останню копію в браузері — на випадок, якщо сайт недоступний.

export const SITE = (() => {
  try { return new URL(import.meta.env.BASE_URL || "/atmosfera/", location.origin).href; }
  catch { return "https://treyser.github.io/atmosfera/"; }
})();

// картинка: повна адреса як є, відносна — від сайту «Атмосфери»
export const art = (p) => (!p ? "" : /^(https?:|data:|blob:)/.test(p) ? p : SITE + String(p).replace(/^\/+/, ""));

const KEY = (k) => `atmosfera.content.${k}`;
export function cachedContent(kind) {
  try { return JSON.parse(localStorage.getItem(KEY(kind)) || "null"); } catch { return null; }
}

// свіжа копія (кеш сайту обходимо щохвилини), інакше — збережена
const pending = {};
export function loadContent(kind) {
  if (pending[kind]) return pending[kind];
  pending[kind] = (async () => {
    try {
      const r = await fetch(`${SITE}data/${kind}.json?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-cache" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      try { localStorage.setItem(KEY(kind), JSON.stringify(j)); } catch { /* немає місця — не біда */ }
      return j;
    } catch {
      return cachedContent(kind);
    } finally {
      setTimeout(() => { delete pending[kind]; }, 5000);
    }
  })();
  return pending[kind];
}

// Злиття «книги з Майстерні» з локальною копією майстра.
// Перемагає новіша правка: rev — час правки в Майстерні, _at — час правки в самому Owlbear.
// Повертає true, якщо локальний список змінився.
export function mergeBase(local, base, removed = [], fix = (x) => x) {
  let changed = false;
  for (const raw of base) {
    const b = fix(raw);
    const i = local.findIndex((x) => x.id === b.id);
    if (i < 0) {
      local.push({ ...b, _rev: b.rev ?? 0, _base: true });
      changed = true;
      continue;
    }
    const l = local[i];
    if (l._rev === undefined) {
      // копія, зроблена ще до Майстерні: нічого не перезаписуємо, лише дописуємо порожні поля
      for (const [k, v] of Object.entries(b)) if ((l[k] === undefined || l[k] === "") && v !== "" && v != null) l[k] = v;
      l._rev = b.rev ?? 0;
      changed = true;
      continue;
    }
    if ((b.rev ?? 0) <= l._rev) continue;
    if ((l._at ?? 0) > (b.rev ?? 0)) { l._rev = b.rev; changed = true; continue; }   // майстер правив у грі пізніше
    local[i] = { ...l, ...b, _rev: b.rev ?? 0, _base: true };
    changed = true;
  }
  for (const id of removed) {
    const i = local.findIndex((x) => x.id === id);
    if (i >= 0 && !((local[i]._at ?? 0) > (local[i]._rev ?? 0))) { local.splice(i, 1); changed = true; }
  }
  return changed;
}
