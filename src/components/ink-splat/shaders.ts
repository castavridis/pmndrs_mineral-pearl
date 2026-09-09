import { MAX_PARTICLES } from './config';

// three prepends its own precision statement, the `position` attribute and
// (on WebGL2) the GLSL3 compatibility defines, so the sources below stay in
// GLSL1 syntax and carry no `precision`/`#extension` lines of their own.

/** Fullscreen triangle: clip-space positions straight through. */
export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Pass 1: sum every droplet's kernel into a density field. Runs at reduced
 * resolution — the field is smooth, so it upsamples cleanly and the final
 * threshold still produces a crisp edge at full resolution.
 */
export const FIELD_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec2 uDims;
uniform sampler2D uData;
uniform int uCount;

const int MAX = ${MAX_PARTICLES};

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uDims;
  float field = 0.0;
  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;
    float u = (float(i) + 0.5) / float(MAX);
    // row 0: x, y as 16-bit fixed point; row 1: reach (16-bit), heading, stretch
    vec4 a = floor(texture2D(uData, vec2(u, 0.25)) * 255.0 + 0.5);
    vec4 b = floor(texture2D(uData, vec2(u, 0.75)) * 255.0 + 0.5);
    vec2 pos = vec2(a.r * 256.0 + a.g, a.b * 256.0 + a.a) / 65535.0 * 3.0 - 1.0;
    float R = (b.r * 256.0 + b.g) / 65535.0 * 4.0;
    float th = b.b / 255.0 * 6.28318;
    float stretch = 1.0 + b.a / 255.0 * 3.0;
    vec2 dir = vec2(cos(th), sin(th));
    // a moving droplet is drawn out along its heading
    vec2 dp = p - pos;
    vec2 q = vec2(dot(dp, dir) / stretch, dot(dp, vec2(-dir.y, dir.x))) / R;
    float q2 = dot(q, q);
    if (q2 < 1.0) {
      float k = 1.0 - q2;
      field += k * k;
    }
  }
  gl_FragColor = vec4(field);
}
`;

/** Pass 2: threshold the field into ink, add the flood front, grain, the logo. */
export const INK_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uField;
uniform vec2 uDims;
uniform float uPx;
uniform float uTime;
uniform float uSeed;
uniform float uLogo;
// impact point and the flood radius that covers the viewport from it
uniform vec2 uOrigin;
uniform float uCover;
// palette: ink, the mark's colour, and the sign/strength of the wet-edge sheen
uniform vec3 uInk;
uniform vec3 uMark;
uniform float uSheen;
// optional: the ink takes its colour from a screen-sized canvas beneath
// (a WebGL canvas, whose upload puts its top row at t = 0)
uniform sampler2D uFill;
uniform float uFillOn;
// optional rounded box (centred, shader units) that bounds the flood
uniform vec2 uClipHalf;
uniform float uClipRadius;
uniform float uClipOn;
// when the flood begins and how long it takes
uniform float uFloodStart;
uniform float uFloodLen;
// 1: the ink closes in from the box's edge instead of spreading from the blot
uniform float uEngulf;

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p *= 2.13;
    amp *= 0.5;
  }
  return v;
}

float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// pmndrs mark: five axis-aligned blocks in a unit square (y down)
float logoSDF(vec2 q) {
  float d = sdBox(q - vec2(0.675, 0.144), vec2(0.325, 0.144));
  d = min(d, sdBox(q - vec2(0.85, 0.320), vec2(0.15, 0.320)));
  d = min(d, sdBox(q - vec2(0.5, 0.489), vec2(0.15, 0.150)));
  d = min(d, sdBox(q - vec2(0.15, 0.489), vec2(0.15, 0.150)));
  d = min(d, sdBox(q - vec2(0.5, 0.843), vec2(0.15, 0.154)));
  return d;
}

// damped spring step response: 0 -> 1 with a physical overshoot and settle
float springOut(float t, float freq, float damp) {
  return 1.0 - exp(-damp * t) * cos(freq * t);
}

void main() {
  // y grows downward to match CSS space; the blot sits at the impact point
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uDims;
  vec2 c = uOrigin;
  vec2 dp = p - c;
  float ang = atan(dp.y, dp.x);
  vec2 ring = vec2(cos(ang), sin(ang));

  float field = texture2D(uField, vUv).r;

  float fs = clamp((uTime - uFloodStart) / uFloodLen, 0.0, 1.0);
  float flood = fs * fs * fs;
  // the box the ink is bounded by: the clip box, else the canvas itself
  vec2 boxHalf = uClipOn > 0.5 ? uClipHalf : uDims * 0.5;
  float boxRadius = uClipOn > 0.5 ? uClipRadius : 0.0;
  float dBox = sdBox(p - uDims * 0.5, boxHalf - boxRadius) - boxRadius;
  float inside = 1.0 - smoothstep(-uPx, uPx, dBox);
  float front;
  if (uEngulf > 0.5) {
    // engulf: the ink closes in from the box's edge behind a ragged front of
    // fingers reaching for the centre, until everything inside is drowned
    float finger = fbm(p * 4.0 + uSeed + 9.0) - 0.5;
    float ripple = fbm(p * 14.0 + uSeed * 6.0) - 0.5;
    float frontR = flood * uCover * (1.0 + 0.5 * finger + 0.15 * ripple);
    front = 1.0 - smoothstep(-0.03, 0.01, -dBox - frontR);
    front *= inside * smoothstep(0.0, 0.05, fs);
  } else {
    // flood: once the blot has settled the ink spills outward from the mass,
    // accelerating, behind a ragged front of fingers until the whole viewport
    // is drowned. The droplets swell and drift with it (see the JS sim) so the
    // debris is absorbed rather than painted over.
    float lobes = 0.5 * sin(ang * 3.0 + uSeed) +
                  0.3 * sin(ang * 5.0 + uSeed * 2.7) +
                  0.2 * sin(ang * 8.0 + uSeed * 5.3);
    float finger = fbm(ring * 3.0 + uSeed + 9.0) - 0.5;
    float ripple = fbm(ring * 11.0 + uSeed * 6.0) - 0.5;
    float frontR = flood * uCover * (1.0 + 0.5 * finger + 0.15 * ripple + 0.15 * lobes);
    front = 1.0 - smoothstep(-0.03, 0.01, length(dp) - frontR);
    // with a clip the flood stays inside the box; droplets may still overhang
    if (uClipOn > 0.5) front *= inside;
  }
  field += front;

  // the whole surface jiggles for the first half second after impact
  float raw = field;
  field += (fbm(p * 6.0 + vec2(uTime * 1.5, -uTime * 1.1) + uSeed) - 0.5) * 0.2 * exp(-3.0 * uTime);

  // fine static grain on every edge so the liquid reads as physical ink
  field += (fbm(p * 10.0 + uSeed * 3.0) - 0.5) * 0.08 + (fbm(p * 38.0 + uSeed) - 0.5) * 0.03;

  // derivatives are core in WebGL2, which three r163+ requires
  float aa = max(fwidth(field) * 0.8, 0.004);
  float alpha = smoothstep(0.5 - aa, 0.5 + aa, field);
  vec3 ink = uFillOn > 0.5 ? texture2D(uFill, vec2(vUv.x, 1.0 - vUv.y)).rgb : uInk;

  // wet edge: a faint sheen along edges that face the light, from the
  // field's gradient in the thin band just inside the surface
  vec2 g = vec2(dFdx(raw), dFdy(raw));
  vec2 n = g / max(length(g), 1e-5);
  float band = smoothstep(0.5, 0.7, raw) * (1.0 - smoothstep(0.7, 1.0, raw));
  float sheen = pow(max(dot(-n, normalize(vec2(-0.6, 0.8))), 0.0), 3.0);
  ink += vec3(uSheen) * sheen * band * (1.0 - fs);

  // logo rising through the ink in 3D: starts deep and tilted away,
  // springs upright while surfacing, refracted by the liquid until it clears
  float lt = max(uTime - 0.28, 0.0);
  float ls = springOut(lt, 18.0, 9.0);
  float focus = 1.0 - exp2(-8.0 * lt);
  float lrot = -0.25 * (1.0 - ls);
  float lsize = 0.14 * mix(0.55, 1.0, ls);

  vec2 lp = dp;
  float csr = cos(lrot);
  float snr = sin(lrot);
  lp = vec2(csr * lp.x - snr * lp.y, snr * lp.x + csr * lp.y) / lsize;

  // inverse perspective: the logo plane pivots around its horizontal axis
  // (springOut overshoot tips it slightly past vertical before settling)
  float tilt = 1.1 * (1.0 - ls);
  float ct = cos(tilt);
  float st = sin(tilt);
  float ppy = lp.y / max(ct - lp.y * st / 1.2, 0.25);
  vec2 lq = vec2(lp.x * (1.0 + ppy * st / 1.2), ppy);

  // refraction shimmer while still submerged, dying off as it surfaces
  float sub = 1.0 - focus;
  lq += (vec2(fbm(lq * 6.0 + uTime * 3.0), fbm(lq * 6.0 + 17.0 - uTime * 3.0)) - 0.5) * 0.16 * sub;

  float dl = logoSDF(lq + vec2(0.5, 0.498)) * lsize;
  float aaL = mix(0.012, uPx, focus);
  // the mark sinks back under as the flood takes the screen
  float logoM = (1.0 - smoothstep(-aaL, aaL, dl)) * focus * (1.0 - smoothstep(0.15, 0.7, fs)) * uLogo;

  vec3 col = mix(ink, uMark, logoM);

  // premultiplied output; the material blends with One / OneMinusSrcAlpha
  gl_FragColor = vec4(col * alpha, alpha);
}
`;
