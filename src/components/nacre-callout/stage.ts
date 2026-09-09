// NacreStage: one WebGL context and one framebuffer for every nacre callout
// on the page, ported from the "Single-context callout shaders — 20 on a
// page" study (reference/callout-shaders/). Each card is drawn with a scissor
// into a fixed, page-sized canvas: a raymarched glass slab over the card with
// a droplet trail that follows the pointer, ambient blobs under the surface,
// refraction (with dispersion) of the card and of a ghost of its own text,
// sheen glints, rim and specular. The material is not the study's tinted
// glass but the black mineral nacre of the liquid pond: dark body, nacre
// noise, brand iridescence, facet glitter.

import { MINERAL_DEFAULT, SPECTRUM_DEFAULT } from '../ink-sink/liquid-pond';

const TRAIL = 12;
const BLOBS = 5;

export interface NacreConfig {
  droplet: boolean;
  wholeCard: boolean;
  blobs: boolean;
  ambient: number;
  refraction: number;
  ior: number;
  dispersion: number;
  sheenSpeed: number;
  lightAngle: number;
  lightColor: string;
  textGhost: boolean;
  ghostOpacity: number;
  ghostScale: number;
  ghostBlur: number;
  size: number;
  blend: number;
  goo: number;
  shine: number;
  rim: number;
  iridescence: number;
  intensity: number;
  thickness: number;
  cornerN: number;
  edgeRoll: number;
  glint: number;
  quality: 'high' | 'balanced' | 'battery';
}

/** The study's defaults, with the nacre's glitter added. */
export const NACRE_DEFAULT: NacreConfig = {
  droplet: true,
  wholeCard: true,
  blobs: true,
  ambient: 1.0,
  refraction: 45,
  ior: 2.5,
  dispersion: 1,
  sheenSpeed: 0.1,
  lightAngle: 180,
  lightColor: '#c8d0dc',
  textGhost: true,
  ghostOpacity: 0.07,
  ghostScale: 0.94,
  ghostBlur: 2,
  size: 21,
  blend: 9,
  goo: 4.2,
  shine: 0.3,
  rim: 0.55,
  iridescence: 1.0,
  intensity: 0.9,
  thickness: 0.15,
  cornerN: 2.9,
  edgeRoll: 1.0,
  glint: 1.0,
  quality: 'balanced',
};

const QUALITY = {
  high: { steps: 16, idleFps: 48, dpr: 2 },
  balanced: { steps: 12, idleFps: 30, dpr: 1.75 },
  battery: { steps: 8, idleFps: 12, dpr: 1.25 },
};

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uView;
uniform float uDpr;
uniform vec4 uRect;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBg;
uniform float uDark;
uniform vec2 uIcon;
uniform float uIconR;
uniform float uRadius;
uniform sampler2D uGhost;
uniform float uGhostOn;
uniform float uGhostOpacity;
uniform float uGhostScale;
uniform float uGhostBlur;
uniform vec2 uTrail[${TRAIL}];
uniform int uCount;
uniform float uBaseRadius;
uniform float uBlend;
uniform vec2 uBlob[${BLOBS}];
uniform float uBlobR[${BLOBS}];
uniform int uBlobCount;
uniform float uGoo;
uniform float uWhole;
uniform float uThick;
uniform float uCornerN;
uniform float uEdgeRoll;
uniform float uRefraction;
uniform float uIOR;
uniform float uDispersion;
uniform float uShine;
uniform float uRim;
uniform float uIridescence;
uniform float uIntensity;
uniform vec3 uSheenA;
uniform vec3 uSheenB;
uniform float uSheenTime;
uniform vec3 uLight;
uniform vec3 uLightColor;
uniform int uSteps;
// the nacre
uniform vec3 uMinBase;
uniform vec3 uMinHigh;
uniform float uStoneGray;
uniform float uMinIrid;
uniform float uWhite;
uniform float uSpread;
uniform float uSwirl;
uniform float uGrainSize;
uniform float uGrainDens;
uniform float uGlitterDens;
uniform float uFacetSharp;
uniform float uGlint;

vec2 uSize;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 h22(vec2 p){ float a = hash21(p); return vec2(a, hash21(p + a + 7.13)); }
vec3 h33(vec2 p){ float a = hash21(p); float b = hash21(p + a + 3.71); return vec3(a, b, hash21(p + b + 9.13)); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

// pmndrs spectrum, cyclic: one unit of input is one full rotation (from the pond)
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

float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sdSquircle(vec2 p, vec2 b, float r, float n){
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float outside = pow(pow(m.x, n) + pow(m.y, n), 1.0 / n);
  return min(max(q.x, q.y), 0.0) + outside - r;
}

float sdSlab(vec3 p, vec2 b, float thick, float r, float n, float roll){
  float rz = clamp(roll, 0.02, 1.0) * thick;
  float d2 = sdSquircle(p.xy, b, r, n);
  vec2 w = vec2(d2 + rz, abs(p.z) - (thick - rz));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rz;
}

vec4 ghostSample(vec2 q){
  vec2 texel = 1.0 / uSize;
  if(uGhostBlur < 0.01) return texture2D(uGhost, q * texel);
  vec4 acc = texture2D(uGhost, q * texel) * 0.28;
  for(int i = 0; i < 8; i++){
    float a = float(i) * 0.78539816;
    acc += texture2D(uGhost, (q + vec2(cos(a), sin(a)) * uGhostBlur) * texel) * 0.09;
  }
  return acc;
}

// the card's face: the black mineral body with its nacre, a faint accent of
// the kind's colour around the icon, and the ghost of the text refracted below
vec4 card(vec2 p, float t){
  vec2 hs = uSize * 0.5;
  float d = sdRoundBox(p - hs, hs, uRadius);
  float inside = 1.0 - smoothstep(0.0, 1.2, d);
  if(inside <= 0.001) return vec4(0.0);

  vec2 uvn = p / uSize.y;
  float nac = fbm(uvn * uSwirl + vec2(0.0, t * 0.02));
  vec3 col = mix(uMinBase, uMinHigh, smoothstep(0.25, 0.80, nac) * uStoneGray);
  float phase = (nac * 1.9 + 0.3 + uvn.x * 0.3) * uSpread - t * 0.02;
  vec3 irid = mix(brand(phase), vec3(1.0), uWhite);
  col += irid * 0.05 * uMinIrid;
  // the kind's colour, breathing softly round its icon
  float ir = length(p - uIcon) / max(uIconR, 1.0);
  col = mix(col, uColor, 0.22 * exp(-ir * ir * 0.35) * (0.8 + 0.2 * sin(t * 1.2)));
  if(uGhostOn > 0.5){
    vec2 mid = uSize * 0.5;
    vec4 g = ghostSample(mid + (p - mid) / max(uGhostScale, 0.05));
    col = col * (1.0 - g.a * uGhostOpacity) + g.rgb * uGhostOpacity;
  }
  return vec4(col, inside);
}

float rnd3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453123); }

float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(rnd3(i), rnd3(i + vec3(1,0,0)), u.x), mix(rnd3(i + vec3(0,1,0)), rnd3(i + vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(rnd3(i + vec3(0,0,1)), rnd3(i + vec3(1,0,1)), u.x), mix(rnd3(i + vec3(0,1,1)), rnd3(i + vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z);
}

float smin(float a, float b, float k){
  return -log(max(exp(-k * a) + exp(-k * b), 1e-12)) / k;
}

float mapD(vec3 p){
  float d = 4.0;
  for(int i = 0; i < ${TRAIL}; i++){
    if(i >= uCount) break;
    d = smin(d, length(p - vec3(uTrail[i], 0.0)) - (uBaseRadius * float(uCount) - uBaseRadius * float(i)), uBlend);
  }
  for(int i = 0; i < ${BLOBS}; i++){
    if(i >= uBlobCount) break;
    d = smin(d, length(p - vec3(uBlob[i], 0.0)) - uBlobR[i], uGoo);
  }
  if(uWhole > 0.5){
    float hw = uSize.x / uSize.y * 0.5;
    d = smin(d, sdSlab(p - vec3(hw, 0.5, 0.0), vec2(hw, 0.5), uThick, uRadius / uSize.y, uCornerN, uEdgeRoll), uGoo);
  }
  return d;
}

vec3 normalD(vec3 p){
  float e = 0.0015;
  return normalize(vec3(
    mapD(p + vec3(e,0,0)) - mapD(p - vec3(e,0,0)),
    mapD(p + vec3(0,e,0)) - mapD(p - vec3(0,e,0)),
    mapD(p + vec3(0,0,e)) - mapD(p - vec3(0,0,e))));
}

void main(){
  uSize = uRect.zw;
  vec2 css = gl_FragCoord.xy / uDpr;
  vec2 p = vec2(css.x - uRect.x, (uView.y - css.y) - uRect.y);

  vec4 baseCol = card(p, uTime);
  if(baseCol.a <= 0.001){ gl_FragColor = vec4(0.0); return; }

  vec3 ray = vec3(p / uSize.y, 1.0);
  vec3 dir = vec3(0.0, 0.0, -1.0);
  float dist = 0.0;
  for(int i = 0; i < 16; i++){
    if(i >= uSteps) break;
    dist = mapD(ray);
    ray += dir * dist;
    if(dist < 0.0008 || dist > 4.0) break;
  }

  float cov = 1.0 - smoothstep(0.0, 3.0 / uSize.y, dist);
  if(cov <= 0.002){
    gl_FragColor = vec4(baseCol.rgb * baseCol.a, baseCol.a);
    return;
  }

  vec3 n = normalD(ray);
  vec3 refl = reflect(dir, n);
  vec3 glints = pow(max((uSheenA * noise3(refl * 2.0 + uSheenTime)
    + uSheenB * noise3(refl * 2.0 - uSheenTime)) * uIntensity, 0.0), vec3(7.0));
  float spec = pow(max(dot(reflect(-uLight, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
  float edge = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.5);

  vec3 col;
  if(uRefraction > 0.5){
    float ior = max(uIOR, 1.0);
    float ca = uDispersion * 0.03 * (ior - 1.0) / 0.33;
    vec3 rR = refract(dir, n, 1.0 / max(ior - ca, 1.0));
    vec3 rG = refract(dir, n, 1.0 / ior);
    vec3 rB = refract(dir, n, 1.0 / (ior + ca));
    vec2 oR = rR.xy * (uRefraction / max(abs(rR.z), 0.35));
    vec2 oG = rG.xy * (uRefraction / max(abs(rG.z), 0.35));
    vec2 oB = rB.xy * (uRefraction / max(abs(rB.z), 0.35));
    vec2 lo = vec2(1.0), hi = uSize - vec2(1.0);
    col = vec3(card(clamp(p + oR, lo, hi), uTime).r,
               card(clamp(p + oG, lo, hi), uTime).g,
               card(clamp(p + oB, lo, hi), uTime).b);
    col *= 1.0 - 0.35 * uRim * edge;
  } else {
    col = baseCol.rgb * (1.0 - 0.3 * uRim * edge);
  }

  // nacre on the surface: iridescence where the slab curves away, and the
  // pond's facet glitter catching the light
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.6);
  vec2 uvn = p / uSize.y;
  float nac2 = fbm(uvn * uSwirl * 1.3 + 4.7);
  vec3 iridS = mix(brand((nac2 * 1.9 + fres * 1.5) * uSpread - uTime * 0.02), vec3(1.0), uWhite);
  col += iridS * (0.07 + 0.75 * fres) * 0.45 * uMinIrid;

  vec3 Hv = normalize(uLight + vec3(0.0, 0.0, 1.0));
  vec2 gp = uvn * uGrainSize;
  vec2 gid = floor(gp), gv = fract(gp) - 0.5;
  float sparkI = 0.0;
  vec3 sparkC = vec3(0.0);
  for(int y = -1; y <= 1; y++){
    for(int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y));
      vec3 r = h33(gid + o);
      float alive = step(r.x, uGrainDens);
      vec2 cp = o + (r.yz - 0.5) * 0.82;
      float dd = length(gv - cp);
      float core = smoothstep(0.13, 0.0, dd);
      vec2 tl = (h22(gid + o + 11.71) - 0.5) * 1.5 + n.xy * 0.6;
      vec3 fn = normalize(vec3(tl, 0.72));
      float sp = pow(max(dot(fn, Hv), 0.0), uFacetSharp) * (0.6 + r.z * 0.9);
      float w = sp * (core + uGlitterDens * exp(-dd * dd * 90.0)) * alive;
      sparkC += mix(vec3(1.0), brand(r.y * 0.3 + fres) * 1.25, 0.82) * w;
      sparkI += w;
    }
  }
  col += sparkC * 1.15 * uGlint;

  float calm = mix(1.0, 0.5, uWhole);
  col += glints * uIridescence * calm;
  col += uLightColor * (spec * uShine * calm);

  vec3 outCol = mix(baseCol.rgb, col, cov);
  gl_FragColor = vec4(outCol * baseCol.a, baseCol.a);
}
`;

export interface NacreCard {
  el: HTMLElement;
  icon: HTMLElement | null;
  accent: string;
}

interface CardState {
  card: NacreCard;
  rgb: [number, number, number];
  blobs: {
    f: number;
    cx: number;
    cy: number;
    ax: number;
    ay: number;
    fx: number;
    fy: number;
    px: number;
    py: number;
  }[];
  tx: Float32Array;
  ty: Float32Array;
  hx: number;
  hy: number;
  target: [number, number] | null;
  settled: boolean;
  primed: boolean;
  ghost: { tex: WebGLTexture; stamp: number } | null;
  off: () => void;
}

const BLOB_SCALE = [1.2, 0.62, 0.95, 0.48, 0.78];
const GHOST_CAP = 8;

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function seeded(n: number) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return () => {
    x = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
}

/** Draws the text of a card into a canvas, word by word, so the shader can refract it. */
function rasterizeGhost(
  el: HTMLElement,
  icon: HTMLElement | null,
  cv: HTMLCanvasElement,
  dprCap: number
) {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const w = Math.max(1, el.offsetWidth);
  const h = Math.max(1, el.offsetHeight);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const path = icon?.querySelector('path');
  if (icon && path) {
    const side = 17;
    const k = side / 16;
    g.save();
    g.translate(
      icon.offsetLeft + (icon.offsetWidth - side) / 2,
      icon.offsetTop + (icon.offsetHeight - side) / 2
    );
    g.scale(k, k);
    g.fillStyle = getComputedStyle(icon).color;
    try {
      g.fill(new Path2D(path.getAttribute('d') ?? ''));
    } catch {
      /* no path support */
    }
    g.restore();
  }
  const calRect = el.getBoundingClientRect();
  el.querySelectorAll<HTMLElement>('[data-ghost]').forEach((node) => {
    const cs = getComputedStyle(node);
    const size = parseFloat(cs.fontSize);
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    g.fillStyle = cs.color;
    g.textBaseline = 'alphabetic';
    const probe = g.measureText('Mg');
    const ascent = probe.fontBoundingBoxAscent || probe.actualBoundingBoxAscent || size * 0.8;
    const descent = probe.fontBoundingBoxDescent || probe.actualBoundingBoxDescent || size * 0.2;
    const fontH = ascent + descent;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let textNode: Node | null;
    let drew = 0;
    while ((textNode = walker.nextNode())) {
      const str = textNode.nodeValue || '';
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(str))) {
        range.setStart(textNode, m.index);
        range.setEnd(textNode, m.index + m[0].length);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        const baseline = r.top - calRect.top + (r.height - fontH) / 2 + ascent;
        g.fillText(m[0], r.left - calRect.left, baseline);
        drew++;
      }
    }
    if (!drew) g.fillText(node.textContent || '', node.offsetLeft, node.offsetTop + size);
  });
}

export class NacreStage {
  readonly canvas: HTMLCanvasElement;
  config: NacreConfig;
  private _gl: WebGLRenderingContext | null = null;
  private _u: Record<string, WebGLUniformLocation | null> = {};
  private _cards = new Map<HTMLElement, CardState>();
  private _raf = 0;
  private _prev = performance.now();
  private _dirty = true;
  private _frame = 0;
  private _blobClock = Math.PI;
  private _sheenClock = 0;
  private _viewW = 0;
  private _viewH = 0;
  private _dpr = 1;
  private _packedTrail = new Float32Array(TRAIL * 2);
  private _packedBlob = new Float32Array(BLOBS * 2);
  private _packedBlobR = new Float32Array(BLOBS);
  private _reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private _onResize = () => {
    this._resize();
    this._dirty = true;
  };
  private _onScroll = () => {
    this._dirty = true;
  };
  readonly supported: boolean;

  constructor(canvas: HTMLCanvasElement, config: NacreConfig = NACRE_DEFAULT) {
    this.canvas = canvas;
    this.config = { ...config };
    this.supported = this._init();
    if (!this.supported) return;
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._resize();
    this._raf = requestAnimationFrame(this._loop);
  }

  /** Invalidate the ghosts (theme or content changed) and repaint. */
  refresh() {
    for (const c of this._cards.values()) this._dropGhost(c);
    this._dirty = true;
  }

  register(card: NacreCard) {
    if (!this.supported) return () => {};
    const rnd = seeded(this._cards.size + 1);
    const el = card.el;
    const state: CardState = {
      card,
      rgb: hexToRgb(card.accent),
      blobs: BLOB_SCALE.map((f) => ({
        f,
        cx: 0.14 + rnd() * 0.72,
        cy: 0.28 + rnd() * 0.44,
        ax: 0.06 + rnd() * 0.13,
        ay: 0.1 + rnd() * 0.16,
        fx: 0.09 + rnd() * 0.13,
        fy: 0.07 + rnd() * 0.14,
        px: rnd() * 6.283,
        py: rnd() * 6.283,
      })),
      tx: new Float32Array(TRAIL),
      ty: new Float32Array(TRAIL),
      hx: 0,
      hy: 0,
      target: null,
      settled: true,
      primed: false,
      ghost: null,
      off: () => {},
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || this._reduced.matches) return;
      const r = el.getBoundingClientRect();
      const m = this.config.size * 0.5;
      state.target = [
        Math.max(m, Math.min(r.width - m, e.clientX - r.left)),
        Math.max(m, Math.min(r.height - m, e.clientY - r.top)),
      ];
      state.settled = false;
    };
    const leave = () => {
      state.target = null;
      state.settled = false;
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });
    state.off = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
    this._cards.set(el, state);
    this._dirty = true;
    return () => {
      state.off();
      this._dropGhost(state);
      this._cards.delete(el);
      this._dirty = true;
    };
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onScroll);
    for (const c of this._cards.values()) {
      c.off();
      this._dropGhost(c);
    }
    this._cards.clear();
  }

  private _dropGhost(c: CardState) {
    if (c.ghost) {
      this._gl?.deleteTexture(c.ghost.tex);
      c.ghost = null;
    }
  }

  private _init() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    if (!gl) return false;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('nacre-callout shader:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('nacre-callout link:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this._u = new Proxy({} as Record<string, WebGLUniformLocation | null>, {
      get: (c, k: string) => (k in c ? c[k] : (c[k] = gl.getUniformLocation(prog, k))),
    });
    this._gl = gl;
    return true;
  }

  private _resize() {
    const q = QUALITY[this.config.quality];
    this._dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
    this._viewW = window.innerWidth;
    this._viewH = window.innerHeight;
    this.canvas.width = Math.round(this._viewW * this._dpr);
    this.canvas.height = Math.round(this._viewH * this._dpr);
    for (const c of this._cards.values()) this._dropGhost(c);
  }

  private _ghostFor(c: CardState) {
    const gl = this._gl!;
    if (c.ghost) {
      c.ghost.stamp = this._frame;
      return c.ghost.tex;
    }
    let live = 0;
    let oldest: CardState | null = null;
    for (const other of this._cards.values()) {
      if (!other.ghost) continue;
      live++;
      if (!oldest || other.ghost.stamp < oldest.ghost!.stamp) oldest = other;
    }
    if (live >= GHOST_CAP && oldest) this._dropGhost(oldest);
    const cv = document.createElement('canvas');
    rasterizeGhost(c.card.el, c.card.icon, cv, QUALITY[this.config.quality].dpr);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    c.ghost = { tex, stamp: this._frame };
    return tex;
  }

  private _loop = (now: number) => {
    this._raf = requestAnimationFrame(this._loop);
    const gl = this._gl;
    if (!gl) return;
    const cfg = this.config;
    const q = QUALITY[cfg.quality];
    let busy = false;
    for (const c of this._cards.values()) if (!c.settled) busy = true;
    const cap = busy ? 60 : q.idleFps;
    if (!this._dirty && now - this._prev < 1000 / cap - 1.5) return;
    const dt = Math.min((now - this._prev) / 1000, 0.25);
    this._prev = now;
    this._dirty = false;
    this._frame++;

    const reduced = this._reduced.matches;
    const live = cfg.blobs && !reduced;
    if (live) this._blobClock += dt * cfg.ambient;
    if (!reduced) this._sheenClock += dt * cfg.sheenSpeed;

    const dark = document.documentElement.dataset.theme !== 'light';
    const bgCss = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim();
    const bg = /^#[0-9a-f]{6}$/i.test(bgCss)
      ? hexToRgb(bgCss)
      : dark
        ? [0.05, 0.04, 0.02]
        : [0.98, 0.96, 0.92];

    const a = (cfg.lightAngle * Math.PI) / 180;
    const lv = [Math.sin(a), -Math.cos(a), 0.6];
    const ll = Math.hypot(lv[0], lv[1], lv[2]);
    const u = this._u;
    const canvas = this.canvas;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);

    gl.uniform2f(u.uView, this._viewW, this._viewH);
    gl.uniform1f(u.uDpr, this._dpr);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uDark, dark ? 1 : 0);
    gl.uniform3fv(u.uBg, bg);
    gl.uniform1f(u.uIconR, 15);
    gl.uniform1f(u.uRadius, 12);
    gl.uniform1f(u.uGhostOn, cfg.textGhost ? 1 : 0);
    gl.uniform1f(u.uGhostOpacity, cfg.ghostOpacity);
    gl.uniform1f(u.uGhostScale, cfg.ghostScale);
    gl.uniform1f(u.uGhostBlur, cfg.ghostBlur);
    gl.uniform1f(u.uBlend, cfg.blend);
    gl.uniform1f(u.uGoo, cfg.goo);
    gl.uniform1f(u.uWhole, cfg.wholeCard ? 1 : 0);
    gl.uniform1f(u.uThick, cfg.thickness);
    gl.uniform1f(u.uCornerN, cfg.cornerN);
    gl.uniform1f(u.uEdgeRoll, cfg.edgeRoll);
    gl.uniform1f(u.uRefraction, cfg.refraction);
    gl.uniform1f(u.uIOR, cfg.ior);
    gl.uniform1f(u.uDispersion, cfg.dispersion);
    gl.uniform1f(u.uShine, cfg.shine);
    gl.uniform1f(u.uRim, cfg.rim);
    gl.uniform1f(u.uIridescence, cfg.iridescence);
    gl.uniform1f(u.uIntensity, cfg.intensity);
    gl.uniform1f(u.uSheenTime, this._sheenClock);
    gl.uniform3f(u.uLight, lv[0] / ll, lv[1] / ll, lv[2] / ll);
    gl.uniform3fv(u.uLightColor, hexToRgb(cfg.lightColor));
    gl.uniform1i(u.uSteps, q.steps);
    gl.uniform1i(u.uGhost, 0);
    // the nacre
    gl.uniform3fv(u.uMinBase, hexToRgb(MINERAL_DEFAULT.base));
    gl.uniform3fv(u.uMinHigh, hexToRgb(MINERAL_DEFAULT.highlight));
    gl.uniform1f(u.uStoneGray, MINERAL_DEFAULT.stoneGray);
    gl.uniform1f(u.uMinIrid, MINERAL_DEFAULT.iridescence);
    gl.uniform1f(u.uWhite, SPECTRUM_DEFAULT.white);
    gl.uniform1f(u.uSpread, SPECTRUM_DEFAULT.spread);
    gl.uniform1f(u.uSwirl, SPECTRUM_DEFAULT.swirl);
    gl.uniform1f(u.uGrainSize, SPECTRUM_DEFAULT.grainSize);
    gl.uniform1f(u.uGrainDens, SPECTRUM_DEFAULT.grainDensity);
    gl.uniform1f(u.uGlitterDens, SPECTRUM_DEFAULT.glitterDensity);
    gl.uniform1f(u.uFacetSharp, SPECTRUM_DEFAULT.facetSharpness);
    gl.uniform1f(u.uGlint, cfg.glint);

    for (const c of this._cards.values()) {
      const el = c.card.el;
      const r = el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > this._viewH + 80 || r.width < 2) {
        c.primed = false;
        continue;
      }
      const w = r.width;
      const h = r.height;
      const icon = c.card.icon;
      const ix = icon ? icon.offsetLeft + icon.offsetWidth / 2 : 24;
      const iy = icon ? icon.offsetTop + icon.offsetHeight / 2 : 24;
      if (!c.primed) {
        c.hx = ix;
        c.hy = iy;
        c.tx.fill(ix);
        c.ty.fill(iy);
        c.primed = true;
      }
      const t = c.target || [ix, iy];
      const k = 1 - Math.exp(-dt * (c.target ? 17 : 9));
      c.hx += (t[0] - c.hx) * k;
      c.hy += (t[1] - c.hy) * k;
      for (let i = TRAIL - 1; i > 0; i--) {
        c.tx[i] = c.tx[i - 1];
        c.ty[i] = c.ty[i - 1];
      }
      c.tx[0] = c.hx;
      c.ty[0] = c.hy;
      let spread = 0;
      for (let i = 1; i < TRAIL; i++) {
        spread = Math.max(spread, Math.abs(c.tx[i] - c.tx[i - 1]) + Math.abs(c.ty[i] - c.ty[i - 1]));
      }
      c.settled = !c.target && spread < 0.4;
      const count = c.settled ? 1 : TRAIL;
      for (let i = 0; i < TRAIL; i++) {
        this._packedTrail[i * 2] = c.tx[i] / h;
        this._packedTrail[i * 2 + 1] = c.ty[i] / h;
      }
      for (let i = 0; i < BLOBS; i++) {
        const b = c.blobs[i];
        const rad = cfg.size * b.f;
        const mx = (rad + 3) / w;
        const my = (rad + 3) / h;
        const bx = Math.min(
          1 - mx,
          Math.max(mx, b.cx + b.ax * Math.sin(this._blobClock * b.fx + b.px))
        );
        const by = Math.min(
          1 - my,
          Math.max(my, b.cy + b.ay * Math.sin(this._blobClock * b.fy + b.py))
        );
        this._packedBlob[i * 2] = (bx * w) / h;
        this._packedBlob[i * 2 + 1] = by;
        this._packedBlobR[i] = rad / h;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this._ghostFor(c));
      gl.uniform4f(u.uRect, r.left, r.top, w, h);
      gl.uniform3fv(u.uColor, c.rgb);
      gl.uniform2f(u.uIcon, ix, iy);
      gl.uniform2fv(u.uTrail, this._packedTrail);
      gl.uniform1i(u.uCount, cfg.droplet ? count : 0);
      gl.uniform1f(u.uBaseRadius, cfg.size / h / count);
      gl.uniform2fv(u.uBlob, this._packedBlob);
      gl.uniform1fv(u.uBlobR, this._packedBlobR);
      gl.uniform1i(u.uBlobCount, live ? BLOBS : 0);
      gl.uniform3fv(
        u.uSheenA,
        c.rgb.map((v) => Math.min(1, v * 0.55 + 0.3))
      );
      gl.uniform3fv(u.uSheenB, [c.rgb[2] * 0.5 + 0.32, c.rgb[0] * 0.5 + 0.3, c.rgb[1] * 0.5 + 0.34]);
      const dpr = this._dpr;
      const sx = Math.max(0, Math.floor(r.left * dpr));
      const sy = Math.max(0, Math.floor((this._viewH - r.bottom) * dpr));
      const sw = Math.min(canvas.width - sx, Math.ceil(w * dpr));
      const sh = Math.min(canvas.height - sy, Math.ceil(h * dpr));
      if (sw <= 0 || sh <= 0) continue;
      gl.scissor(sx, sy, sw, sh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
  };
}

// ---- the page's one stage ---------------------------------------------------
const KEY = '__pmndrsNacreStage';
const g = globalThis as unknown as Record<string, NacreStage | undefined>;

/** The single stage for the page, created on first use. */
export function getNacreStage(): NacreStage | null {
  if (typeof document === 'undefined') return null;
  if (g[KEY]) return g[KEY];
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
  document.body.appendChild(canvas);
  const stage = new NacreStage(canvas);
  if (!stage.supported) {
    canvas.remove();
    return null;
  }
  g[KEY] = stage;
  return stage;
}
