/* <ink-liquid-button> — the liquid button, but the swallow is a particle fluid.
   Ported from krispya/ink-splat: on impact droplets burst from the slab's rim
   (drag + weak surface tension, simulated in JS) and are rendered as a metaball
   density field, so lobes, strands, necks and pinch-offs come out of the motion.
   As the slab goes under, the droplets are drawn back onto it and swell until
   the mass has closed over it; when it rises they slide off and thin away.
   Raw WebGL2 (GLSL ES 3.00): one fullscreen triangle from gl_VertexID, no VBO.
   The liquid, the button body and the meniscus are all drawn in the fragment
   shader; the label is a real DOM <button> on top, so it stays selectable,
   zoomable, keyboard-operable and screen-reader addressable. */
(() => {
  const VS = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FS = `#version 300 es
// liquid-button.frag — viscous surface + a floating rounded slab.
// Dual body: mineral (dark, glittering) and pearl (cream nacre), crossfaded by uMode.
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPtr;      // pointer in aspect-corrected uv
uniform float uPtrOn;
uniform vec2  uBtnC;     // button centre in uv
uniform vec2  uBtnHalf;  // half extents in uv
uniform float uBtnR;     // corner radius in uv
uniform float uDepth;    // top face height: + proud of the surface, - below it
uniform float uVel;      // vertical velocity (drives the viscous cling)
uniform float uFocus;
uniform float uMode;     // 0 mineral, 1 pearl
uniform float uMotion;   // 0 when the user prefers reduced motion
uniform float uGoop;     // 0 floating, 1 fully under: the liquid beads up like mercury
uniform float uVisc;     // 0.15..2, lower = faster, less damped
uniform float uMerc;     // 0 mineral/pearl body, 1 the liquid itself is mercury
uniform vec2  uTilt;     // slab tilt: top-face height gradient across the slab (uv per uv)
uniform vec3  uGlob;     // x droplet size, y density, z heap height
uniform vec4  uPart[128]; // droplets: xy pos, z kernel reach, w = round(stretch*10)*8 + heading
uniform int   uCount;
uniform float uSplatT;   // seconds since impact
uniform float uSeed;
uniform vec4  uRip[6];   // xy origin, z start time, w strength

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2  h22(vec2 p){ float a = h21(p); return vec2(a, h21(p + a + 7.13)); }
vec3  h33(vec2 p){ float a = h21(p); float b = h21(p + a + 3.71); return vec3(a, b, h21(p + b + 9.13)); }

// pmndrs spectrum, cyclic: one unit of input is one full rotation.
vec3 brand(float x){
  float h = fract(x) * 7.0;
  vec3 c = vec3(0.847, 0.333, 0.976);
  c = mix(c, vec3(1.000, 0.286, 0.502), clamp(h,       0.0, 1.0));
  c = mix(c, vec3(1.000, 0.753, 0.263), clamp(h - 1.0, 0.0, 1.0));
  c = mix(c, vec3(0.922, 1.000, 0.059), clamp(h - 2.0, 0.0, 1.0));
  c = mix(c, vec3(0.792, 0.961, 0.263), clamp(h - 3.0, 0.0, 1.0));
  c = mix(c, vec3(0.000, 0.969, 0.639), clamp(h - 4.0, 0.0, 1.0));
  c = mix(c, vec3(0.169, 0.863, 0.965), clamp(h - 5.0, 0.0, 1.0));
  c = mix(c, vec3(0.847, 0.333, 0.976), clamp(h - 6.0, 0.0, 1.0));
  return c;
}

float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 3; i++){ s += a * vn(p); p *= 2.07; a *= 0.5; }
  return s;
}

float sdRound(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// --- the liquid height field -------------------------------------------------
// Viscosity lives here: ripples are long-wavelength, slow (0.42 uv/s) and
// heavily damped, and the surface clings to the slab in proportion to its
// velocity instead of snapping back.
float surf(vec2 p){
  float t = uTime * uMotion;
  vec2 w = vec2(fbm3(p * 1.1 + vec2(0.0, t * 0.035)),
                fbm3(p * 1.1 + vec2(4.7, -t * 0.028)));
  float h = (fbm3(p * 1.9 + (w - 0.5) * 1.6) - 0.5) * 0.075;

  float pd = length(p - uPtr);
  // high tension: the pointer dents a narrow, deep dimple instead of a wide bowl
  h -= uPtrOn * mix(0.020 * exp(-pd * pd * 26.0), 0.030 * exp(-pd * pd * 110.0), uGoop);

  float thin = clamp(1.0 - uVisc * 0.5, 0.0, 1.0);
  float spd  = mix(0.42, 0.78, thin);
  float damp = mix(1.0, 0.45, thin);
  float freq = mix(9.0, 15.0, thin);
  for(int i = 0; i < 6; i++){
    vec4 r = uRip[i];
    if(r.w <= 0.0) continue;
    float age = uTime - r.z;
    if(age < 0.0 || age > 4.5) continue;
    float d = length(p - r.xy);
    float band = d - age * spd;
    float env = exp(-abs(band) * 3.4) * exp(-age * damp) * exp(-d * 0.85);
    h += sin(band * freq - age * 2.2) * env * 0.085 * r.w;
  }

  float sd = sdRound(p - uBtnC, uBtnHalf, uBtnR);
  float o = max(sd, 0.0);
  float ld = uDepth + dot(uTilt, p - uBtnC);   // local top-face height under tilt
  // displaced volume: the surface is pulled down in a collar around the slab
  float collar = exp(-o * 10.0);
  h -= collar * 0.050 * clamp(1.0 + ld / 0.34, 0.0, 1.0) * (1.0 - uGoop);
  // cling: a sinking slab drags the surface down with it, a rising one lifts it
  h += clamp(uVel, -1.2, 1.2) * 0.30 * exp(-o * 3.2) * (1.0 - 0.6 * uGoop);
  return h;
}

// metaball density field and its gradient. Kernel (1 - q^2)^2 crosses the
// 0.5 threshold at q = 0.541; a moving droplet is drawn out along its heading.
vec3 inkField(vec2 p){
  float f = 0.0;
  vec2  g = vec2(0.0);
  for(int i = 0; i < 128; i++){
    if(i >= uCount) break;
    vec4  a  = uPart[i];
    float sq = floor(a.w / 8.0);
    float th = a.w - sq * 8.0;
    float st = sq / 10.0;
    vec2  dir = vec2(cos(th), sin(th));
    vec2  prp = vec2(-dir.y, dir.x);
    vec2  dp  = p - a.xy;
    float R   = a.z;
    vec2  q   = vec2(dot(dp, dir) / st, dot(dp, prp)) / R;
    float q2  = dot(q, q);
    if(q2 < 1.0){
      float k = 1.0 - q2;
      f += k * k;
      g += -4.0 * k * (q.x / (R * st) * dir + q.y / R * prp);
    }
  }
  return vec3(f, g);
}

void main(){
  vec2  uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t  = uTime;

  float hgt = surf(uv);
  float e = 0.006;
  vec2 grad = vec2(surf(uv + vec2(e, 0.0)) - surf(uv - vec2(e, 0.0)),
                   surf(uv + vec2(0.0, e)) - surf(uv - vec2(0.0, e))) / (2.0 * e);
  // --- ink metaballs: the swallow is a particle fluid ------------------------
  vec3  F     = inkField(uv);
  float field = F.x;
  // bounded height mapping so per-droplet bumps survive where kernels overlap
  float bs    = 1.0 - exp(-max(field - 0.2, 0.0) * 1.4);
  hgt += uGlob.z * 0.05 * bs;
  vec2  gB    = uGlob.z * 0.05 * 1.4 * (1.0 - bs) * F.yz;
  // lobe relief on top of the mass: each droplet's own kernel rises above its neighbours
  gB += uGlob.z * 0.05 * 0.35 * F.yz / max(field, 0.5);
  vec3 N = normalize(vec3(-(grad + gB) * 0.55, 1.0));
  // the whole mass jiggles for the first half second after impact, then
  // fine static grain on every edge so it reads as physical liquid
  float fj = field + (fbm3(uv * 6.0 + vec2(uSplatT * 1.5, -uSplatT * 1.1) + uSeed) - 0.5) * 0.2 * exp(-3.0 * uSplatT) * uMotion;
  fj += (fbm3(uv * 10.0 + uSeed * 3.0) - 0.5) * 0.08 + (fbm3(uv * 38.0 + uSeed) - 0.5) * 0.03;
  float aa    = max(fwidth(field) * 0.8, 0.004);
  float inkRaw = smoothstep(0.5 - aa, 0.5 + aa, fj);
  // the ink is the liquid itself: away from the slab it is only relief in the
  // surface (height + normals, shaded as the surrounding liquid). It becomes a
  // visible body only where it has climbed over the slab's face, so the globs
  // read as the background reaching up over the button rather than skating on it.
  float sdS   = sdRound(uv - uBtnC, uBtnHalf, uBtnR);
  float over  = 1.0 - smoothstep(-0.004, 0.012, sdS);
  float inkM  = inkRaw * over;
  // wet edge: a sheen along edges that face the light, just inside the surface
  vec2  nF    = F.yz / max(length(F.yz), 1e-5);
  float bandF = smoothstep(0.5, 0.7, field) * (1.0 - smoothstep(0.7, 1.0, field));
  float sheen = pow(max(dot(-nF, normalize(vec2(-0.6, 0.8))), 0.0), 3.0) * bandF * over;
  // the liquid has climbed the slab's wall: a darker lip just inside the front
  float lip = smoothstep(0.5, 0.75, field) * (1.0 - smoothstep(0.75, 1.1, field)) * over;

  vec3 L  = normalize(vec3(-0.35, 0.5, 0.78));
  vec3 V  = vec3(0.0, 0.0, 1.0);
  vec3 Hv = normalize(L + V);

  float fres = pow(1.0 - max(N.z, 0.0), 1.6);
  float spec = pow(max(dot(N, Hv), 0.0), mix(30.0, 90.0, uGoop));
  float lamb = max(dot(N, L), 0.0);

  // mercury: a hard chrome reflection of a soft studio — bright sky above,
  // dark floor below, a sharp horizon band — read off the reflected ray
  vec3  R   = reflect(-V, N);
  float env = smoothstep(-0.55, 0.65, R.y) * 0.85 + 0.05;
  env += exp(-abs(R.y - 0.18) * 14.0) * 0.55;
  env += pow(max(dot(N, normalize(vec3(0.4, 0.9, 0.5))), 0.0), 60.0) * 0.9;
  vec3 merc = mix(vec3(0.06, 0.06, 0.07), vec3(0.93, 0.94, 0.96), clamp(env, 0.0, 1.0));
  merc += vec3(1.0) * spec * 0.8;

  vec2  dl  = uv - uPtr;
  float gd  = length(dl);
  vec2  rad = dl / max(gd, 0.0001);
  float cyc = gd * 2.4;
  float band = smoothstep(0.35, 0.9, cyc) * (1.0 - smoothstep(1.9, 2.6, cyc));
  float halo = exp(-gd * gd * 6.0) * 0.55 + exp(-gd * gd * 28.0) * 0.45;
  float glow = halo * uPtrOn * 0.5;

  float nac = fbm3(uv * 2.2 + vec2(0.0, t * uMotion * 0.02));
  float lam = vn(uv * vec2(3.0, 72.0) + 11.0);
  float phase = nac * 1.9 + fres * 1.5 + lam * 0.16 + cyc * 0.30 - t * uMotion * 0.02;
  vec3  irid = mix(brand(phase), vec3(1.0), 0.26);

  // --- slab geometry: its shading never changes under the surface; it only
  // fades out (opacity) as the liquid closes over it --------------------------
  // dome: the top face crowns gently toward the middle, so liquid that has
  // climbed onto it runs off when the slab resurfaces
  float bd0   = sdRound(uv - uBtnC, uBtnHalf, uBtnR);
  float dx0   = clamp(-bd0 / 0.085, 0.0, 1.0);
  float domeH = 0.028 * (1.0 - (1.0 - dx0) * (1.0 - dx0));
  float subm  = clamp(hgt - (uDepth + domeH + dot(uTilt, uv - uBtnC)), 0.0, 1.0);
  float dry   = 1.0 - smoothstep(0.0, 0.014, subm);
  float slabA = 1.0;   // the slab never fades: only the ink mass covers it
  vec2  rp    = uv;
  float bd    = sdRound(rp - uBtnC, uBtnHalf, uBtnR);
  float px    = 1.6 / uRes.y;
  float bMask = smoothstep(px, -px, bd) * slabA;
  bMask *= 1.0 - inkM;   // the ink mass occludes the slab; its shading never changes
  float rim   = exp(-abs(bd) * 70.0) * (1.0 - inkM);
  float shade = exp(-max(bd, 0.0) * 9.0) * step(0.0, bd) * (1.0 - inkM);

  // --- facet glitter ---------------------------------------------------------
  vec2 gp = uv * 130.0;
  vec2 gid = floor(gp), gv = fract(gp) - 0.5;
  vec3  sparkC = vec3(0.0);
  float sparkI = 0.0;
  for(int y = -1; y <= 1; y++){
    for(int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y));
      vec3 r = h33(gid + o);
      float alive = step(r.x, 0.55);
      vec2  cp = o + (r.yz - 0.5) * 0.82;
      float d  = length(gv - cp);
      float core = smoothstep(0.13, 0.0, d);
      vec2 tl = (h22(gid + o + 11.71) - 0.5) * 1.5;
      tl += 0.05 * uMotion * vec2(sin(t * (0.5 + r.y * 1.3) + r.z * 21.0),
                                  cos(t * (0.4 + r.z * 1.1) + r.y * 17.0));
      vec3 fn = normalize(vec3(tl, 0.72));
      float sp = pow(max(dot(fn, Hv), 0.0), 230.0) * (0.6 + r.z * 0.9);
      float w  = sp * (core + 0.22 * exp(-d * d * 90.0)) * alive;
      sparkC += mix(vec3(1.0), brand(cyc - 1.0 + dot(tl, rad) * 0.14 + r.y * 0.1 - t * 0.02) * 1.25, 0.82) * w;
      sparkI += w;
    }
  }
  float sparkMask = mix(1.0, 0.12, bMask);

  float ring = exp(-abs(bd - 0.045) * 55.0) * uFocus * (0.55 + 0.45 * sin(t * 4.0 * uMotion));
  vec3  focusC = vec3(0.710, 0.906, 0.000);   // pmndrs green 400
  // dome shading from the crown's true slope: steep at the rim, flat on top
  vec2  dg = vec2(bd0 - sdRound(uv + vec2(0.004, 0.0) - uBtnC, uBtnHalf, uBtnR),
                  bd0 - sdRound(uv + vec2(0.0, 0.004) - uBtnC, uBtnHalf, uBtnR)) / 0.004;
  float slope = 0.028 * 2.0 * (1.0 - dx0) / 0.085;   // d domeH / d(-bd)
  vec3  domeN = normalize(vec3(-dg * slope * 0.9, 1.0));  // dg points uphill; the normal tilts outward at the rim
  float domeL = dot(domeN, L);
  float crown = clamp((domeL - dot(vec3(0.0, 0.0, 1.0), L)) * 0.35, -0.08, 0.08);

  // --- mineral composite -----------------------------------------------------
  vec3 liqD = vec3(0.030, 0.028, 0.038);
  liqD = mix(liqD, vec3(0.150, 0.145, 0.170), smoothstep(0.25, 0.80, nac));
  liqD *= 0.80 + 0.40 * lamb;
  liqD += irid * (0.07 + 0.75 * fres) * 0.70;
  liqD += vec3(1.0) * spec * 0.30;
  liqD += vec3(0.70, 0.78, 1.00) * glow * 0.09;
  liqD *= 1.0 - 0.50 * shade;
  liqD  = liqD / (1.0 + liqD * 0.85);
  liqD  = pow(liqD, vec3(0.82));


  vec3 cream = vec3(0.980, 0.961, 0.918);
  vec3 slabD = cream * (0.90 + 0.10 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabD *= 1.0 + crown;
  slabD *= 0.95 + 0.06 * vn(rp * 46.0);
  slabD += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.08;

  vec3 colD = mix(liqD, slabD, bMask);
  colD += vec3(0.16) * sheen * inkM;
  colD *= 1.0 - 0.22 * lip;
  colD += sparkC * sparkMask * 1.15 * (1.0 + glow);
  colD += vec3(0.80, 0.86, 1.00) * rim * 0.20 * slabA;
  colD += focusC * ring * 0.55;
  colD *= 1.0 - 0.28 * dot(uv, uv);
  colD  = clamp(colD, 0.0, 1.0);

  // --- pearl composite -------------------------------------------------------
  vec3 liqL = cream * (0.900 + 0.070 * nac + 0.028 * lam);
  liqL = mix(liqL, vec3(0.760, 0.740, 0.700), smoothstep(0.50, 0.90, nac) * 0.45);
  liqL = mix(liqL, irid, clamp((0.10 + 0.55 * band) * (0.22 + 0.78 * fres) * 0.60, 0.0, 0.52));
  liqL += vec3(0.10, 0.10, 0.095) * spec * 0.50;
  liqL += vec3(0.030, 0.026, 0.016) * glow * 0.7;
  liqL *= 1.0 - 0.42 * shade;

  vec3 ink = vec3(0.070, 0.062, 0.048);
  vec3 slabL = ink * (1.0 + 0.9 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabL *= 1.0 + crown * 1.6;
  slabL += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.10;

  vec3 colL = mix(liqL, slabL, bMask);
  colL -= vec3(0.14) * sheen * inkM;
  colL *= 1.0 - 0.10 * lip;
  colL = mix(colL, mix(vec3(0.36, 0.35, 0.33), irid * 0.8, band), clamp(sparkI * sparkMask * 0.8, 0.0, 1.0) * 0.45);
  colL += vec3(0.55, 0.52, 0.48) * rim * 0.10 * slabA;
  colL += focusC * 0.75 * ring * 0.60;
  colL *= 1.0 - 0.10 * dot(uv, uv);
  colL  = clamp(colL, 0.0, 1.0);

  // --- mercury composite -----------------------------------------------------
  vec3 liqM = merc + irid * fres * 0.10;
  liqM *= 1.0 - 0.35 * shade;
  vec3 slabM = vec3(0.12, 0.115, 0.13) * (0.9 + 0.3 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabM *= 1.0 + crown * 1.6;
  slabM += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.12;
  vec3 colM = mix(liqM, slabM, bMask);
  colM += vec3(0.35) * sheen * inkM;
  colM *= 1.0 - 0.18 * lip;
  colM += sparkC * sparkMask * 0.35;
  colM += vec3(1.0) * rim * 0.35 * slabA;
  colM += focusC * ring * 0.55;
  colM *= 1.0 - 0.22 * dot(uv, uv);
  colM  = clamp(colM, 0.0, 1.0);

  fragColor = vec4(mix(mix(colD, colL, uMode), colM, uMerc), 1.0);
}
`;

  // --- APCA (0.1.9) ----------------------------------------------------------
  const apcaY = (c) => {
    const f = (v) => Math.pow(Math.max(v, 0), 2.4);
    const Y = 0.2126729 * f(c[0]) + 0.7151522 * f(c[1]) + 0.071775 * f(c[2]);
    return Y < 0.022 ? Y + Math.pow(0.022 - Y, 1.414) : Y;
  };
  const apcaLc = (txt, bg) => {
    const Yt = apcaY(txt);
    const Yb = apcaY(bg);
    if (Math.abs(Yb - Yt) < 0.0005) return 0;
    if (Yb > Yt) {
      const S = (Math.pow(Yb, 0.56) - Math.pow(Yt, 0.57)) * 1.14;
      return S < 0.1 ? 0 : (S - 0.027) * 100;
    }
    const S = (Math.pow(Yb, 0.65) - Math.pow(Yt, 0.62)) * 1.14;
    return S > -0.1 ? 0 : (S + 0.027) * 100;
  };
  const hexRgb = (h) => [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
  const INKS = ["#0c0a06", "#191712", "#fffaef", "#eafcd0"];
  const SCRIMS = { light: "#0c0a06", dark: "#fbf8f1" };
  const APCA_TARGET = 78;

  const HALF_Y = 0.086;
  const RADIUS = 0.082;
  const MAXP = 128;
  const KQ = 0.541;
  const TAU = Math.PI * 2;
  const GROW = [2.2, 0.45, 0.3, 0.3]; // how much each droplet kind swells as the mass closes over the slab

  class LiquidButton extends HTMLElement {
    static get observedAttributes() {
      return ["disabled", "label", "liquid", "viscosity", "sinkmercury", "globsize", "globdensity", "globheight"];
    }

    connectedCallback() {
      if (this._built) return;
      this._built = true;
      this.style.cssText =
        "display:block;position:relative;width:100%;height:100%;overflow:hidden;" +
        "border-radius:var(--radius-base,16px);background:#0c0a06;line-height:0";

      const cv = document.createElement("canvas");
      cv.setAttribute("aria-hidden", "true");
      cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
      this.appendChild(cv);
      this._cv = cv;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = [
        "position:absolute",
        "left:50%",
        "top:50%",
        "transform:translate(-50%,-50%)",
        "display:grid",
        "place-items:center",
        "min-width:44px",
        "min-height:44px",
        "padding:0",
        "border:none",
        "background:transparent",
        "font-family:var(--fonts-sans,system-ui)",
        "font-weight:600",
        "letter-spacing:0.01em",
        "cursor:pointer",
        "outline-offset:10px",
        "transition:filter 320ms ease, opacity 320ms ease, color 400ms ease, font-weight 400ms ease, letter-spacing 400ms ease",
        "-webkit-tap-highlight-color:transparent",
      ].join(";");
      btn.addEventListener("focus", () => this._setFocus(true));
      btn.addEventListener("blur", () => this._setFocus(false));
      btn.addEventListener("click", (e) => {
        if (this._disabled) {
          e.preventDefault();
          this._announce(this._label() + " is unavailable — the button has sunk below the liquid.");
          return;
        }
        this._press(e.detail === 0 ? null : this._pt);
      });
      this.appendChild(btn);
      this._btn = btn;

      const live = document.createElement("p");
      live.setAttribute("aria-live", "polite");
      live.style.cssText =
        "position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
      this.appendChild(live);
      this._live = live;

      const status = document.createElement("span");
      status.style.cssText = [
        "position:absolute",
        "left:16px",
        "bottom:14px",
        "font:500 12px/1 var(--fonts-mono,monospace)",
        "letter-spacing:0.08em",
        "text-transform:uppercase",
        "opacity:0.72",
        "pointer-events:none",
      ].join(";");
      this.appendChild(status);
      this._status = status;

      this.addEventListener("pointermove", (e) => this._point(e));
      this.addEventListener("pointerdown", (e) => this._point(e));
      this.addEventListener("pointerleave", () => {
        this._pt = null;
        this._ptrOn = 0;
        this._state.prox = 0;
      });

      this._state = {
        y: 0.014,
        v: 0,
        pressAt: -99,
        ripples: [],
        ptr: [0, 0],
        ptrOn: 0,
        focus: 0,
        prox: 0,
        goop: 0,
        tilt: [0, 0],
        tiltV: [0, 0],
        merc: this.getAttribute("liquid") === "mercury" ? 1 : 0,
        mercT: this.getAttribute("liquid") === "mercury" ? 1 : 0,
        mode: this.getAttribute("liquid") === "pearl" ? 1 : 0,
        modeT: this.getAttribute("liquid") === "pearl" ? 1 : 0,
      };
      this._lc = 0;
      this._reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

      this._syncLabel();
      if (!this._initGL()) {
        this._fallback();
        return;
      }
      this._loop();
      this._settle();
      new ResizeObserver(() => {
        if (!this._settled) this._settle();
        else if (this._layout() && performance.now() - (this._lastRaf || 0) > 250) {
          this._step();
          this._measure();
        }
      }).observe(this);
    }

    attributeChangedCallback(name) {
      if (!this._built) return;
      if (name === "label") this._syncLabel();
      else if (name === "liquid") {
        const liq = this.getAttribute("liquid");
        const pearl = liq === "pearl";
        this._state.mode = pearl ? 1 : 0;
        this._state.merc = liq === "mercury" ? 1 : 0;
        this.style.background = pearl ? "#faf5ea" : "#0c0a06";
        this._spawn(0, 0, 0.6);
      } else if (name === "disabled") this._syncDisabled();
    }

    get _disabled() {
      const a = this.getAttribute("disabled");
      return a !== null && a !== "false";
    }
    _label() {
      return this.getAttribute("label") || "Submit";
    }
    // the liquid turns to mercury as the slab goes under, and back as it rises
    get _mercOnSink() {
      const a = this.getAttribute("sinkmercury");
      return a !== null && a !== "false";
    }
    _num(name, def) {
      const v = parseFloat(this.getAttribute(name));
      return isNaN(v) ? def : v;
    }
    get _visc() {
      const v = parseFloat(this.getAttribute("viscosity"));
      return isNaN(v) ? 0.4 : Math.max(0.15, Math.min(2, v));
    }

    _syncLabel() {
      this._btn.textContent = this._label();
      this._syncDisabled();
    }
    _syncDisabled() {
      const d = this._disabled;
      this._btn.setAttribute("aria-disabled", String(d));
      this._btn.style.cursor = d ? "not-allowed" : "pointer";
      this._paintStatus();
      if (this._wasDisabled !== undefined && this._wasDisabled !== d) {
        this._spawn(0, 0, d ? 1.4 : 1.2);
        if (d) this._splat(1.3);
        this._announce(
          d
            ? this._label() + " unavailable — the button is sinking below the liquid."
            : this._label() + " available — the button has surfaced and is floating again."
        );
      }
      this._wasDisabled = d;
    }
    _paintStatus() {
      const d = this._disabled;
      this._status.textContent =
        (d ? "sunk · unavailable" : "afloat · ready") + (this._lc ? " · APCA Lc " + this._lc : "");
      this._status.style.color = this._state && this._state.modeT > 0.5 && this._state.mercT < 0.5 ? "#3d5a2a" : "#93fdc8";
    }
    _announce(msg) {
      this._live.textContent = "";
      setTimeout(() => (this._live.textContent = msg), 60);
    }
    _setFocus(on) {
      this._focusOn = on;
      this._btn.style.outline = on ? "2px dashed #b5e700" : "none";
    }
    _point(e) {
      const r = this.getBoundingClientRect();
      if (!r.height) return;
      const x = (e.clientX - r.left - r.width / 2) / r.height;
      const y = -(e.clientY - r.top - r.height / 2) / r.height;
      this._state.ptr = [x, y];
      this._ptrOn = 1;
      const b = this._btn.getBoundingClientRect();
      const inside =
        e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      this._pt = inside ? [x, y] : null;
      // proximity to the slab (0 far, 1 over it) — the pointer pushes it under
      const s = this._state;
      const qx = Math.abs(x - (this._cx || 0)) - this._halfX + RADIUS;
      const qy = Math.abs(y - (this._cy || 0)) - HALF_Y + RADIUS;
      const sd = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - RADIUS;
      s.prox = Math.max(0, Math.min(1, 1 - sd / 0.14));
      // dragging across the liquid sheds a slow wake
      const last = this._wake;
      if (!inside && (!last || Math.hypot(x - last[0], y - last[1]) > 0.16)) {
        this._wake = [x, y];
        this._spawn(x, y, 0.16);
      }
    }
    _press(pt) {
      this._state.pressAt = performance.now() / 1000;
      this._state.pressPt = pt;
      this._spawn(pt ? pt[0] : 0, pt ? pt[1] : 0, 0.85);
      this._splat(1);
      this._announce(this._label() + " pressed. The button sinks into the liquid and rises back.");
      this.dispatchEvent(new CustomEvent("liquidpress", { bubbles: true }));
    }
    _spawn(x, y, s) {
      if (!this._state) return;
      if (this._reduce) s *= 0.35;
      this._state.ripples.push({ x, y, t: performance.now() / 1000, s });
      if (this._state.ripples.length > 6) this._state.ripples.shift();
    }

    // --- particle fluid (ported from ink-splat) --------------------------------
    _initParts() {
      const N = MAXP;
      this._P = {
        px: new Float32Array(N), py: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N),
        rad: new Float32Array(N), drag: new Float32Array(N), kind: new Uint8Array(N),
        head: new Float32Array(N), elong: new Float32Array(N), born: new Float32Array(N),
        n: 0, t: 0, seed: 0, rel: -1,
      };
      this._part = new Float32Array(N * 4);
    }
    // the impact: everything is launched from the slab's rim and thrown outward.
    // Speeds are uv/s; with exponential drag k a droplet travels v/k.
    _splat(strength) {
      const P = this._P;
      if (!P) return;
      if (this._reduce) strength *= 0.5;
      const R = Math.random;
      const cx = this._cx || 0, cy = this._cy || 0, hx = this._halfX || 0.3, hy = HALF_Y;
      const size = this._num("globsize", 1);
      const dens = 0.5 + this._num("globdensity", 0.5);
      P.n = 0; P.t = 0; P.rel = -1; P.seed = R() * 100;
      const add = (x, y, sx, sy, r, k, type, st, delay = 0) => {
        if (P.n >= MAXP) return;
        const i = P.n++;
        P.px[i] = x; P.py[i] = y; P.vx[i] = sx; P.vy[i] = sy;
        P.rad[i] = r * size; P.drag[i] = k; P.kind[i] = type;
        P.head[i] = Math.atan2(sy, sx); P.elong[i] = st; P.born[i] = delay;
      };
      const rim = (a, o) => [cx + Math.cos(a) * (hx + o), cy + Math.sin(a) * (hy + o)];
      const s1 = R() * TAU, s2 = R() * TAU;
      const lobeAt = (a) => 1 + 0.5 * (0.5 * Math.sin(3 * a + s1) + 0.3 * Math.sin(5 * a + s2));
      const M = (n) => Math.round(n * dens);
      // core: heavy, slow droplets that hug the rim and pile into the mass
      for (let i = 0; i < M(26); i++) {
        const a = R() * TAU, p = rim(a, 0), sp = (0.15 + 0.35 * R()) * lobeAt(a) * strength;
        add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.022 + 0.03 * R() * R(), 7, 0, 0);
      }
      // rim: mid-weight droplets that break the outline into lumps and stubby lobes
      for (let i = 0; i < M(16); i++) {
        const a = R() * TAU, p = rim(a, 0.01), sp = (0.6 + 0.8 * R()) * lobeAt(a) * strength;
        add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.007 + 0.01 * R(), 7, 1, 0.3);
      }
      // jets: strings of droplets with graded speed that draw out into tapered
      // strands; the lead bulb pinches off if the neck stretches past kernel reach
      const J = M(6), L = 7;
      for (let j = 0; j < J; j++) {
        const a = ((j + (R() - 0.5) * 0.8) / J) * TAU, dx = Math.cos(a), dy = Math.sin(a);
        const S = (1.3 + 1.3 * R()) * strength, lat = (R() - 0.5) * 0.4 * S, p = rim(a, 0.005);
        for (let k = 0; k <= L; k++) {
          const u = k / L, f = 0.4 + 0.6 * Math.pow(u, 1.1), tip = k === L;
          const r = tip ? 0.005 + 0.005 * R() : (0.009 - 0.0055 * u) * (0.85 + 0.3 * R());
          const v = S * f, w = lat * f * f;
          add(p[0], p[1], dx * v - dy * w, dy * v + dx * w, r, 7, 1, tip ? 0.3 : 1 + 0.4 * R());
        }
      }
      // drops: light, fast debris with low, varied drag
      for (let i = 0; i < M(18); i++) {
        const a = R() * TAU, p = rim(a, 0), sp = (0.8 + 2.2 * Math.pow(R(), 1.3)) * strength;
        add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.0025 + 0.01 * R() * R() * R(), 2.5 + 3 * R(), 2, 0.1 + 0.06 * sp);
      }
      // crown: tiny droplets thrown off the rim a beat after impact
      for (let i = 0; i < M(14); i++) {
        const a = R() * TAU, p = rim(a, 0.04), sp = (0.7 + 0.9 * R()) * strength;
        add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.002 + 0.0025 * R(), 5, 3, 0.3, 0.09 + 0.08 * R());
      }
    }
    // one physics step. Surface tension is a weak attraction between droplets
    // whose kernels overlap but have drifted apart. While the slab sinks the
    // droplets are drawn onto it; once it is released they slide off and thin.
    _simStep(dt, sw, sinking) {
      const P = this._P;
      if (!P || !P.n) return;
      P.t += dt;
      const t = P.t;
      if (!sinking && P.rel < 0 && t > 0.6) P.rel = t;
      if (P.rel >= 0 && t - P.rel > 0.8) { P.n = 0; return; }
      const n = P.n, px = P.px, py = P.py, vx = P.vx, vy = P.vy, rad = P.rad;
      for (let i = 0; i < n; i++) {
        if (P.born[i] > t) continue;
        const ri = rad[i], Ri = ri / KQ, mi = (ri / 0.01) * (ri / 0.01);
        for (let j = i + 1; j < n; j++) {
          if (P.born[j] > t) continue;
          const rj = rad[j], reach = (Ri + rj / KQ) * 0.9;
          const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
          if (d2 >= reach * reach) continue;
          const d = Math.sqrt(d2) || 1e-6, rest = (ri + rj) * 0.95;
          if (d <= rest) continue;
          const s = (d - rest) / (reach - rest), f = 8 * (d - rest) * (1 - s);
          const ax = (f * dx) / d, ay = (f * dy) / d, mj = (rj / 0.01) * (rj / 0.01);
          vx[i] += (ax / mi) * dt; vy[i] += (ay / mi) * dt;
          vx[j] -= (ax / mj) * dt; vy[j] -= (ay / mj) * dt;
        }
      }
      const cx = this._cx || 0, cy = this._cy || 0, hx = (this._halfX || 0.3) * 0.9, hy = HALF_Y * 0.85;
      // as the slab sinks the core droplets are assigned spots that tile its
      // face, so at full depth the globs cover it completely with no gaps
      let core = 0;
      for (let i = 0; i < n; i++) if (P.kind[i] === 0) core++;
      const cols = Math.max(2, Math.round(Math.sqrt(core * (hx / hy))));
      const rows = Math.max(1, Math.ceil(core / cols));
      let ci = 0;
      for (let i = 0; i < n; i++) {
        if (P.born[i] > t) continue;
        if (sw > 0) {
          let tx, ty;
          if (P.kind[i] === 0) {
            const c = ci % cols, r = Math.floor(ci / cols);
            ci++;
            tx = cx - hx + ((c + 0.5) / cols) * 2 * hx;
            ty = cy - hy + ((r + 0.5) / rows) * 2 * hy;
          } else {
            tx = Math.max(cx - hx, Math.min(cx + hx, px[i]));
            ty = Math.max(cy - hy, Math.min(cy + hy, py[i]));
          }
          vx[i] += (tx - px[i]) * 12.0 * sw * dt;
          vy[i] += (ty - py[i]) * 12.0 * sw * dt;
        }
        if (P.rel >= 0) {
          // run-off: the dome sheds the liquid down its slope — straight toward
          // the nearest edge of the slab, fastest near the crown, then it drains
          const ox = px[i] - cx, oy = py[i] - cy;
          const ex = Math.max(0, hx - Math.abs(ox)), ey = Math.max(0, hy - Math.abs(oy));
          let dx, dy;
          if (ex < ey) { dx = Math.sign(ox) || 1; dy = 0; } else { dx = 0; dy = Math.sign(oy) || 1; }
          const onFace = ex > 0 && ey > 0 ? 1 : 0.35;
          vx[i] += dx * 2.2 * onFace * dt; vy[i] += dy * 2.2 * onFace * dt;
        }
        const damp = Math.exp(-(P.drag[i] + 6 * sw) * dt);
        vx[i] *= damp; vy[i] *= damp;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      }
    }
    _uploadParts(sw) {
      const P = this._P, gl = this._gl, u = this._u, out = this._part;
      const t = P.t, life = P.rel < 0 ? 1 : Math.max(0, 1 - (t - P.rel) / 0.8);
      for (let i = 0; i < P.n; i++) {
        const k = P.kind[i];
        // swell is capped so the merged mass stays slab-sized, never a flood;
        // core droplets grow enough to close the gaps between their tiled spots
        const cap = k === 0 ? 0.075 : 0.05;
        const r = P.born[i] > t ? 0.0001 : Math.min(P.rad[i] * (1 + GROW[k] * sw), cap) * life * life;
        const speed = Math.hypot(P.vx[i], P.vy[i]);
        const th = speed > 0.05 ? Math.atan2(P.vy[i], P.vx[i]) : P.head[i];
        const stretch = Math.min(P.elong[i] * (1 - sw) + (k === 0 ? 0 : Math.min(speed * 0.3, 1.2)), 3);
        out[i * 4] = P.px[i]; out[i * 4 + 1] = P.py[i]; out[i * 4 + 2] = r / KQ;
        out[i * 4 + 3] = Math.round((1 + stretch) * 10) * 8 + (((th % TAU) + TAU) % TAU);
      }
      gl.uniform4fv(u.uPart, out);
      gl.uniform1i(u.uCount, P.n);
      gl.uniform1f(u.uSplatT, t);
      gl.uniform1f(u.uSeed, P.seed);
    }

    _initGL() {
      const gl = this._cv.getContext("webgl2", { antialias: false, alpha: false });
      if (!gl) return false;
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          console.error("liquid-button shader:", gl.getShaderInfoLog(sh));
          gl.deleteShader(sh);
          return null;
        }
        return sh;
      };
      const vs = compile(gl.VERTEX_SHADER, VS);
      const fs = compile(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("liquid-button link:", gl.getProgramInfoLog(prog));
        return false;
      }
      gl.useProgram(prog);
      gl.bindVertexArray(gl.createVertexArray());
      this._gl = gl;
      this._u = {};
      ["uRes", "uTime", "uPtr", "uPtrOn", "uBtnC", "uBtnHalf", "uBtnR", "uDepth", "uVel", "uFocus", "uMode", "uMotion", "uGoop", "uVisc", "uMerc", "uTilt", "uGlob", "uRip", "uPart", "uCount", "uSplatT", "uSeed"].forEach(
        (k) => (this._u[k] = gl.getUniformLocation(prog, k))
      );
      this._rip = new Float32Array(24);
      this._initParts();
      this._probe = new Uint8Array(4 * 64 * 20);
      this._layout();
      return true;
    }

    _layout() {
      const w = this.clientWidth;
      const h = this.clientHeight;
      if (!w || !h) return false;
      const aspect = w / h;
      this._halfX = Math.min(0.3, aspect * 0.5 - 0.09);
      this._btn.style.width = Math.round(this._halfX * 2 * h) + "px";
      this._btn.style.height = Math.round(HALF_Y * 2 * h) + "px";
      this._btn.style.fontSize = Math.max(15, Math.round(h * 0.048)) + "px";
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (this._cv.width !== pw || this._cv.height !== ph) {
        this._cv.width = pw;
        this._cv.height = ph;
        this._gl.viewport(0, 0, pw, ph);
      }
      return true;
    }

    // Paint once, synchronously, as soon as the box has a real size — a first
    // frame must not depend on rAF (background tabs, static captures, print).
    _settle() {
      if (this._settled) return;
      if (this._layout() && this._step) {
        this._settled = true;
        this._step();
        this._measure();
        return;
      }
      if ((this._tries = (this._tries || 0) + 1) < 60) {
        requestAnimationFrame(() => this._settle());
        setTimeout(() => this._settle(), 50);
      }
    }

    _loop() {
      const gl = this._gl;
      const s = this._state;
      const t0 = performance.now();
      let last = t0;
      let frame = 0;

      const step = () => {
        this._layout();
        const now = performance.now();
        const t = (now - t0) / 1000;
        let dt = Math.min((now - last) / 1000, 0.06) * (window.__liquidTimeScale || 1);
        last = now;

        // --- viscous depth integration (fixed substeps) ----------------------
        // the slab only goes under on a click (a ~1.5s dunk, then it bobs back);
        // hovering just weighs it down a touch and tips it toward the pointer
        const pressed = now / 1000 - s.pressAt < 1.5;
        const visc = this._visc;
        const hoverY = 0.014 - s.prox * 0.022;
        const target = this._disabled ? -0.34 : pressed ? -0.30 : hoverY;
        const k = this._disabled ? 7.5 : pressed ? 18 : 22;
        if (s.prox > 0.6 && !this._wasUnder) this._spawn(this._cx || 0, this._cy || 0, 0.25);
        this._wasUnder = s.prox > 0.6;
        let left = dt;
        while (left > 0) {
          const h = Math.min(left, 1 / 120);
          left -= h;
          // drag rises steeply near the surface: breaking the meniscus takes work
          const cling = 1 + 2.6 * Math.exp(-s.y * s.y * 900);
          const c = (this._disabled ? 6.4 : 8.2) * visc * cling;
          s.v += (target - s.y) * k * h - s.v * c * h;
          s.y += s.v * h;
          this._simStep(h, s.goop, this._disabled || pressed);
          // tilt: like a ball rolling on a plank — the edge under the pointer
          // dips, the far edge lifts; underdamped so it rocks before settling
          const under = this._disabled || pressed ? 0 : s.prox;
          const tx = -(s.ptr[0] - (this._cx || 0)) * under * 0.55;
          const ty = -(s.ptr[1] - (this._cy || 0)) * under * 0.55;
          const tk = 60;
          const tc = 5.5 * visc;
          s.tiltV[0] += (tx - s.tilt[0]) * tk * h - s.tiltV[0] * tc * h;
          s.tiltV[1] += (ty - s.tilt[1]) * tk * h - s.tiltV[1] * tc * h;
          s.tilt[0] += s.tiltV[0] * h;
          s.tilt[1] += s.tiltV[1] * h;
        }
        s.focus += ((this._focusOn ? 1 : 0) - s.focus) * 0.14;
        const goopT = Math.max(0, Math.min(1, -s.y / 0.26));
        s.goop += (goopT - s.goop) * 0.10;
        s.ptrOn += ((this._ptrOn || 0) - s.ptrOn) * 0.12;
        s.modeT += (s.mode - s.modeT) * 0.09;
        const mercTarget = Math.max(s.merc, this._mercOnSink ? Math.pow(s.goop, 0.7) : 0);
        s.mercT += (mercTarget - s.mercT) * 0.07;

        // button drifts a little toward the pointer — the liquid drags it
        const pull = this._disabled ? 0 : 0.045;
        const tx = this._pt ? s.ptr[0] * pull : 0;
        const ty = this._pt ? s.ptr[1] * pull : 0;
        this._cx = (this._cx || 0) + (tx - (this._cx || 0)) * 0.04;
        this._cy = (this._cy || 0) + (ty - (this._cy || 0)) * 0.04;

        this._rip.fill(0);
        s.ripples.forEach((r, i) => {
          this._rip[i * 4] = r.x;
          this._rip[i * 4 + 1] = r.y;
          this._rip[i * 4 + 2] = r.t - t0 / 1000;
          this._rip[i * 4 + 3] = r.s;
        });

        const u = this._u;
        gl.uniform2f(u.uRes, this._cv.width, this._cv.height);
        gl.uniform1f(u.uTime, t);
        gl.uniform2f(u.uPtr, s.ptr[0], s.ptr[1]);
        gl.uniform1f(u.uPtrOn, s.ptrOn);
        gl.uniform2f(u.uBtnC, this._cx, this._cy);
        gl.uniform2f(u.uBtnHalf, this._halfX, HALF_Y);
        gl.uniform1f(u.uBtnR, RADIUS);
        gl.uniform1f(u.uDepth, s.y);
        gl.uniform1f(u.uVel, s.v);
        gl.uniform1f(u.uFocus, s.focus);
        gl.uniform1f(u.uMode, s.modeT);
        gl.uniform1f(u.uMotion, this._reduce ? 0 : 1);
        gl.uniform1f(u.uGoop, s.goop);
        gl.uniform1f(u.uVisc, visc);
        gl.uniform1f(u.uMerc, s.mercT);
        gl.uniform2f(u.uTilt, s.tilt[0], s.tilt[1]);
        gl.uniform3f(u.uGlob, this._num("globsize", 1), this._num("globdensity", 0.5), this._num("globheight", 1));
        this._uploadParts(s.goop);
        gl.uniform4fv(u.uRip, this._rip);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // the DOM label follows the slab down
        const sub = Math.max(0, -s.y) / 0.34;
        this._btn.style.transform =
          "translate(-50%,-50%) translate(" +
          (this._cx * this.clientHeight).toFixed(1) +
          "px," +
          (-this._cy * this.clientHeight).toFixed(1) +
          "px) scale(" +
          (1 - sub * 0.045).toFixed(3) +
          ") perspective(600px) rotateX(" +
          (-s.tilt[1] * 55).toFixed(2) +
          "deg) rotateY(" +
          (s.tilt[0] * 55).toFixed(2) +
          "deg)";
        this._btn.style.filter = sub > 0.02 ? "blur(" + (sub * 0.7).toFixed(2) + "px)" : "none";

        if (++frame % 12 === 0) this._measure();
      };

      this._step = step;
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        this._lastRaf = performance.now();
        step();
      };
      tick();
      // hidden tabs and static captures never fire rAF; keep the surface alive
      this._watch = setInterval(() => {
        if (performance.now() - (this._lastRaf || 0) > 250) step();
      }, 100);
    }

    // Read the rendered pixels behind the label and solve ink + scrim for APCA.
    _measure() {
      const gl = this._gl;
      const cv = this._cv;
      const r = this._btn.getBoundingClientRect();
      const host = this.getBoundingClientRect();
      if (!r.width || !host.height) return;
      const sx = cv.width / host.width;
      const sy = cv.height / host.height;
      const w = Math.max(8, Math.min(64, Math.round(r.width * 0.6 * sx)));
      const h = Math.max(4, Math.min(20, Math.round(r.height * 0.4 * sy)));
      const x = Math.round((r.left - host.left + r.width / 2) * sx - w / 2);
      const y = Math.round(cv.height - (r.top - host.top + r.height / 2) * sy - h / 2);
      gl.readPixels(
        Math.max(0, Math.min(cv.width - w, x)),
        Math.max(0, Math.min(cv.height - h, y)),
        w,
        h,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._probe
      );
      let rr = 0;
      let gg = 0;
      let bb = 0;
      const n = w * h;
      for (let i = 0; i < n; i++) {
        rr += this._probe[i * 4];
        gg += this._probe[i * 4 + 1];
        bb += this._probe[i * 4 + 2];
      }
      const bg = [rr / n / 255, gg / n / 255, bb / n / 255];

      let ink = INKS[0];
      let lc = 0;
      INKS.forEach((cand) => {
        const v = Math.abs(apcaLc(hexRgb(cand), bg));
        if (v > lc) {
          lc = v;
          ink = cand;
        }
      });
      // sunk: the label reads as unavailable — lighter weight and its ink pulled
      // toward the liquid, but only as far as APCA Lc 64 (still clears body text)
      const sunk = this._disabled;
      const DIS_TARGET = 64;
      let inkRgb = hexRgb(ink);
      if (sunk && lc > DIS_TARGET + 3) {
        for (let m = 0.05; m <= 0.8; m += 0.05) {
          const mixed = inkRgb.map((c, i) => c * (1 - m) + bg[i] * m);
          const v = Math.abs(apcaLc(mixed, bg));
          if (v < DIS_TARGET) break;
          inkRgb = mixed;
          lc = v;
        }
      }
      const inkCss = "rgb(" + inkRgb.map((c) => Math.round(c * 255)).join(",") + ")";
      this._btn.style.fontWeight = sunk ? "500" : "600";
      this._btn.style.letterSpacing = sunk ? "0.04em" : "0.01em";

      // still short of target: fade a scrim in behind the text until it clears
      let alpha = 0;
      if (lc < APCA_TARGET) {
        const inkY = apcaY(hexRgb(ink));
        const scrim = hexRgb(inkY < 0.3 ? SCRIMS.dark : SCRIMS.light);
        for (let a = 0.1; a <= 0.95; a += 0.05) {
          const mixed = bg.map((c, i) => scrim[i] * a + c * (1 - a));
          const v = Math.abs(apcaLc(inkRgb, mixed));
          if (v >= APCA_TARGET + 2) {
            alpha = a;
            lc = v;
            break;
          }
          alpha = a;
          lc = v;
        }
        this._btn.style.background =
          "radial-gradient(closest-side, rgba(" +
          (inkY < 0.3 ? "251,248,241," : "12,10,6,") +
          alpha.toFixed(2) +
          ") 0%, rgba(" +
          (inkY < 0.3 ? "251,248,241,0" : "12,10,6,0") +
          ") 100%)";
      } else {
        this._btn.style.background = "transparent";
      }
      this._btn.style.color = inkCss;
      const rounded = Math.round(lc);
      if (rounded !== this._lc) {
        this._lc = rounded;
        this._paintStatus();
        this.dispatchEvent(
          new CustomEvent("liquidcontrast", {
            bubbles: true,
            detail: { lc: rounded, ink, scrim: +alpha.toFixed(2), submerged: +Math.max(0, -this._state.y).toFixed(3) },
          })
        );
      }
    }

    _fallback() {
      const pad = document.createElement("div");
      pad.setAttribute("aria-hidden", "true");
      pad.style.cssText =
        "position:absolute;left:50%;top:50%;width:60%;height:17%;transform:translate(-50%,-50%);" +
        "border-radius:999px;background:#faf5ea;transition:opacity 700ms ease, filter 700ms ease";
      this.insertBefore(pad, this._btn);
      this._btn.style.width = "60%";
      this._btn.style.height = "17%";
      this._btn.style.color = "#12100c";
      const apply = () => {
        const d = this._disabled;
        pad.style.opacity = d ? "0.22" : "1";
        pad.style.filter = d ? "blur(3px)" : "none";
        this._btn.style.color = d ? "#fffaef" : "#12100c";
      };
      this._syncDisabled = ((orig) =>
        function () {
          orig.call(this);
          apply();
        })(LiquidButton.prototype._syncDisabled).bind(this);
      apply();
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._watch) clearInterval(this._watch);
    }
  }

  if (!customElements.get("ink-liquid-button")) customElements.define("ink-liquid-button", LiquidButton);
})();
