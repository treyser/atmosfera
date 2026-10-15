// Ефекти зон: шейдери, що заповнюють межі намальованої фігури.
// Кожен клієнт малює їх у себе (ефекти в Owlbear лише локальні), фігура в сцені — спільна.
// Owlbear сам підставляє size і time і обрізає ефект по фігурі. Координати йдуть від точки прив'язки фігури
// (у кола це центр), тому габарити box і зсув off рахуємо самі; shape (0 — прямокутник, 1 — коло), ghost — яскравість.

const HEAD = `
uniform vec2 size;
uniform float time;
uniform float shape;
uniform float ghost;
uniform float seed;
uniform vec2 box;   // розмір фігури (габарити) у її власних одиницях
uniform vec2 off;   // зсув від точки прив'язки фігури до її лівого верхнього кута

float now() { return mod(time, 3600.0); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// М'який край: коло для круглих фігур, заокруглений прямокутник для решти
float edge(vec2 uv) {
  if (shape > 0.5) {
    float d = length(uv - 0.5) * 2.0;
    return 1.0 - smoothstep(0.78, 1.0, d);
  }
  vec2 e = min(uv, 1.0 - uv);
  return smoothstep(0.0, 0.09, min(e.x, e.y));
}

vec4 over(vec4 dst, vec3 color, float a) {
  return vec4(color * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a));
}
`;

const FOG = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 110.0 + seed;
  float t = now();
  float n = fbm(p + vec2(t * 0.05, t * 0.018));
  float n2 = fbm(p * 1.9 - vec2(t * 0.03, -t * 0.02));
  float a = smoothstep(0.28, 0.85, n * 0.7 + n2 * 0.45) * 0.88 * edge(uv) * ghost;
  return half4(vec3(0.80, 0.83, 0.86) * a, a);
}`;

const FIRE = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 70.0 + seed;
  float t = now();
  float n = fbm(vec2(p.x * 1.2, p.y * 0.9 + t * 1.5));
  float n2 = fbm(p * 2.3 + vec2(0.0, t * 2.3));
  float f = n * 0.65 + n2 * 0.5;
  float m = edge(uv) * ghost;
  float flick = 0.85 + 0.15 * sin(t * 13.0 + p.x * 3.0);
  vec4 col = vec4(vec3(0.55, 0.10, 0.02) * 0.28 * m, 0.28 * m);  // жар під полум'ям
  vec3 c = mix(vec3(0.90, 0.16, 0.02), vec3(1.0, 0.72, 0.18), smoothstep(0.55, 0.85, f));
  c = mix(c, vec3(1.0, 0.95, 0.72), smoothstep(0.82, 0.97, f));
  col = over(col, c, clamp(smoothstep(0.30, 0.72, f) * 0.92 * flick * m, 0.0, 1.0));
  // іскри
  vec2 g = vec2(p.x * 3.0, p.y * 3.0 + t * 4.0);
  float spark = step(0.985, hash(floor(g))) * (1.0 - smoothstep(0.0, 0.25, length(fract(g) - 0.5)));
  col = over(col, vec3(1.0, 0.85, 0.4), spark * m);
  return half4(col);
}`;

const POISON = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 95.0 + seed;
  float t = now();
  vec2 q = vec2(fbm(p + vec2(t * 0.08, 0.0)), fbm(p + vec2(5.2, t * 0.07)));
  float n = fbm(p + q * 2.2 + vec2(t * 0.04));
  float a = smoothstep(0.22, 0.72, n) * 0.8 * edge(uv) * ghost;
  vec3 c = mix(vec3(0.20, 0.42, 0.08), vec3(0.62, 0.82, 0.18), smoothstep(0.45, 0.85, n));
  vec4 col = vec4(c * a, a);
  // бульбашки
  vec2 g = p * 2.5 + vec2(0.0, -t * 0.4);
  float r = length(fract(g) - 0.5);
  float b = step(0.93, hash(floor(g))) * (1.0 - smoothstep(0.24, 0.32, r)) * smoothstep(0.18, 0.24, r);
  col = over(col, vec3(0.75, 0.95, 0.35), b * 0.8 * edge(uv) * ghost);
  return half4(col);
}`;

const DARK = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 120.0 + seed;
  float t = now();
  float n = fbm(p * 1.3 + vec2(t * 0.03, -t * 0.02));
  float m = edge(uv) * ghost;
  float a = (0.9 + 0.08 * n) * m;
  vec3 c = mix(vec3(0.02, 0.01, 0.04), vec3(0.16, 0.05, 0.24), smoothstep(0.55, 0.8, n) * 0.6);
  return half4(c * a, a);
}`;

const ICE = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 60.0 + seed;
  float t = now();
  float m = edge(uv) * ghost;
  float frost = fbm(p * 0.8);
  vec4 col = vec4(vec3(0.72, 0.86, 0.96) * 0.42 * m, 0.42 * m);
  // тріщини: лінії, де шум перетинає середину
  float cr = 1.0 - smoothstep(0.0, 0.035, abs(noise(p * 1.4) - 0.5));
  cr += 1.0 - smoothstep(0.0, 0.025, abs(noise(p * 2.9 + 3.0) - 0.5));
  col = over(col, vec3(0.92, 0.98, 1.0), clamp(cr, 0.0, 1.0) * 0.55 * m);
  col = over(col, vec3(0.85, 0.93, 1.0), smoothstep(0.55, 0.8, frost) * 0.25 * m);
  // іскринки
  vec2 g = p * 2.0;
  float h = hash(floor(g));
  float tw = pow(max(0.0, sin(t * 2.5 + h * 40.0)), 24.0) * step(0.9, h);
  col = over(col, vec3(1.0), tw * (1.0 - smoothstep(0.0, 0.18, length(fract(g) - 0.5))) * m);
  return half4(col);
}`;

const WATER = HEAD + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 p = coord / 90.0 + seed;
  float t = now();
  float m = edge(uv) * ghost;
  vec2 q = p + vec2(fbm(p + t * 0.15), fbm(p - t * 0.12)) * 1.4;
  float c1 = pow(abs(sin(q.x * 3.1 + t * 0.9) * sin(q.y * 2.7 - t * 0.7)), 0.5);
  float caust = smoothstep(0.82, 1.0, c1);
  vec4 col = vec4(vec3(0.05, 0.22, 0.38) * 0.55 * m, 0.55 * m);
  col = over(col, vec3(0.55, 0.85, 0.95), caust * 0.5 * m);
  return half4(col);
}`;

// Трикутник з центром у нулі: відстань до його контуру (лише по самих сторонах)
const TRI = `
float tri(vec2 q, float R, float rot) {
  float best = 1.0;
  for (int k = 0; k < 3; k++) {
    float a = rot + float(k) * 2.0944;
    vec2 n = vec2(cos(a), sin(a));
    float dl = abs(dot(q, n) - R * 0.5);
    // точка має лежати всередині двох інших сторін, інакше це продовження лінії
    float ok = 1.0;
    for (int j = 0; j < 3; j++) {
      if (j == k) continue;
      float b = rot + float(j) * 2.0944;
      ok *= step(dot(q, vec2(cos(b), sin(b))), R * 0.5 + 0.004);
    }
    best = min(best, mix(1.0, dl, ok));
  }
  return best;
}
`;

const MAGIC = HEAD + TRI + `
half4 main(float2 coord) {
  vec2 uv = (coord + off) / box;
  vec2 q = (uv - 0.5) * 2.0;           // -1..1, коло вписане в габарити
  float d = length(q);
  float t = now();
  float px = 2.0 / min(box.x, box.y);   // один піксель у цих одиницях
  float aa = px * 1.5;
  float pulse = 0.8 + 0.2 * sin(t * 2.0);
  float line = 0.0;
  line += 1.0 - smoothstep(px, px + aa, abs(d - 0.96));
  line += 1.0 - smoothstep(px, px + aa, abs(d - 0.80));
  line += (1.0 - smoothstep(px, px + aa, abs(d - 0.74))) * 0.6;
  // руни між кільцями: тонкі риски різної висоти, кільце повільно обертається
  float ang = atan(q.y, q.x) / 6.2832 + 0.5 + t * 0.012;
  float n = 40.0;
  float cell = floor(ang * n);
  float f = fract(ang * n);
  float h = hash(vec2(cell, seed));
  float wpx = (0.12 / n) * 6.2832 * 0.88;     // товщина риски в одиницях кола
  float bar = 1.0 - smoothstep(wpx * 0.5, wpx * 0.5 + aa, abs(f - 0.5) * 6.2832 * 0.88 / n);
  float top = 0.83 + 0.10 * h;
  float rune = bar * step(0.83, d) * step(d, top) * step(0.18, h);
  // поперечна рисочка на половині рун
  float tick = step(0.7, h) * (1.0 - smoothstep(px, px + aa, abs(d - 0.845))) * step(abs(f - 0.5), 0.22);
  // гексаграма, що обертається у протилежний бік
  float rot = -t * 0.05;
  float star = 1.0 - smoothstep(px, px + aa, min(tri(q, 0.72, rot), tri(q, 0.72, rot + 1.0472)));
  float glow = (1.0 - smoothstep(0.0, 0.95, d)) * 0.16;
  vec3 gold = vec3(1.0, 0.83, 0.42);
  float a = clamp(line * 0.95 + (rune + tick) * 0.9 + star * 0.75, 0.0, 1.0) * pulse + glow * pulse;
  a = clamp(a, 0.0, 1.0) * step(d, 1.0) * ghost;
  return half4(gold * a, a);
}`;

// Ефекти й те, де вони лежать: туман і темрява — поверх токенів, решта — під ними
export const FX = {
  fog:    { name: "Туман",           sksl: FOG,    layer: "ATTACHMENT", cond: "obscured",          color: "#c9d0d6" },
  fire:   { name: "Вогонь",          sksl: FIRE,   layer: "DRAWING",    cond: "burning",          color: "#f97316" },
  poison: { name: "Отруйна хмара",   sksl: POISON, layer: "ATTACHMENT", cond: "poisoned",  color: "#84cc16" },
  dark:   { name: "Магічна темрява", sksl: DARK,   layer: "ATTACHMENT", cond: "blinded",   color: "#3b1d4a" },
  ice:    { name: "Крига",           sksl: ICE,    layer: "DRAWING",    cond: "chilled",          color: "#bae6fd" },
  water:  { name: "Вода",            sksl: WATER,  layer: "DRAWING",    cond: "wet",          color: "#0e7490" },
  magic:  { name: "Магічне коло",    sksl: MAGIC,  layer: "DRAWING",    cond: "",          color: "#facc15", free: true },
};

// Стани з «Бою» (ключі ті самі), які зона може накладати на тих, хто в ній стоїть
export const ZONE_CONDS = [
  ["", "Без стану"],
  ["burning", "🔥 Горить"],
  ["poisoned", "🧪 Отруєний"],
  ["chilled", "❄️ Замерзає"],
  ["wet", "💧 Мокрий"],
  ["obscured", "🌫 У тумані"],
  ["blinded", "🕶 Засліплений"],
  ["slowed", "🐌 Сповільнений"],
  ["restrained", "⛓ Обплутаний"],
  ["prone", "⤵ Збитий з ніг"],
  ["frightened", "😱 Наляканий"],
  ["deafened", "🔇 Оглушений"],
  ["charmed", "💗 Зачарований"],
  ["invisible", "👻 Невидимий"],
  ["blessed", "✨ Благословенний"],
];

// Скільки раундів стан тримається після того, як учасник вийшов із зони (0 — зникає одразу)
export const LINGER = { burning: 1, wet: 2, chilled: 1, poisoned: 1 };
