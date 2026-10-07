// Один шейдер на весь екран: фільтр, темрява, туман, дощ, спалахи.
// size, view і time підставляє сам Owlbear, решту — ми через uniforms.
// Ефект малюється поверх сцени звичайним накладанням, тому там, де нічого немає, він прозорий.
export const SKSL = `
uniform vec2 size;
uniform mat3 view;
uniform float time;
uniform float rain;
uniform float fog;
uniform float flash;
uniform float dark;
uniform float amount;
uniform vec3 tint;
uniform float film;   // зерно й віньєтка
uniform float fade;   // затемнення між моментами, 0..1
uniform float bars;   // кіношні чорні смуги, 0..1

// Owlbear дає час як unix-секунди. Таке велике число ламає sin() у шумі на відеокарті,
// тож беремо його по колу в межах години.
float now() {
  return mod(time, 3600.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

float streaks(vec2 uv, float scale, float speed) {
  vec2 p = vec2(uv.x * scale * 3.0 + uv.y * scale * 0.5, uv.y * scale * 0.35 - now() * speed);
  vec2 id = floor(p);
  vec2 f = fract(p);
  float pick = step(0.55, hash(id));
  float thin = smoothstep(0.82, 1.0, 1.0 - abs(f.x - 0.5) * 2.0);
  float tail = smoothstep(0.0, 0.35, f.y) * (1.0 - smoothstep(0.7, 1.0, f.y));
  return pick * thin * tail;
}

vec4 over(vec4 dst, vec3 color, float a) {
  a = clamp(a, 0.0, 1.0);
  return vec4(color * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a));
}

half4 main(float2 coord) {
  vec2 screen = (vec3(coord, 1) * view).xy;
  vec2 uv = screen / size;
  vec2 sq = vec2(uv.x * size.x / size.y, uv.y);
  vec4 col = vec4(0.0);

  col = over(col, tint, amount * 0.55);

  float edge = distance(uv, vec2(0.5));
  float vig = smoothstep(0.25, 0.85, edge);
  col = over(col, vec3(0.0, 0.01, 0.03), dark * (0.45 + 0.55 * vig));

  if (fog > 0.0) {
    float drift = fbm(sq * 2.2 + vec2(now() * 0.03, now() * 0.012));
    float wisps = fbm(sq * 5.0 - vec2(now() * 0.05, 0.0));
    float m = smoothstep(0.25, 0.85, drift * 0.7 + wisps * 0.3 + vig * 0.35);
    col = over(col, vec3(0.78, 0.82, 0.86), fog * m * 0.75);
  }

  if (rain > 0.0) {
    float r = streaks(sq, 14.0, 2.6) * 0.6 + streaks(sq + vec2(0.37, 0.11), 22.0, 3.4) * 0.4;
    col = over(col, vec3(0.8, 0.88, 1.0), rain * r * 0.5);
  }

  if (flash > 0.0) {
    float slot = floor(now() / 6.0);
    float ph = fract(now() / 6.0);
    float strike = step(0.45, hash(vec2(slot, 3.0)));
    float glow = exp(-ph * 16.0) * (0.65 + 0.35 * sin(ph * 140.0));
    col = over(col, vec3(0.85, 0.92, 1.0), flash * strike * glow * 0.6);
  }

  if (film > 0.0) {
    // мʼяка віньєтка і зерно, що міняється 24 рази на секунду, як на плівці
    col = over(col, vec3(0.0), film * 0.55 * smoothstep(0.35, 0.95, edge));
    float frame = mod(floor(now() * 24.0), 97.0);
    float g = hash(floor(screen * 0.75) + vec2(frame * 13.0, frame * 7.0));
    col = over(col, vec3(step(0.5, g)), abs(g - 0.5) * 0.11 * film);
  }

  col = over(col, vec3(0.0), fade);

  // чорні смуги зверху і знизу: зʼїжджаються на переходах і титрах
  float bh = bars * 0.105;
  float inBar = max(1.0 - step(bh, uv.y), step(1.0 - bh, uv.y)) * step(0.001, bars);
  col = mix(col, vec4(0.0, 0.0, 0.0, 1.0), inBar);

  return half4(col);
}
`;

// Кольорокорекція самої картинки (шар постобробки): насиченість, контраст, тон,
// легке погойдування, спалах блискавки на мапі. Вмикається окремою галочкою.
export const GRADE = `
uniform shader scene;
uniform mat3 modelView;
uniform float time;
uniform float sat;
uniform float contrast;
uniform float sway;
uniform float flash;
uniform float amount;
uniform vec3 tint;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

half4 main(float2 coord) {
  vec2 uv = (vec3(coord, 1) * modelView).xy;
  float t = mod(time, 3600.0);

  vec2 off = vec2(sin(uv.y * 0.012 + t * 1.3), cos(uv.x * 0.010 + t * 1.1)) * sway * 2.5;
  vec4 c = scene.eval(uv + off);

  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 rgb = mix(vec3(l), c.rgb, sat);
  rgb = (rgb - 0.5) * contrast + 0.5;
  // тіні тягнемо до тону настрою, світле лишаємо теплим
  rgb = mix(rgb, rgb * (tint * 1.5 + 0.25), amount * 0.6 * (1.0 - l * 0.6));

  float slot = floor(t / 6.0);
  float ph = fract(t / 6.0);
  float strike = step(0.45, hash(vec2(slot, 3.0)));
  float glow = exp(-ph * 16.0) * (0.65 + 0.35 * sin(ph * 140.0));
  rgb += rgb * flash * strike * glow * 1.4;

  return half4(clamp(rgb, 0.0, 1.0) * c.a, c.a);
}
`;
