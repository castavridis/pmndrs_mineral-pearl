// LiquidPond: the liquid of the "Liquid Button Ink" component study
// (pmndrs / lab / viscous / ink), ported from its <ink-liquid-button> custom
// element with the shaders byte-for-byte and the JS as close as the React host
// allows. A rounded slab floats on a viscous surface; sunk, it goes under with
// an ink-splat particle swallow, and the DOM content riding on it follows it
// down. Raw WebGL2 (GLSL ES 3.00): one fullscreen triangle from gl_VertexID,
// no VBO. The liquid, the slab and the meniscus are all drawn in the fragment
// shader; the content is real DOM on top, so it stays selectable, zoomable,
// keyboard-operable and screen-reader addressable.
//
// Differences from the study (marked "(port)" in the code): the slab takes
// its size from the DOM content (the study sized the label from the slab);
// the layer is transparent with a hole where the slab's face is still dry, so
// the DOM content shows through it and the liquid closes over it as it sinks,
// with no dry edge left at full depth; the APCA ink/scrim measurement is gone
// with it (covered content need not stay legible); options replace
// attributes; the DOM is owned by `InkSink`; a press is a method.

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
uniform float uUnit;     // (port) device px per uv unit: the study used the canvas height
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
uniform float uGlobShade; // (port) 0: the mass is pure coverage, no sheen or lip
// (port) the mineral and pearl looks, lifted out of the composites' constants
uniform vec3  uMinBase;   // mineral body colour in the troughs of the nacre noise
uniform vec3  uMinHigh;   // mineral body colour on its crests
uniform float uMinIrid;   // iridescence strength (study 0.70)
uniform float uMinSpec;   // specular strength (study 0.30)
uniform float uMinGamma;  // output gamma (study 0.82)
uniform vec3  uPearlCream; // pearl body colour
uniform vec3  uPearlShade; // pearl shadow tint on the nacre crests
uniform float uPearlNacre; // nacre modulation depth (study 0.070)
uniform float uPearlIrid;  // iridescence strength (study 0.60)
uniform float uPearlSpec;  // specular strength (study 0.50)
uniform float uStoneGray;  // mineral: how far the crests go to the highlight colour (study 1)
uniform float uClouding;   // pearl: shade mix on the crests (study 0.45)
// (port) shared iridescence and facet glitter, lifted out of the constants
uniform float uWhite;      // rainbow whitening (study 0.26)
uniform float uSpread;     // spectrum phase scale (study 1)
uniform float uSwirl;      // nacre noise frequency (study 2.2)
uniform float uGlowK;      // pointer halo strength (study 0.5)
uniform float uGrainSize;  // glitter grid scale (study 130)
uniform float uGrainDens;  // fraction of grid cells that carry a facet (study 0.55)
uniform float uGlitterDens; // soft halo around each facet (study 0.22)
uniform float uFacetSharp; // facet specular exponent (study 230)
uniform float uGlint;      // glitter strength multiplier (study 1)
uniform float uLamina;     // (port) striation density: the laminar lines' frequency (study 72)
uniform float uGlintPtr;   // (port) how much the facets light from over the pointer (0: the study's fixed light)
uniform float uDimple;     // (port) depth of the dent the pointer makes in the surface (study 1)
// (port) the pearl body's own spectrum, dimple and viscosity: the two bodies
// are two materials in one shader, each pixel taking the one its mode says,
// so a masked switch shows the incoming body whole, not in the other's dress
uniform float uWhiteP, uSpreadP, uSwirlP, uGlowKP, uGrainSizeP, uGrainDensP, uGlitterDensP, uFacetSharpP, uGlintP, uGlintPtrP, uLaminaP, uDimpleP, uViscP;
// the values in force at this pixel (set at the top of main)
float kWhite, kSpread, kSwirl, kGlowK, kGrainSize, kGrainDens, kGlitterDens, kFacetSharp, kGlint, kGlintPtr, kLamina, kDimple, kVisc;
uniform float uSlabOn;     // (port) 0: no slab at all, the liquid alone (the ground, the nav pill)
uniform vec2  uShiftPx;    // (port) well: this canvas's centre from the page ground's, device px
uniform vec2  uVigRes;     // (port) the vignette's frame: the ground's canvas when in a well
uniform float uFeather;    // (port) well: fade the layer out over this many device px at its edge
// (port) a masked switch of body: where the mask's alpha is 1 the liquid is
// uModeTo instead of uMode. The mask is the ink splat, in screen space;
// uMaskRect is this canvas's place in it (x, y from the top, w, h, all 0..1)
uniform sampler2D uMask;
uniform float uMaskOn;
uniform float uModeTo;
uniform vec4  uMaskRect;
// (port) quicksilver: the chrome reflection's colours and strengths
uniform vec3  uMercFloor;  // reflected below the horizon (study 0.06,0.06,0.07)
uniform vec3  uMercSky;    // reflected above it (study 0.93,0.94,0.96)
uniform float uMercHorizon; // the hard horizon band (study 0.55)
uniform float uMercTop;    // the top light's highlight (study 0.9)
uniform float uMercSpec;   // specular (study 0.8)
uniform float uMercIrid;   // iridescence bleeding into the chrome (study 0.10)
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
  // (port) The dent the pointer makes: a wide bowl, a tight deep core, and the
  // meniscus the displaced liquid pushes up around it. The core used to be
  // reached only through uGoop, which rises as a slab goes under — so a ground
  // with no slab, which is every page-sized one, never got past the shallow
  // bowl and the cursor barely marked it. High tension wants the core always.
  float bowl = 0.018 * exp(-pd * pd * 26.0);
  float core = 0.034 * exp(-pd * pd * 110.0) * mix(0.9, 1.0, uGoop);
  float rim  = 0.011 * exp(-(pd - 0.155) * (pd - 0.155) * 90.0);
  h -= uPtrOn * kDimple * (bowl + core - rim);

  float thin = clamp(1.0 - kVisc * 0.5, 0.0, 1.0);
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
  float collar = exp(-o * 10.0) * uSlabOn;
  h -= collar * 0.050 * clamp(1.0 + ld / 0.34, 0.0, 1.0) * (1.0 - uGoop);
  // cling: a sinking slab drags the surface down with it, a rising one lifts it
  h += clamp(uVel, -1.2, 1.2) * 0.30 * exp(-o * 3.2) * (1.0 - 0.6 * uGoop) * uSlabOn;
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
  // which body this pixel is: the pond's mode, or under a mask the incoming one
  float modeP = uMode;
  if (uMaskOn > 0.5) {
    vec2 fuv = gl_FragCoord.xy / uRes;
    vec2 muv = vec2(uMaskRect.x + fuv.x * uMaskRect.z, uMaskRect.y + (1.0 - fuv.y) * uMaskRect.w);
    // the mask is a WebGL canvas: Chrome hands those over with the top row
    // at t = 0, the reverse of a 2D canvas, so the top-based uv samples as is
    modeP = mix(uMode, uModeTo, texture(uMask, muv).a);
  }
  // the material in force here: the mineral body's numbers, the pearl's, or between
  kWhite = mix(uWhite, uWhiteP, modeP);
  kSpread = mix(uSpread, uSpreadP, modeP);
  kSwirl = mix(uSwirl, uSwirlP, modeP);
  kGlowK = mix(uGlowK, uGlowKP, modeP);
  kGrainSize = mix(uGrainSize, uGrainSizeP, modeP);
  kGrainDens = mix(uGrainDens, uGrainDensP, modeP);
  kGlitterDens = mix(uGlitterDens, uGlitterDensP, modeP);
  kFacetSharp = mix(uFacetSharp, uFacetSharpP, modeP);
  kGlint = mix(uGlint, uGlintP, modeP);
  kGlintPtr = mix(uGlintPtr, uGlintPtrP, modeP);
  kLamina = mix(uLamina, uLaminaP, modeP);
  kDimple = mix(uDimple, uDimpleP, modeP);
  kVisc = mix(uVisc, uViscP, modeP);
  // (port) in a well the frame is the page ground's: the same point of the
  // page samples the same liquid in both canvases, so the two are one surface
  vec2  fc = gl_FragCoord.xy - 0.5 * uRes + uShiftPx;
  vec2  uv = fc / uUnit;
  float t  = uTime;
  // (port) the study's vignette assumed a near-square canvas; on a wide pill
  // uv.x runs to several units and the ends went black. Measure the vignette
  // against the longer edge instead.
  vec2  vuv = fc / max(uVigRes.x, uVigRes.y);
  float vig = dot(vuv, vuv) * 4.0;

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
  sheen *= uGlobShade;
  lip   *= uGlobShade;

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
  env += exp(-abs(R.y - 0.18) * 14.0) * uMercHorizon;
  env += pow(max(dot(N, normalize(vec3(0.4, 0.9, 0.5))), 0.0), 60.0) * uMercTop;
  vec3 merc = mix(uMercFloor, uMercSky, clamp(env, 0.0, 1.0));
  merc += vec3(1.0) * spec * uMercSpec;

  vec2  dl  = uv - uPtr;
  float gd  = length(dl);
  vec2  rad = dl / max(gd, 0.0001);
  float cyc = gd * 2.4;
  float band = smoothstep(0.35, 0.9, cyc) * (1.0 - smoothstep(1.9, 2.6, cyc));
  float halo = exp(-gd * gd * 6.0) * 0.55 + exp(-gd * gd * 28.0) * 0.45;
  float glow = halo * uPtrOn * kGlowK;

  float nac = fbm3(uv * kSwirl + vec2(0.0, t * uMotion * 0.02));
  float lam = vn(uv * vec2(3.0, kLamina) + 11.0);
  float phase = (nac * 1.9 + fres * 1.5 + lam * 0.16 + cyc * 0.30) * kSpread - t * uMotion * 0.02;
  vec3  irid = mix(brand(phase), vec3(1.0), kWhite);

  // --- slab geometry: its shading never changes under the surface; it only
  // fades out (opacity) as the liquid closes over it --------------------------
  // dome: the top face crowns gently toward the middle, so liquid that has
  // climbed onto it runs off when the slab resurfaces
  float bd0   = sdRound(uv - uBtnC, uBtnHalf, uBtnR);
  float dx0   = clamp(-bd0 / 0.085, 0.0, 1.0);
  float domeH = 0.028 * (1.0 - (1.0 - dx0) * (1.0 - dx0));
  float subm  = clamp(hgt - (uDepth + domeH + dot(uTilt, uv - uBtnC)), 0.0, 1.0);
  float dry   = 1.0 - smoothstep(0.0, 0.014, subm);
  float slabA = 1.0;
  vec2  rp    = uv;
  float bd    = sdRound(rp - uBtnC, uBtnHalf, uBtnR);
  float px    = 1.6 / uUnit;
  float slabRaw = smoothstep(px, -px, bd) * slabA * uSlabOn;
  // (port) the ground closes over the slab: wherever the surface stands higher
  // than the slab's face it is under, and the ink mass covers the rest. Fully
  // sunk, nothing of the face is left dry, so no edge can show.
  float covered = clamp(max(inkM, 1.0 - dry), 0.0, 1.0);
  // thick, translucent liquid: the slab is still seen through it while it is
  // shallow, and fades away as it sinks
  float seen = exp(-max(subm, 0.0) * 16.0) * (1.0 - inkM);
  float bMask = slabRaw * (1.0 - covered);
  // (port) the rim highlight belongs to the dry face; under the liquid it goes
  float rim   = exp(-abs(bd) * 70.0) * (1.0 - inkM) * (1.0 - covered) * uSlabOn;
  // (port) the shadow the slab casts on the liquid around it fades as it goes
  // under: nothing stands proud of the surface to cast one
  float under = smoothstep(-0.02, -0.14, uDepth);
  float shade = exp(-max(bd, 0.0) * 9.0) * step(0.0, bd) * (1.0 - inkM) * (1.0 - under) * uSlabOn;

  // --- facet glitter ---------------------------------------------------------
  // (port) a light hanging over the pointer: facets that catch it flare as the
  // mouse sweeps by, so the glitter answers the hand instead of only drifting
  vec3  Lp = normalize(vec3(uPtr - uv, 0.55));
  vec3  Hp = normalize(Lp + V);
  vec3  Hg = normalize(mix(Hv, Hp, uPtrOn * kGlintPtr));
  // (port) the study set one facet per grid cell, jittered within it, and the
  // lattice showed through. Two layers on grids of different scale and
  // rotation, jitter past the cell, per-facet size, and a density that ebbs
  // with a slow noise make the scatter read as random.
  vec3  sparkC = vec3(0.0);
  float sparkI = 0.0;
  for(int L = 0; L < 2; L++){
    float lf = float(L);
    float ang = 0.61 * lf;
    vec2 guv = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * uv * kGrainSize * (1.0 - 0.37 * lf) + lf * 7.3;
    vec2 gid = floor(guv), gv = fract(guv) - 0.5;
    float dens = kGrainDens * (0.35 + 0.9 * vn(gid * 0.11 + lf * 3.0));
    for(int y = -1; y <= 1; y++){
      for(int x = -1; x <= 1; x++){
        vec2 o = vec2(float(x), float(y));
        vec3 r = h33(gid + o + lf * 19.0);
        float alive = step(r.x, dens);
        vec2  cp = o + (r.yz - 0.5) * 1.7;
        float sz = 0.55 + 1.1 * h21(gid + o + 4.2 + lf);
        float d  = length(gv - cp) / sz;
        float core = smoothstep(0.13, 0.0, d);
        vec2 tl = (h22(gid + o + 11.71) - 0.5) * 1.5;
        tl += 0.05 * uMotion * vec2(sin(t * (0.5 + r.y * 1.3) + r.z * 21.0),
                                    cos(t * (0.4 + r.z * 1.1) + r.y * 17.0));
        vec3 fn = normalize(vec3(tl, 0.72));
        float sp = pow(max(dot(fn, Hg), 0.0), kFacetSharp) * (0.6 + r.z * 0.9);
        float w  = sp * (core + kGlitterDens * exp(-d * d * 90.0)) * alive * (1.0 - 0.35 * lf);
        sparkC += mix(vec3(1.0), brand(cyc - 1.0 + dot(tl, rad) * 0.14 + r.y * 0.1 - t * 0.02) * 1.25, 0.82) * w;
        sparkI += w;
      }
    }
  }
  float sparkMask = mix(1.0, 0.12, bMask);

  float ring = exp(-abs(bd - 0.045) * 55.0) * uFocus * (0.55 + 0.45 * sin(t * 4.0 * uMotion)) * uSlabOn;
  vec3  focusC = vec3(0.710, 0.906, 0.000);   // pmndrs green 400
  // dome shading from the crown's true slope: steep at the rim, flat on top
  vec2  dg = vec2(bd0 - sdRound(uv + vec2(0.004, 0.0) - uBtnC, uBtnHalf, uBtnR),
                  bd0 - sdRound(uv + vec2(0.0, 0.004) - uBtnC, uBtnHalf, uBtnR)) / 0.004;
  float slope = 0.028 * 2.0 * (1.0 - dx0) / 0.085;   // d domeH / d(-bd)
  vec3  domeN = normalize(vec3(-dg * slope * 0.9, 1.0));  // dg points uphill; the normal tilts outward at the rim
  float domeL = dot(domeN, L);
  float crown = clamp((domeL - dot(vec3(0.0, 0.0, 1.0), L)) * 0.35, -0.08, 0.08);

  // --- mineral composite -----------------------------------------------------
  vec3 liqD = uMinBase;
  liqD = mix(liqD, uMinHigh, smoothstep(0.25, 0.80, nac) * uStoneGray);
  liqD *= 0.80 + 0.40 * lamb;
  liqD += irid * (0.07 + 0.75 * fres) * uMinIrid;
  liqD += vec3(1.0) * spec * uMinSpec;
  liqD += vec3(0.70, 0.78, 1.00) * glow * 0.09;
  liqD *= 1.0 - 0.50 * shade;
  liqD  = liqD / (1.0 + liqD * 0.85);
  liqD  = pow(liqD, vec3(uMinGamma));


  vec3 cream = vec3(0.980, 0.961, 0.918);
  vec3 slabD = cream * (0.90 + 0.10 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabD *= 1.0 + crown;
  slabD *= 0.95 + 0.06 * vn(rp * 46.0);
  slabD += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.08;

  vec3 colD = mix(liqD, slabD, bMask);
  colD += vec3(0.16) * sheen * inkM;
  colD *= 1.0 - 0.22 * lip;
  colD += sparkC * sparkMask * 1.15 * (1.0 + glow) * kGlint;
  colD += vec3(0.80, 0.86, 1.00) * rim * 0.20 * slabA;
  colD += focusC * ring * 0.55;
  colD *= 1.0 - 0.28 * vig;
  colD  = clamp(colD, 0.0, 1.0);

  // --- pearl composite -------------------------------------------------------
  vec3 liqL = uPearlCream * (0.900 + uPearlNacre * nac + 0.028 * lam);
  liqL = mix(liqL, uPearlShade, smoothstep(0.50, 0.90, nac) * uClouding);
  liqL = mix(liqL, irid, clamp((0.10 + 0.55 * band) * (0.22 + 0.78 * fres) * uPearlIrid, 0.0, 0.52));
  liqL += vec3(0.10, 0.10, 0.095) * spec * uPearlSpec;
  liqL += vec3(0.030, 0.026, 0.016) * glow * 0.7;
  liqL *= 1.0 - 0.42 * shade;

  vec3 ink = vec3(0.070, 0.062, 0.048);
  vec3 slabL = ink * (1.0 + 0.9 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabL *= 1.0 + crown * 1.6;
  slabL += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.10;

  vec3 colL = mix(liqL, slabL, bMask);
  colL -= vec3(0.14) * sheen * inkM;
  colL *= 1.0 - 0.10 * lip;
  colL = mix(colL, mix(vec3(0.36, 0.35, 0.33), irid * 0.8, band), clamp(sparkI * sparkMask * 0.8 * kGlint, 0.0, 1.0) * 0.45);
  colL += vec3(0.55, 0.52, 0.48) * rim * 0.10 * slabA;
  colL += focusC * 0.75 * ring * 0.60;
  colL *= 1.0 - 0.10 * vig;
  colL  = clamp(colL, 0.0, 1.0);

  // --- mercury composite -----------------------------------------------------
  vec3 liqM = merc + irid * fres * uMercIrid;
  liqM *= 1.0 - 0.35 * shade;
  vec3 slabM = vec3(0.12, 0.115, 0.13) * (0.9 + 0.3 * (1.0 - smoothstep(-0.13, 0.0, bd)));
  slabM *= 1.0 + crown * 1.6;
  slabM += vec3(1.0) * pow(max(dot(N, Hv), 0.0), 46.0) * 0.12;
  vec3 colM = mix(liqM, slabM, bMask);
  colM += vec3(0.35) * sheen * inkM;
  colM *= 1.0 - 0.18 * lip;
  colM += sparkC * sparkMask * 0.35 * kGlint;
  colM += vec3(1.0) * rim * 0.35 * slabA;
  colM += focusC * ring * 0.55;
  colM *= 1.0 - 0.22 * vig;
  colM  = clamp(colM, 0.0, 1.0);

  vec3 outC = mix(mix(colD, colL, modeP), colM, uMerc);
  // (port) the dry face is a hole in the layer: the DOM slab shows through it.
  // Covered, the liquid closes over it, faintly translucent while shallow.
  float alpha = 1.0 - slabRaw * (1.0 - covered) - slabRaw * covered * seen * 0.4;
  // (port) in a well the slab's collar and cling reach past the canvas; the
  // layer feathers out at its edge onto the ground, which is the same liquid
  if (uFeather > 0.0) {
    float edge = min(min(gl_FragCoord.x, uRes.x - gl_FragCoord.x), min(gl_FragCoord.y, uRes.y - gl_FragCoord.y));
    alpha *= smoothstep(0.0, uFeather, edge);
  }
  fragColor = vec4(outC * alpha, alpha);
}
`;

// one clock for every pond, so a pond in a well runs in step with the ground
const EPOCH = performance.now();
const MAXP = 128;
const KQ = 0.541;
const TAU = Math.PI * 2;
const GROW = [2.2, 0.45, 0.3, 0.3]; // how much each droplet kind swells as the mass closes over the slab

export type Liquid = 'mineral' | 'pearl' | 'mercury';

/** The mineral body: dark, glittering. Colours are CSS hex; numbers as in the study. */
export interface MineralLook {
  base: string;
  highlight: string;
  /** how far the nacre crests go toward the highlight colour (study 1) */
  stoneGray: number;
  iridescence: number;
  specular: number;
  gamma: number;
}
/** The pearl (nacre) body: cream with a shifting iridescence. */
export interface PearlLook {
  cream: string;
  shade: string;
  /** shade mix on the nacre crests (study 0.45) */
  clouding: number;
  nacre: number;
  iridescence: number;
  specular: number;
}
/** Iridescence and facet glitter shared by every body. */
export interface SpectrumLook {
  /** rainbow whitening (study 0.26) */
  white: number;
  /** spectrum phase scale (study 1) */
  spread: number;
  /** nacre noise frequency (study 2.2) */
  swirl: number;
  /** pointer halo strength (study 0.5) */
  cursorGlow: number;
  /** glitter grid scale (study 130) */
  grainSize: number;
  /** fraction of grid cells carrying a facet (study 0.55) */
  grainDensity: number;
  /** soft halo around each facet (study 0.22) */
  glitterDensity: number;
  /** facet specular exponent (study 230) */
  facetSharpness: number;
  /** glitter strength multiplier (study 1) */
  glint: number;
  /** how much the facets light from over the pointer; 0 is the study's fixed light */
  glintFollowsPointer: number;
  /** striation density: the laminar lines' frequency (study 72) */
  lamina: number;
}
/** Quicksilver: the chrome reflection of a soft studio. Colours are CSS hex. */
export interface MercuryLook {
  floor: string;
  sky: string;
  horizon: number;
  topLight: number;
  specular: number;
  iridescence: number;
}
export const MERCURY_DEFAULT: MercuryLook = {
  floor: '#0f0f12',
  sky: '#edeff5',
  horizon: 0.55,
  topLight: 0.9,
  specular: 0.8,
  iridescence: 0.1,
};

/** How much the liquid and the slab answer the pointer. All 1 in the study. */
export interface PointerLook {
  /** master multiplier over the four below */
  reaction: number;
  /** the dent the pointer makes in the surface */
  dimple: number;
  /** the wake it sheds when dragged across the liquid, and the ripple when it reaches the slab */
  wake: number;
  /** how far the slab dips and tips under it */
  tilt: number;
  /** how far the slab drifts toward it */
  drift: number;
}
export const POINTER_DEFAULT: PointerLook = { reaction: 1, dimple: 1, wake: 1, tilt: 1, drift: 1 };
export const SPECTRUM_DEFAULT: SpectrumLook = {
  white: 0.26,
  spread: 1,
  swirl: 2.2,
  cursorGlow: 0.5,
  grainSize: 130,
  grainDensity: 0.55,
  glitterDensity: 0.22,
  facetSharpness: 230,
  glint: 1,
  glintFollowsPointer: 1,
  lamina: 72,
};
/** The study's constants. */
export const MINERAL_DEFAULT: MineralLook = {
  base: '#080709',
  highlight: '#26252b',
  stoneGray: 1,
  iridescence: 0.7,
  specular: 0.3,
  gamma: 0.82,
};
export const PEARL_DEFAULT: PearlLook = {
  cream: '#faf5ea',
  shade: '#c2bdb3',
  clouding: 0.45,
  nacre: 0.07,
  iridescence: 0.6,
  specular: 0.5,
};

export interface PondOptions {
  liquid: Liquid;
  /** 0.15..2, lower = faster, less damped. */
  viscosity: number;
  /** The liquid turns to mercury as the slab goes under, and back as it rises. */
  mercuryOnSink: boolean;
  globSize: number;
  globDensity: number;
  globHeight: number;
  /** Shade the ink mass (wet-edge sheen, darker lip); off, it is pure coverage. */
  globShading: boolean;
  /** Corner radius of the slab, CSS px. */
  radius: number;
  /** Cap on the device pixel ratio (the study: 2). The fullscreen ground uses 1. */
  maxDpr: number;
  /** Keep the drawing buffer after each frame so another context can read this canvas. */
  preserveDrawingBuffer?: boolean;
  /**
   * CSS px per uv unit: the size of every feature (nacre, glitter, ripples,
   * the pointer's dimple). The study used the canvas height, which makes a
   * page-sized ground three times coarser than a card; set it to match.
   */
  unit?: number;
  /**
   * (port) The pond is a patch of the page ground: its liquid is drawn in the
   * viewport's frame (features, vignette, pointer, clock) so it continues the
   * fixed ground's surface seamlessly; only the slab is its own.
   */
  well?: boolean;
  mineral: MineralLook;
  pearl: PearlLook;
  /** Iridescence and glitter of the mineral body (and of everything, without the pearl's own). */
  spectrum: SpectrumLook;
  pointer: PointerLook;
  mercury: MercuryLook;
  /** The pearl body's own spectrum, pointer reaction and viscosity; default the mineral's. */
  spectrumPearl?: SpectrumLook;
  pointerPearl?: PointerLook;
  viscosityPearl?: number;
}

const hex3 = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

/** Background colours of the study's host per liquid (what shows before the first frame). */
export const POND_BG: Record<Liquid, string> = {
  mineral: '#0c0a06',
  pearl: '#faf5ea',
  mercury: '#0c0a06',
};

/** The study's slab colours per liquid: the DOM card wears them under the layer. */
export const SLAB_LOOK: Record<Liquid, { bg: string; fg: string }> = {
  mineral: { bg: '#faf5ea', fg: '#12100c' },
  pearl: { bg: '#12100c', fg: '#fffaef' },
  mercury: { bg: '#1f1e21', fg: '#f2f2f4' },
};

interface Particles {
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  rad: Float32Array;
  drag: Float32Array;
  kind: Uint8Array;
  head: Float32Array;
  elong: Float32Array;
  born: Float32Array;
  n: number;
  t: number;
  seed: number;
  rel: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  s: number;
}

export class LiquidPond {
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** The DOM riding on the slab: it is transformed to follow the slab down. Null: liquid only. */
  readonly slab: HTMLElement | null;
  /** (port) the slab's inner face: it alone takes the tilt, so the body stays in the hole. */
  face: HTMLElement | null = null;
  opts: PondOptions;
  /** False when WebGL2 is missing: the pond then only styles the slab. */
  readonly supported: boolean;

  private _gl: WebGL2RenderingContext | null = null;
  private _u: Record<string, WebGLUniformLocation | null> = {};
  private _rip = new Float32Array(24);
  private _part = new Float32Array(MAXP * 4);
  private _P: Particles | null = null;
  private _state: {
    y: number;
    v: number;
    pressAt: number;
    ripples: Ripple[];
    ptr: [number, number];
    ptrOn: number;
    focus: number;
    prox: number;
    goop: number;
    tilt: [number, number];
    tiltV: [number, number];
    merc: number;
    mercT: number;
    mode: number;
    modeT: number;
  };
  private _sunk = false;
  private _wasSunk: boolean | undefined = undefined;
  private _reduce: boolean;
  private _cx = 0;
  private _cy = 0;
  /** (port) well: the host's centre from the viewport's, uv (the slab's frame offset) */
  private _ox = 0;
  private _oy = 0;
  /** (port) well: the viewport in CSS px (the vignette's frame) */
  private _vw = 0;
  private _vh = 0;
  /** (port) well: ripples belong to the ground; this pond spawns no wake of its own */
  private _noWake = false;
  /** CSS px per uv unit (opts.unit, else the host height) */
  private _unit = 1;
  private _halfX = 0.3;
  private _halfY = 0.086;
  private _radius = 0.082;
  private _pt: [number, number] | null = null;
  private _ptrOn = 0;
  private _wake: [number, number] | null = null;
  private _wasUnder = false;
  private _focusOn = false;
  private _raf = 0;
  private _watch = 0;
  private _lastRaf = 0;
  private _settled = false;
  private _tries = 0;
  private _step: (() => void) | null = null;
  private _ro: ResizeObserver | null = null;
  private _destroyed = false;

  constructor(
    host: HTMLElement,
    canvas: HTMLCanvasElement,
    slab: HTMLElement | null,
    opts: PondOptions
  ) {
    this.host = host;
    this.canvas = canvas;
    this.slab = slab;
    this.opts = opts;
    const liq = opts.liquid;
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
      merc: liq === 'mercury' ? 1 : 0,
      mercT: liq === 'mercury' ? 1 : 0,
      mode: liq === 'pearl' ? 1 : 0,
      modeT: liq === 'pearl' ? 1 : 0,
    };
    this._reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.dataset.liquid = liq;
    this.supported = this._initGL();
    if (!this.supported) {
      this._fallbackApply();
      return;
    }
    this._loop();
    this._settle();
    this._ro = new ResizeObserver(() => {
      if (!this._settled) this._settle();
      else if (this._layout() && performance.now() - this._lastRaf > 250) this._step?.();
    });
    this._ro.observe(host);
    if (slab) this._ro.observe(slab);
  }

  // --- public ---------------------------------------------------------------

  get sunk() {
    return this._sunk;
  }
  /** Sunk, the slab stays under (the study's `disabled`); afloat it bobs back up. */
  set sunk(d: boolean) {
    this._sunk = d;
    if (this._wasSunk !== undefined && this._wasSunk !== d) {
      this._spawn(0, 0, d ? 1.4 : 1.2);
      if (d) this._splat(1.3);
    }
    this._wasSunk = d;
    if (!this.supported) this._fallbackApply();
  }

  setLiquid(liquid: Liquid) {
    this.host.dataset.liquid = liquid;
    if (this.opts.liquid === liquid) return;
    this.opts.liquid = liquid;
    const pearl = liquid === 'pearl';
    this._state.mode = pearl ? 1 : 0;
    this._state.merc = liquid === 'mercury' ? 1 : 0;
    this._spawn(0, 0, 0.6);
  }

  /** Pointer position in the study's uv (height = 1, y up, origin at the host centre). */
  uv(e: { clientX: number; clientY: number }): [number, number] {
    if (this.opts.well) return this._wellUv(e);
    const r = this.host.getBoundingClientRect();
    if (!r.height) return [0, 0];
    return [
      (e.clientX - r.left - r.width / 2) / this._unit,
      -(e.clientY - r.top - r.height / 2) / this._unit,
    ];
  }

  /**
   * (port) An impact at `pt`: the slab takes the hit there, tips into it and
   * plunges, so the liquid closes over that side first and the far side last.
   * It stays under (sunk) afterwards.
   */
  impact(pt: [number, number]) {
    const s = this._state;
    const dx = pt[0] - this._bx;
    const dy = pt[1] - this._by;
    // tip toward the hit: the tilt is the face's height gradient, so the
    // side under the pointer goes lowest. An impulse, not a target: the tilt
    // spring rocks it back while the whole slab goes down.
    s.tiltV[0] += -dx * 9;
    s.tiltV[1] += -dy * 9;
    // and the blow drives it down
    s.v -= 1.1;
    this._spawn(pt[0], pt[1], 1.0);
    this.sunk = true;
  }

  /** A press: the slab goes fully under for a beat with a splash, then bobs back. */
  press(pt: [number, number] | null = this._pt) {
    this._state.pressAt = performance.now() / 1000;
    this._spawn(pt ? pt[0] : 0, pt ? pt[1] : 0, 0.85);
    this._splat(1);
  }

  setFocus(on: boolean) {
    this._focusOn = on;
  }

  point(e: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    if (!r.height) return;
    const [x, y] = this.opts.well
      ? this._wellUv(e)
      : [
          (e.clientX - r.left - r.width / 2) / this._unit,
          -(e.clientY - r.top - r.height / 2) / this._unit,
        ];
    this._state.ptr = [x, y];
    this._ptrOn = 1;
    const b = this.slab?.getBoundingClientRect();
    const inside =
      !!b &&
      e.clientX >= b.left &&
      e.clientX <= b.right &&
      e.clientY >= b.top &&
      e.clientY <= b.bottom;
    this._pt = inside ? [x, y] : null;
    // proximity to the slab (0 far, 1 over it) — the pointer pushes it under
    const s = this._state;
    const qx = Math.abs(x - this._bx) - this._halfX + this._radius;
    const qy = Math.abs(y - this._by) - this._halfY + this._radius;
    const sd =
      Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - this._radius;
    s.prox = Math.max(0, Math.min(1, 1 - sd / 0.14));
    // dragging across the liquid sheds a slow wake
    const last = this._wake;
    if (!this._noWake && !inside && (!last || Math.hypot(x - last[0], y - last[1]) > 0.16)) {
      this._wake = [x, y];
      this._spawn(x, y, 0.16 * this._pr('wake'));
    }
  }

  /** (port) well: a pointer position in the viewport's frame, uv */
  private _wellUv(e: { clientX: number; clientY: number }): [number, number] {
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    return [(e.clientX - W / 2) / this._unit, -(e.clientY - H / 2) / this._unit];
  }

  /** the slab's centre in the shader's frame: its drift plus, in a well, the host's offset */
  private get _bx() {
    return this._ox + this._cx;
  }
  private get _by() {
    return this._oy + this._cy;
  }

  /**
   * (port) Join a ground's well: ripples are the ground's (one array, so an
   * impact here rings out across the page and the page's wake crosses here),
   * and this pond spawns no wake of its own.
   */
  joinWell(ground: LiquidPond) {
    this._state.ripples = ground._state.ripples;
    this._noWake = true;
  }

  leave() {
    this._pt = null;
    this._ptrOn = 0;
    this._state.prox = 0;
  }

  destroy() {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._watch) clearInterval(this._watch);
    this._ro?.disconnect();
    // no loseContext() here: React StrictMode remounts on the same canvas,
    // and getContext() would hand the next pond the dead context
  }

  // --- (port) masked switch ---------------------------------------------------
  private _mask: { canvas: HTMLCanvasElement; to: Liquid } | null = null;
  private _maskTex: WebGLTexture | null = null;

  /**
   * Start switching the body to `to` under a mask: the given canvas's alpha
   * (the ink splat, covering the viewport) says where the new liquid shows.
   * The old body stays where the mask is clear; `endMaskedSwitch` finishes.
   */
  beginMaskedSwitch(to: Liquid, mask: HTMLCanvasElement) {
    this._mask = { canvas: mask, to };
    this.host.dataset.masked = to;
  }

  /** The mask has covered everything: the body is `to` from now on. */
  endMaskedSwitch() {
    if (!this._mask) return;
    const to = this._mask.to;
    this._mask = null;
    delete this.host.dataset.masked;
    this.opts.liquid = to;
    this.host.dataset.liquid = to;
    const pearl = to === 'pearl';
    this._state.mode = pearl ? 1 : 0;
    this._state.modeT = pearl ? 1 : 0;
    this._state.merc = to === 'mercury' ? 1 : 0;
  }

  private _uploadMask() {
    const gl = this._gl;
    const u = this._u;
    if (!gl) return;
    const m = this._mask;
    if (!m) {
      gl.uniform1f(u.uMaskOn, 0);
      return;
    }
    if (!this._maskTex) {
      this._maskTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._maskTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._maskTex);
    if (m.canvas.width > 0 && m.canvas.height > 0) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas);
    }
    gl.uniform1i(u.uMask, 0);
    gl.uniform1f(u.uMaskOn, 1);
    gl.uniform1f(u.uModeTo, m.to === 'pearl' ? 1 : 0);
    // this canvas's place in the viewport, as the mask covers the viewport
    const r = this.host.getBoundingClientRect();
    const W = window.innerWidth || 1;
    const H = window.innerHeight || 1;
    gl.uniform4f(u.uMaskRect, r.left / W, r.top / H, r.width / W, r.height / H);
  }

  /** (port) a pointer response, scaled by the master `reaction`. */
  private _prOf(p: PointerLook, k: 'dimple' | 'wake' | 'tilt' | 'drift') {
    return p.reaction * p[k];
  }
  private _viscOf(v: number) {
    return Math.max(0.15, Math.min(2, v));
  }
  /** viscosity in force for the slab's physics: between the two bodies' by mode */
  private _visc(mode: number) {
    const a = this._viscOf(this.opts.viscosity);
    const b = this._viscOf(this.opts.viscosityPearl ?? this.opts.viscosity);
    return a + (b - a) * mode;
  }
  private _pr(k: 'dimple' | 'wake' | 'tilt' | 'drift') {
    const a = this._prOf(this.opts.pointer, k);
    const b = this._prOf(this.opts.pointerPearl ?? this.opts.pointer, k);
    const r = a + (b - a) * this._state.modeT;
    // (port) in a well the page's reaction scales the liquid (the dimple must
    // match the ground's), not how far a thing afloat on it tips or drifts
    return this.opts.well && (k === 'tilt' || k === 'drift') ? Math.min(1, r) : r;
  }

  // --- internals (the study's methods, attribute reads replaced by opts) -----

  private _spawn(x: number, y: number, s: number) {
    if (this._reduce) s *= 0.35;
    this._state.ripples.push({ x, y, t: performance.now() / 1000, s });
    if (this._state.ripples.length > 6) this._state.ripples.shift();
  }

  // --- particle fluid (ported from ink-splat) --------------------------------
  private _initParts() {
    const N = MAXP;
    this._P = {
      px: new Float32Array(N),
      py: new Float32Array(N),
      vx: new Float32Array(N),
      vy: new Float32Array(N),
      rad: new Float32Array(N),
      drag: new Float32Array(N),
      kind: new Uint8Array(N),
      head: new Float32Array(N),
      elong: new Float32Array(N),
      born: new Float32Array(N),
      n: 0,
      t: 0,
      seed: 0,
      rel: -1,
    };
  }
  // the impact: everything is launched from the slab's rim and thrown outward.
  // Speeds are uv/s; with exponential drag k a droplet travels v/k.
  private _splat(strength: number) {
    const P = this._P;
    if (!P) return;
    if (this._reduce) strength *= 0.5;
    const R = Math.random;
    const cx = this._bx,
      cy = this._by,
      hx = this._halfX,
      hy = this._halfY;
    const size = this.opts.globSize;
    const dens = 0.5 + this.opts.globDensity;
    P.n = 0;
    P.t = 0;
    P.rel = -1;
    P.seed = R() * 100;
    const add = (
      x: number,
      y: number,
      sx: number,
      sy: number,
      r: number,
      k: number,
      type: number,
      st: number,
      delay = 0
    ) => {
      if (P.n >= MAXP) return;
      const i = P.n++;
      P.px[i] = x;
      P.py[i] = y;
      P.vx[i] = sx;
      P.vy[i] = sy;
      P.rad[i] = r * size;
      P.drag[i] = k;
      P.kind[i] = type;
      P.head[i] = Math.atan2(sy, sx);
      P.elong[i] = st;
      P.born[i] = delay;
    };
    const rim = (a: number, o: number) => [cx + Math.cos(a) * (hx + o), cy + Math.sin(a) * (hy + o)];
    const s1 = R() * TAU,
      s2 = R() * TAU;
    const lobeAt = (a: number) => 1 + 0.5 * (0.5 * Math.sin(3 * a + s1) + 0.3 * Math.sin(5 * a + s2));
    const M = (n: number) => Math.round(n * dens);
    // core: heavy, slow droplets that hug the rim and pile into the mass
    for (let i = 0; i < M(26); i++) {
      const a = R() * TAU,
        p = rim(a, 0),
        sp = (0.15 + 0.35 * R()) * lobeAt(a) * strength;
      add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.022 + 0.03 * R() * R(), 7, 0, 0);
    }
    // rim: mid-weight droplets that break the outline into lumps and stubby lobes
    for (let i = 0; i < M(16); i++) {
      const a = R() * TAU,
        p = rim(a, 0.01),
        sp = (0.6 + 0.8 * R()) * lobeAt(a) * strength;
      add(p[0], p[1], Math.cos(a) * sp, Math.sin(a) * sp, 0.007 + 0.01 * R(), 7, 1, 0.3);
    }
    // jets: strings of droplets with graded speed that draw out into tapered
    // strands; the lead bulb pinches off if the neck stretches past kernel reach
    const J = M(6),
      L = 7;
    for (let j = 0; j < J; j++) {
      const a = ((j + (R() - 0.5) * 0.8) / J) * TAU,
        dx = Math.cos(a),
        dy = Math.sin(a);
      const S = (1.3 + 1.3 * R()) * strength,
        lat = (R() - 0.5) * 0.4 * S,
        p = rim(a, 0.005);
      for (let k = 0; k <= L; k++) {
        const u = k / L,
          f = 0.4 + 0.6 * Math.pow(u, 1.1),
          tip = k === L;
        const r = tip ? 0.005 + 0.005 * R() : (0.009 - 0.0055 * u) * (0.85 + 0.3 * R());
        const v = S * f,
          w = lat * f * f;
        add(p[0], p[1], dx * v - dy * w, dy * v + dx * w, r, 7, 1, tip ? 0.3 : 1 + 0.4 * R());
      }
    }
    // drops: light, fast debris with low, varied drag
    for (let i = 0; i < M(18); i++) {
      const a = R() * TAU,
        p = rim(a, 0),
        sp = (0.8 + 2.2 * Math.pow(R(), 1.3)) * strength;
      add(
        p[0],
        p[1],
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.0025 + 0.01 * R() * R() * R(),
        2.5 + 3 * R(),
        2,
        0.1 + 0.06 * sp
      );
    }
    // crown: tiny droplets thrown off the rim a beat after impact
    for (let i = 0; i < M(14); i++) {
      const a = R() * TAU,
        p = rim(a, 0.04),
        sp = (0.7 + 0.9 * R()) * strength;
      add(
        p[0],
        p[1],
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.002 + 0.0025 * R(),
        5,
        3,
        0.3,
        0.09 + 0.08 * R()
      );
    }
  }
  // one physics step. Surface tension is a weak attraction between droplets
  // whose kernels overlap but have drifted apart. While the slab sinks the
  // droplets are drawn onto it; once it is released they slide off and thin.
  private _simStep(dt: number, sw: number, sinking: boolean) {
    const P = this._P;
    if (!P || !P.n) return;
    P.t += dt;
    const t = P.t;
    if (!sinking && P.rel < 0 && t > 0.6) P.rel = t;
    if (P.rel >= 0 && t - P.rel > 0.8) {
      P.n = 0;
      return;
    }
    const n = P.n,
      px = P.px,
      py = P.py,
      vx = P.vx,
      vy = P.vy,
      rad = P.rad;
    for (let i = 0; i < n; i++) {
      if (P.born[i] > t) continue;
      const ri = rad[i],
        Ri = ri / KQ,
        mi = (ri / 0.01) * (ri / 0.01);
      for (let j = i + 1; j < n; j++) {
        if (P.born[j] > t) continue;
        const rj = rad[j],
          reach = (Ri + rj / KQ) * 0.9;
        const dx = px[j] - px[i],
          dy = py[j] - py[i],
          d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2) || 1e-6,
          rest = (ri + rj) * 0.95;
        if (d <= rest) continue;
        const s = (d - rest) / (reach - rest),
          f = 8 * (d - rest) * (1 - s);
        const ax = (f * dx) / d,
          ay = (f * dy) / d,
          mj = (rj / 0.01) * (rj / 0.01);
        vx[i] += (ax / mi) * dt;
        vy[i] += (ay / mi) * dt;
        vx[j] -= (ax / mj) * dt;
        vy[j] -= (ay / mj) * dt;
      }
    }
    const cx = this._bx,
      cy = this._by,
      hx = this._halfX * 0.9,
      hy = this._halfY * 0.85;
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
        let tx: number, ty: number;
        if (P.kind[i] === 0) {
          const c = ci % cols,
            r = Math.floor(ci / cols);
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
        // (port) run-off: the surfacing slab wears a cone, apex at its centre,
        // so the liquid sheds radially down a constant slope — every droplet
        // slides straight away from the middle, and keeps drifting once it is
        // off the face. (The study sent them to the nearest edge instead.)
        const ox = px[i] - cx,
          oy = py[i] - cy;
        const od = Math.hypot(ox, oy);
        // no direction at the apex itself: nudge it off the tip
        const dx = od < 1e-4 ? 1 : ox / od,
          dy = od < 1e-4 ? 0 : oy / od;
        const onFace = Math.abs(ox) < hx && Math.abs(oy) < hy ? 1 : 0.35;
        vx[i] += dx * 2.6 * onFace * dt;
        vy[i] += dy * 2.6 * onFace * dt;
      }
      const damp = Math.exp(-(P.drag[i] + 6 * sw) * dt);
      vx[i] *= damp;
      vy[i] *= damp;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
  }
  private _uploadParts(sw: number) {
    const P = this._P,
      gl = this._gl,
      u = this._u,
      out = this._part;
    if (!P || !gl) return;
    const t = P.t,
      life = P.rel < 0 ? 1 : Math.max(0, 1 - (t - P.rel) / 0.8);
    for (let i = 0; i < P.n; i++) {
      const k = P.kind[i];
      // swell is capped so the merged mass stays slab-sized, never a flood;
      // core droplets grow enough to close the gaps between their tiled spots
      const cap = k === 0 ? 0.075 : 0.05;
      const r = P.born[i] > t ? 0.0001 : Math.min(P.rad[i] * (1 + GROW[k] * sw), cap) * life * life;
      const speed = Math.hypot(P.vx[i], P.vy[i]);
      const th = speed > 0.05 ? Math.atan2(P.vy[i], P.vx[i]) : P.head[i];
      const stretch = Math.min(P.elong[i] * (1 - sw) + (k === 0 ? 0 : Math.min(speed * 0.3, 1.2)), 3);
      out[i * 4] = P.px[i];
      out[i * 4 + 1] = P.py[i];
      out[i * 4 + 2] = r / KQ;
      out[i * 4 + 3] = Math.round((1 + stretch) * 10) * 8 + (((th % TAU) + TAU) % TAU);
    }
    gl.uniform4fv(u.uPart, out);
    gl.uniform1i(u.uCount, P.n);
    gl.uniform1f(u.uSplatT, t);
    gl.uniform1f(u.uSeed, P.seed);
  }

  private _initGL() {
    // (port) transparent: the DOM slab shows through the hole the shader leaves
    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: !!this.opts.preserveDrawingBuffer,
    });
    if (!gl) return false;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('liquid-button shader:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('liquid-button link:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    this._gl = gl;
    this._u = {};
    [
      'uRes',
      'uUnit',
      'uTime',
      'uPtr',
      'uPtrOn',
      'uBtnC',
      'uBtnHalf',
      'uBtnR',
      'uDepth',
      'uVel',
      'uFocus',
      'uMode',
      'uMotion',
      'uGoop',
      'uVisc',
      'uMerc',
      'uTilt',
      'uGlob',
      'uRip',
      'uPart',
      'uCount',
      'uSplatT',
      'uSeed',
      'uGlobShade',
      'uMinBase',
      'uMinHigh',
      'uMinIrid',
      'uMinSpec',
      'uMinGamma',
      'uPearlCream',
      'uPearlShade',
      'uPearlNacre',
      'uPearlIrid',
      'uPearlSpec',
      'uStoneGray',
      'uClouding',
      'uWhite',
      'uSpread',
      'uSwirl',
      'uGlowK',
      'uGrainSize',
      'uGrainDens',
      'uGlitterDens',
      'uFacetSharp',
      'uGlint',
      'uGlintPtr',
      'uLamina',
      'uDimple',
      'uWhiteP',
      'uSpreadP',
      'uSwirlP',
      'uGlowKP',
      'uGrainSizeP',
      'uGrainDensP',
      'uGlitterDensP',
      'uFacetSharpP',
      'uGlintP',
      'uGlintPtrP',
      'uLaminaP',
      'uDimpleP',
      'uViscP',
      'uSlabOn',
      'uShiftPx',
      'uVigRes',
      'uFeather',
      'uMask',
      'uMaskOn',
      'uModeTo',
      'uMaskRect',
      'uMercFloor',
      'uMercSky',
      'uMercHorizon',
      'uMercTop',
      'uMercSpec',
      'uMercIrid',
    ].forEach((k) => (this._u[k] = gl.getUniformLocation(prog, k)));
    this._initParts();
    this._layout();
    return true;
  }

  // the slab is the DOM content's box, measured in the study's uv (height = 1)
  private _layout() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return false;
    this._unit = this.opts.unit ?? h;
    if (this.slab) {
      // untransformed size: the slab may be scaled/tilted at the moment of measuring
      const b = this.slab.getBoundingClientRect();
      const sw = this.slab.offsetWidth || b.width;
      const sh = this.slab.offsetHeight || b.height;
      this._halfX = Math.max(0.02, sw / 2 / this._unit);
      this._halfY = Math.max(0.02, sh / 2 / this._unit);
      this._radius = Math.min(this.opts.radius / this._unit, this._halfX, this._halfY);
    } else {
      this._halfX = this._halfY = this._radius = 0;
    }
    if (this.opts.well) {
      const r = this.host.getBoundingClientRect();
      this._vw = window.innerWidth || 1;
      this._vh = window.innerHeight || 1;
      this._ox = (r.left + r.width / 2 - this._vw / 2) / this._unit;
      this._oy = -(r.top + r.height / 2 - this._vh / 2) / this._unit;
    } else {
      this._ox = this._oy = 0;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this._gl?.viewport(0, 0, pw, ph);
    }
    return true;
  }

  // Paint once, synchronously, as soon as the box has a real size — a first
  // frame must not depend on rAF (background tabs, static captures, print).
  private _settle() {
    if (this._settled || this._destroyed) return;
    if (this._layout() && this._step) {
      this._settled = true;
      this._step();
      return;
    }
    if (++this._tries < 60) {
      requestAnimationFrame(() => this._settle());
      setTimeout(() => this._settle(), 50);
    }
  }

  private _loop() {
    const gl = this._gl!;
    const s = this._state;
    const t0 = EPOCH;
    let last = performance.now();

    const step = () => {
      if (this._destroyed) return;
      this._layout();
      const now = performance.now();
      const t = (now - t0) / 1000;
      let dt = Math.min((now - last) / 1000, 0.06);
      last = now;

      // --- viscous depth integration (fixed substeps) ----------------------
      // the slab only goes under on a press (a ~1.5s dunk, then it bobs back);
      // hovering just weighs it down a touch and tips it toward the pointer
      const pressed = now / 1000 - s.pressAt < 1.5;
      const visc = this._visc(s.modeT);
      const hoverY = 0.014 - s.prox * 0.022 * this._pr('tilt');
      const target = this._sunk ? -0.34 : pressed ? -0.3 : hoverY;
      const k = this._sunk ? 7.5 : pressed ? 18 : 22;
      if (s.prox > 0.6 && !this._wasUnder) this._spawn(this._bx, this._by, 0.25 * this._pr('wake'));
      this._wasUnder = s.prox > 0.6;
      let left = dt;
      while (left > 0) {
        const h = Math.min(left, 1 / 120);
        left -= h;
        // drag rises steeply near the surface: breaking the meniscus takes work
        const cling = 1 + 2.6 * Math.exp(-s.y * s.y * 900);
        const c = (this._sunk ? 6.4 : 8.2) * visc * cling;
        s.v += (target - s.y) * k * h - s.v * c * h;
        s.y += s.v * h;
        this._simStep(h, s.goop, this._sunk || pressed);
        // tilt: like a ball rolling on a plank — the edge under the pointer
        // dips, the far edge lifts; underdamped so it rocks before settling
        const under = this._sunk || pressed ? 0 : s.prox;
        // (port) 0.55 in the study; with the liquid closing over whatever dips
        // below the surface, that much tilt drowns a whole side on a hover
        const tiltK = 0.22 * this._pr('tilt');
        // (port) The plank tips by the same amount whichever edge is leaned on.
        // The study took the raw offset, so the reach of each axis scaled with
        // that axis's half extent: a wide, short slab (the announcement) tipped
        // freely left to right and barely at all front to back. Normalising the
        // offset per axis and scaling both by the slab's mean size leaves a
        // square slab exactly as it was and balances everything else.
        const ref = Math.sqrt(Math.max(this._halfX * this._halfY, 1e-8));
        const reach = (d: number, half: number) =>
          Math.max(-1, Math.min(1, d / Math.max(half, 1e-4)));
        const tx = -reach(s.ptr[0] - this._bx, this._halfX) * ref * under * tiltK;
        const ty = -reach(s.ptr[1] - this._by, this._halfY) * ref * under * tiltK;
        const tk = 60;
        const tc = 5.5 * visc;
        s.tiltV[0] += (tx - s.tilt[0]) * tk * h - s.tiltV[0] * tc * h;
        s.tiltV[1] += (ty - s.tilt[1]) * tk * h - s.tiltV[1] * tc * h;
        s.tilt[0] += s.tiltV[0] * h;
        s.tilt[1] += s.tiltV[1] * h;
      }
      s.focus += ((this._focusOn ? 1 : 0) - s.focus) * 0.14;
      const goopT = Math.max(0, Math.min(1, -s.y / 0.26));
      s.goop += (goopT - s.goop) * 0.1;
      s.ptrOn += (this._ptrOn - s.ptrOn) * 0.12;
      s.modeT += (s.mode - s.modeT) * 0.09;
      const mercTarget = Math.max(s.merc, this.opts.mercuryOnSink ? Math.pow(s.goop, 0.7) : 0);
      s.mercT += (mercTarget - s.mercT) * 0.07;

      // the slab drifts a little toward the pointer — the liquid drags it
      const pull = this._sunk ? 0 : 0.045 * this._pr('drift');
      const tx = this._pt ? (s.ptr[0] - this._ox) * pull : 0;
      const ty = this._pt ? (s.ptr[1] - this._oy) * pull : 0;
      this._cx += (tx - this._cx) * 0.04;
      this._cy += (ty - this._cy) * 0.04;

      this._rip.fill(0);
      s.ripples.forEach((r, i) => {
        this._rip[i * 4] = r.x;
        this._rip[i * 4 + 1] = r.y;
        this._rip[i * 4 + 2] = r.t - t0 / 1000;
        this._rip[i * 4 + 3] = r.s;
      });

      const u = this._u;
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      const dpx = this.canvas.height / Math.max(1, this.host.clientHeight);
      gl.uniform1f(u.uUnit, this._unit * dpx);
      // (port) well: shift into the ground's frame; the vignette is the viewport's
      gl.uniform2f(u.uShiftPx, this._ox * this._unit * dpx, this._oy * this._unit * dpx);
      if (this.opts.well) gl.uniform2f(u.uVigRes, this._vw * dpx, this._vh * dpx);
      else gl.uniform2f(u.uVigRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uFeather, this.opts.well ? 48 * dpx : 0);
      gl.uniform1f(u.uTime, t);
      gl.uniform2f(u.uPtr, s.ptr[0], s.ptr[1]);
      gl.uniform1f(u.uPtrOn, s.ptrOn);
      gl.uniform2f(u.uBtnC, this._bx, this._by);
      // (port) the hole follows the receding card, so the liquid closes right
      // up to it instead of leaving a band of page around it
      const sub0 = Math.max(0, -s.y) / 0.34;
      const sc = 1 - sub0 * 0.14;
      gl.uniform2f(u.uBtnHalf, this._halfX * sc, this._halfY * sc);
      gl.uniform1f(u.uBtnR, this._radius);
      gl.uniform1f(u.uDepth, s.y);
      gl.uniform1f(u.uVel, s.v);
      gl.uniform1f(u.uFocus, s.focus);
      gl.uniform1f(u.uMode, s.modeT);
      gl.uniform1f(u.uMotion, this._reduce ? 0 : 1);
      gl.uniform1f(u.uGoop, s.goop);
      gl.uniform1f(u.uVisc, this._viscOf(this.opts.viscosity));
      gl.uniform1f(u.uMerc, s.mercT);
      gl.uniform2f(u.uTilt, s.tilt[0], s.tilt[1]);
      gl.uniform3f(u.uGlob, this.opts.globSize, this.opts.globDensity, this.opts.globHeight);
      gl.uniform1f(u.uGlobShade, this.opts.globShading ? 1 : 0);
      const m = this.opts.mineral,
        pl = this.opts.pearl;
      gl.uniform3f(u.uMinBase, ...hex3(m.base));
      gl.uniform3f(u.uMinHigh, ...hex3(m.highlight));
      gl.uniform1f(u.uMinIrid, m.iridescence);
      gl.uniform1f(u.uMinSpec, m.specular);
      gl.uniform1f(u.uMinGamma, m.gamma);
      gl.uniform3f(u.uPearlCream, ...hex3(pl.cream));
      gl.uniform3f(u.uPearlShade, ...hex3(pl.shade));
      gl.uniform1f(u.uPearlNacre, pl.nacre);
      gl.uniform1f(u.uPearlIrid, pl.iridescence);
      gl.uniform1f(u.uPearlSpec, pl.specular);
      gl.uniform1f(u.uStoneGray, m.stoneGray);
      gl.uniform1f(u.uClouding, pl.clouding);
      const sp = this.opts.spectrum;
      gl.uniform1f(u.uWhite, sp.white);
      gl.uniform1f(u.uSpread, sp.spread);
      gl.uniform1f(u.uSwirl, sp.swirl);
      gl.uniform1f(u.uGlowK, sp.cursorGlow);
      gl.uniform1f(u.uGrainSize, sp.grainSize);
      gl.uniform1f(u.uGrainDens, sp.grainDensity);
      gl.uniform1f(u.uGlitterDens, sp.glitterDensity);
      gl.uniform1f(u.uFacetSharp, sp.facetSharpness);
      gl.uniform1f(u.uGlint, sp.glint);
      gl.uniform1f(u.uGlintPtr, sp.glintFollowsPointer);
      gl.uniform1f(u.uLamina, sp.lamina);
      gl.uniform1f(u.uDimple, this._prOf(this.opts.pointer, 'dimple'));
      const spP = this.opts.spectrumPearl ?? sp;
      gl.uniform1f(u.uWhiteP, spP.white);
      gl.uniform1f(u.uSpreadP, spP.spread);
      gl.uniform1f(u.uSwirlP, spP.swirl);
      gl.uniform1f(u.uGlowKP, spP.cursorGlow);
      gl.uniform1f(u.uGrainSizeP, spP.grainSize);
      gl.uniform1f(u.uGrainDensP, spP.grainDensity);
      gl.uniform1f(u.uGlitterDensP, spP.glitterDensity);
      gl.uniform1f(u.uFacetSharpP, spP.facetSharpness);
      gl.uniform1f(u.uGlintP, spP.glint);
      gl.uniform1f(u.uGlintPtrP, spP.glintFollowsPointer);
      gl.uniform1f(u.uLaminaP, spP.lamina);
      gl.uniform1f(u.uDimpleP, this._prOf(this.opts.pointerPearl ?? this.opts.pointer, 'dimple'));
      gl.uniform1f(u.uViscP, this._viscOf(this.opts.viscosityPearl ?? this.opts.viscosity));
      gl.uniform1f(u.uSlabOn, this.slab ? 1 : 0);
      this._uploadMask();
      const mc = this.opts.mercury;
      gl.uniform3f(u.uMercFloor, ...hex3(mc.floor));
      gl.uniform3f(u.uMercSky, ...hex3(mc.sky));
      gl.uniform1f(u.uMercHorizon, mc.horizon);
      gl.uniform1f(u.uMercTop, mc.topLight);
      gl.uniform1f(u.uMercSpec, mc.specular);
      gl.uniform1f(u.uMercIrid, mc.iridescence);
      this._uploadParts(s.goop);
      gl.uniform4fv(u.uRip, this._rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // the DOM content follows the slab down; (port) it recedes harder than
      // the study's label, so it reads as going into the ground, not hovering
      const sub = Math.max(0, -s.y) / 0.34;
      const H = this._unit;
      if (this.slab)
        this.slab.style.transform =
          'translate(' +
          (this._cx * H).toFixed(1) +
          'px,' +
          (-this._cy * H).toFixed(1) +
          'px) scale(' +
          (1 - sub * 0.14).toFixed(3) +
          ')';
      // (port) signs flipped from the study: the edge under the pointer dips
      // away into the liquid, so the face turns into the screen on that side
      const tiltCss =
        'perspective(600px) rotateX(' +
        (s.tilt[1] * 55).toFixed(2) +
        'deg) rotateY(' +
        (-s.tilt[0] * 55).toFixed(2) +
        'deg)';
      if (this.face) this.face.style.transform = tiltCss;
      if (this.slab)
        this.slab.style.filter =
          sub > 0.02
            ? 'blur(' + (sub * 3).toFixed(2) + 'px) brightness(' + (1 - sub * 0.45).toFixed(2) + ')'
            : 'none';
    };

    this._step = step;
    const tick = () => {
      if (this._destroyed) return;
      this._raf = requestAnimationFrame(tick);
      this._lastRaf = performance.now();
      step();
    };
    tick();
    // hidden tabs and static captures never fire rAF; keep the surface alive
    this._watch = window.setInterval(() => {
      if (performance.now() - this._lastRaf > 250) step();
    }, 100);
  }

  // no WebGL2: the content just dims and softens when sunk
  private _fallbackApply() {
    const d = this._sunk;
    if (!this.slab) return;
    this.slab.style.opacity = d ? '0.35' : '1';
    this.slab.style.filter = d ? 'blur(2px)' : 'none';
    this.slab.style.transition = 'opacity 700ms ease, filter 700ms ease';
  }
}
