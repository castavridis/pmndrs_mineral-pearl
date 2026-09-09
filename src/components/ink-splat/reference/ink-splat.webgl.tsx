// Reference implementation: Kris Baumgartner, https://github.com/krispya/ink-splat
// Kept verbatim (vanilla WebGL, no three) so the R3F port in ../InkSplat.tsx can be diffed against it.
// Not exported from the package index.

'use client';

import { useEffect, useRef } from 'react';

// The ink is a particle fluid: on impact a burst of droplets is launched from
// the centre with velocity, drag and a weak surface-tension attraction, all
// simulated in JS. The GPU renders them as a metaball density field — where
// droplets overlap the field merges, so strands, necks, bulbs and pinch-offs
// come out of the motion rather than being drawn by hand.
//
// Shader space is measured in "units" where one unit is the longer viewport
// edge times BLOT_SCALE; the blot sits at the centre of a (w/unit, h/unit)
// rectangle and scales with the window. Raising BLOT_SCALE grows everything.
const BLOT_SCALE = 1.5;
const FLOOD_START = 1.2; // seconds after impact when the ink begins to bleed outward
const FLOOD_LEN = 1.4; // seconds for the flood to cover the screen
const DURATION = FLOOD_START + FLOOD_LEN + 0.2; // seconds until nothing moves anymore
const MAX_PARTICLES = 256;
// the metaball kernel (1 - q²)² crosses the 0.5 threshold at q = 0.541, so a
// droplet's kernel reach is its visible radius divided by that
const KERNEL_Q = 0.541;

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// pass 1: sum every droplet's kernel into a density field. Runs at reduced
// resolution — the field is smooth, so it upsamples cleanly and the final
// threshold still produces a crisp edge at full resolution.
const FIELD_FRAG = /* glsl */ `
precision highp float;

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

// pass 2: threshold the field into ink, add the flood front, grain, the logo
const INK_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
uniform sampler2D uField;
uniform vec2 uDims;
uniform float uPx;
uniform float uTime;
uniform float uSeed;
uniform float uDark;

const float FLOOD_START = ${FLOOD_START.toFixed(2)};
const float FLOOD_LEN = ${FLOOD_LEN.toFixed(2)};

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
  // y grows downward to match CSS space; the blot sits at the viewport centre
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uDims;
  vec2 c = uDims * 0.5;
  vec2 dp = p - c;
  float ang = atan(dp.y, dp.x);
  vec2 ring = vec2(cos(ang), sin(ang));

  float field = texture2D(uField, vUv).r;

  // flood: once the blot has settled the ink spills outward from the mass,
  // accelerating, behind a ragged front of fingers until the whole viewport
  // is drowned. The droplets swell and drift with it (see the JS sim) so the
  // debris is absorbed rather than painted over.
  float fs = clamp((uTime - FLOOD_START) / FLOOD_LEN, 0.0, 1.0);
  float flood = fs * fs * fs;
  float cover = length(c) * 2.0 + 0.15;
  float lobes = 0.5 * sin(ang * 3.0 + uSeed) +
                0.3 * sin(ang * 5.0 + uSeed * 2.7) +
                0.2 * sin(ang * 8.0 + uSeed * 5.3);
  float finger = fbm(ring * 3.0 + uSeed + 9.0) - 0.5;
  float ripple = fbm(ring * 11.0 + uSeed * 6.0) - 0.5;
  float frontR = flood * cover * (1.0 + 0.5 * finger + 0.15 * ripple + 0.15 * lobes);
  field += 1.0 - smoothstep(-0.03, 0.01, length(dp) - frontR);

  // the whole surface jiggles for the first half second after impact
  float raw = field;
  field += (fbm(p * 6.0 + vec2(uTime * 1.5, -uTime * 1.1) + uSeed) - 0.5) * 0.2 * exp(-3.0 * uTime);

  // fine static grain on every edge so the liquid reads as physical ink
  field += (fbm(p * 10.0 + uSeed * 3.0) - 0.5) * 0.08 + (fbm(p * 38.0 + uSeed) - 0.5) * 0.03;

#ifdef HAS_DERIV
  float aa = max(fwidth(field) * 0.8, 0.004);
#else
  float aa = 0.02;
#endif
  float alpha = smoothstep(0.5 - aa, 0.5 + aa, field);
  vec3 ink = mix(vec3(0.067), vec3(0.93), uDark);

#ifdef HAS_DERIV
  // wet edge: a faint sheen along edges that face the light, from the
  // field's gradient in the thin band just inside the surface
  vec2 g = vec2(dFdx(raw), dFdy(raw));
  vec2 n = g / max(length(g), 1e-5);
  float band = smoothstep(0.5, 0.7, raw) * (1.0 - smoothstep(0.7, 1.0, raw));
  float sheen = pow(max(dot(-n, normalize(vec2(-0.6, 0.8))), 0.0), 3.0);
  ink += mix(vec3(0.16), vec3(-0.14), uDark) * sheen * band * (1.0 - fs);
#endif

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
  float logoM = (1.0 - smoothstep(-aaL, aaL, dl)) * focus * (1.0 - smoothstep(0.15, 0.7, fs));

  vec3 col = mix(ink, mix(vec3(1.0), vec3(0.067), uDark), logoM);

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('InkSplat shader error:', gl.getShaderInfoLog(shader));
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vert: string, frag: string) {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  return program;
}

// droplet kinds decide how the flood treats them: the mass leads, strands
// follow, loose drops swell least so the front overtakes them
const CORE = 0;
const JET = 1;
const DROP = 2;
const SPATTER = 3;
const FLOOD_GROW = [1.5, 0.3, 0.3, 0.3];

const TAU = Math.PI * 2;

export type InkTheme = 'light' | 'dark';

// `theme` picks the palette: light is black ink on white, dark is white ink
// on black. When omitted the splat follows a `dark` class on <html>.
export function InkSplat({ className, theme }: { className?: string; theme?: InkTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  const applyThemeRef = useRef<() => void>(null);

  useEffect(() => {
    themeRef.current = theme;
    applyThemeRef.current?.();
  }, [theme]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    if (!gl) return;

    const hasDeriv = !!gl.getExtension('OES_standard_derivatives');
    const fieldProgram = link(gl, VERT, FIELD_FRAG);
    const inkProgram = link(
      gl,
      VERT,
      (hasDeriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV\n' : '') +
        INK_FRAG
    );

    // fullscreen triangle shared by both passes
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // droplet state lives in a tiny RGBA8 texture (two rows per droplet
    // column) that the field pass loops over — no float-texture extension
    // needed, and 16-bit fixed point is far finer than a pixel
    const dataTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MAX_PARTICLES, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const data = new Uint8Array(MAX_PARTICLES * 2 * 4);

    // the density field render target
    const fieldTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(fieldProgram);
    gl.uniform1i(gl.getUniformLocation(fieldProgram, 'uData'), 0);
    const fDims = gl.getUniformLocation(fieldProgram, 'uDims');
    const fCount = gl.getUniformLocation(fieldProgram, 'uCount');

    gl.useProgram(inkProgram);
    gl.uniform1i(gl.getUniformLocation(inkProgram, 'uField'), 1);
    const iDims = gl.getUniformLocation(inkProgram, 'uDims');
    const iPx = gl.getUniformLocation(inkProgram, 'uPx');
    const iTime = gl.getUniformLocation(inkProgram, 'uTime');
    const iSeed = gl.getUniformLocation(inkProgram, 'uSeed');
    const iDark = gl.getUniformLocation(inkProgram, 'uDark');

    gl.clearColor(0, 0, 0, 0);

    const setTheme = () => {
      const dark =
        themeRef.current !== undefined
          ? themeRef.current === 'dark'
          : document.documentElement.classList.contains('dark');
      gl.useProgram(inkProgram);
      gl.uniform1f(iDark, dark ? 1 : 0);
    };
    setTheme();

    // ---- particle state -------------------------------------------------
    const px = new Float32Array(MAX_PARTICLES);
    const py = new Float32Array(MAX_PARTICLES);
    const vx = new Float32Array(MAX_PARTICLES);
    const vy = new Float32Array(MAX_PARTICLES);
    const rad = new Float32Array(MAX_PARTICLES);
    const drag = new Float32Array(MAX_PARTICLES);
    const kind = new Uint8Array(MAX_PARTICLES);
    // launch heading and a lasting elongation along it: jets stay drawn out
    // into strands after they stop, drops keep a faint teardrop
    const head = new Float32Array(MAX_PARTICLES);
    const elong = new Float32Array(MAX_PARTICLES);
    // droplets born after the impact wait, invisible, until their moment
    const born = new Float32Array(MAX_PARTICLES);
    let count = 0;

    // viewport geometry in shader units
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fieldScale = dpr >= 2 ? 3 : 2;
    let unit = 1;
    let dimX = 1;
    let dimY = 1;
    let cx = 0.5;
    let cy = 0.5;
    let fieldW = 1;
    let fieldH = 1;

    const resize = () => {
      const cw = canvas.clientWidth || 1;
      const ch = canvas.clientHeight || 1;
      unit = Math.max(cw, ch) * BLOT_SCALE;
      dimX = cw / unit;
      dimY = ch / unit;
      cx = dimX / 2;
      cy = dimY / 2;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      fieldW = Math.max(1, Math.ceil(canvas.width / fieldScale));
      fieldH = Math.max(1, Math.ceil(canvas.height / fieldScale));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fieldW, fieldH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.useProgram(fieldProgram);
      gl.uniform2f(fDims, dimX, dimY);
      gl.useProgram(inkProgram);
      gl.uniform2f(iDims, dimX, dimY);
      gl.uniform1f(iPx, 1 / (unit * dpr));
    };
    resize();

    const add = (
      x: number,
      y: number,
      sx: number,
      sy: number,
      r: number,
      k: number,
      type: number,
      stretch: number,
      delay = 0
    ) => {
      if (count >= MAX_PARTICLES) return;
      px[count] = x;
      py[count] = y;
      vx[count] = sx;
      vy[count] = sy;
      rad[count] = r;
      drag[count] = k;
      kind[count] = type;
      head[count] = Math.atan2(sy, sx);
      elong[count] = stretch;
      born[count] = delay;
      count++;
    };

    // the impact: everything starts at the centre and is thrown outward.
    // Speeds are in units/s; with exponential drag k a droplet travels v/k.
    const spawn = () => {
      count = 0;
      const R = Math.random;
      const s1 = R() * TAU;
      const s2 = R() * TAU;
      const s3 = R() * TAU;

      // core: a heavy, slow burst of fat droplets that pile into the mass.
      // Launch speed follows a few low harmonics so the settled blob has lobes
      const lobeAt = (a: number) =>
        1 +
        0.5 * (0.5 * Math.sin(3 * a + s1) + 0.3 * Math.sin(5 * a + s2) + 0.2 * Math.sin(8 * a + s3));
      // a few heavy anchors barely move, so the middle is always solid under
      // the logo whatever the rest of the burst does
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + R();
        const speed = 0.12 + 0.2 * R();
        add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 0.06 + 0.02 * R(), 7, CORE, 0);
      }
      for (let i = 0; i < 34; i++) {
        const a = R() * TAU;
        const speed = (0.35 + 0.85 * R()) * lobeAt(a);
        const r = 0.02 + 0.035 * R() * R() + (i < 5 ? 0.025 : 0);
        const d0 = 0.01 * R();
        add(
          cx + Math.cos(a) * d0,
          cy + Math.sin(a) * d0,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          r,
          7,
          CORE,
          0
        );
      }

      // rim: mid-weight droplets that land on or just past the edge of the
      // mass, breaking its outline into lumps and stubby lobes
      for (let i = 0; i < 22; i++) {
        const a = R() * TAU;
        const speed = (0.95 + 0.95 * R()) * lobeAt(a);
        const r = 0.007 + 0.01 * R();
        add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, 7, JET, 0.3);
      }

      // jets: strings of droplets fired along one heading with graded speed,
      // so they draw out into a tapered strand as they fly. The lead droplet
      // is a bulb; if the jet is fast enough the neck stretches past the
      // kernel reach and the bulb pinches off on its own. A shared sideways
      // kick that grows with speed bends each strand into a whip.
      const JETS = 9;
      const LINKS = 8;
      for (let j = 0; j < JETS; j++) {
        const a = ((j + (R() - 0.5) * 0.8) / JETS) * TAU;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        let S = 1.7 + 1.6 * R();
        if (R() < 0.3) S *= 1.3;
        const lat = (R() - 0.5) * 0.4 * S;
        for (let k = 0; k <= LINKS; k++) {
          const u = k / LINKS;
          const f = 0.4 + 0.6 * Math.pow(u, 1.1);
          const tip = k === LINKS;
          const r = tip ? 0.005 + 0.005 * R() : (0.009 + (0.0035 - 0.009) * u) * (0.85 + 0.3 * R());
          const v = S * f;
          const w = lat * f * f;
          add(
            cx + dx * 0.03,
            cy + dy * 0.03,
            dx * v - dy * w,
            dy * v + dx * w,
            r,
            7,
            JET,
            tip ? 0.3 : 1.0 + 0.4 * R()
          );
        }
      }

      // drops: light, fast debris that breaks free immediately. Drag is low
      // and varied, so the fast ones carry clean off the screen while a few
      // slower ones land inside the frame
      const dropA: number[] = [];
      const dropS: number[] = [];
      const dropK: number[] = [];
      for (let i = 0; i < 30; i++) {
        const a = R() * TAU;
        const sp = 1.0 + 3.0 * Math.pow(R(), 1.3);
        const k = 2.5 + 3 * R();
        const r = 0.0025 + 0.011 * R() * R() * R();
        dropA.push(a);
        dropS.push(sp);
        dropK.push(k);
        add(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, r, k, DROP, 0.1 + 0.06 * sp);
      }

      // crown: as the mass lands, a second wave of tiny droplets is thrown
      // off its rim a beat after the impact
      for (let i = 0; i < 16; i++) {
        const a = R() * TAU;
        const sp = 0.8 + 1.0 * R();
        const r = 0.002 + 0.0025 * R();
        add(
          cx + Math.cos(a) * 0.12,
          cy + Math.sin(a) * 0.12,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          r,
          5,
          SPATTER,
          0.3,
          0.09 + 0.08 * R()
        );
      }

      // mist: pinpricks that fall close around the blot
      for (let i = 0; i < 20; i++) {
        const a = R() * TAU;
        const sp = 0.5 + 1.4 * R();
        const r = 0.0012 + 0.001 * R();
        add(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, r, 5, SPATTER, 0.2, 0.02 + 0.04 * R());
      }

      // spatter: pinpricks shed in the wake of the drops, trailing behind them
      for (let i = 0; i < 18; i++) {
        const j = Math.floor(R() * dropA.length);
        const a = dropA[j] + (R() - 0.5) * 0.3;
        const sp = dropS[j] * (0.35 + 0.45 * R());
        const r = 0.0015 + 0.0025 * R();
        add(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, r, dropK[j], SPATTER, 0.25);
      }
    };

    // one physics step. Surface tension is a weak attraction between droplets
    // whose kernels overlap but which have drifted apart: it lets strands
    // relax and bulbs bob without ever dragging debris back home.
    const step = (dt: number, t: number) => {
      const fs = Math.min(Math.max((t - FLOOD_START) / FLOOD_LEN, 0), 1);
      for (let i = 0; i < count; i++) {
        if (born[i] > t) continue;
        const ri = rad[i];
        const Ri = ri / KERNEL_Q;
        const mi = (ri / 0.01) * (ri / 0.01);
        for (let j = i + 1; j < count; j++) {
          if (born[j] > t) continue;
          const rj = rad[j];
          const reach = (Ri + rj / KERNEL_Q) * 0.9;
          const dx = px[j] - px[i];
          const dy = py[j] - py[i];
          const d2 = dx * dx + dy * dy;
          if (d2 >= reach * reach) continue;
          const d = Math.sqrt(d2) || 1e-6;
          const rest = (ri + rj) * 0.95;
          if (d <= rest) continue;
          const s = (d - rest) / (reach - rest);
          const f = 8 * (d - rest) * (1 - s);
          const ax = (f * dx) / d;
          const ay = (f * dy) / d;
          const mj = (rj / 0.01) * (rj / 0.01);
          vx[i] += (ax / mi) * dt;
          vy[i] += (ay / mi) * dt;
          vx[j] -= (ax / mj) * dt;
          vy[j] -= (ay / mj) * dt;
        }
      }
      for (let i = 0; i < count; i++) {
        if (born[i] > t) continue;
        if (fs > 0) {
          // the flood shoves everything outward and stirs it as it goes
          const ox = px[i] - cx;
          const oy = py[i] - cy;
          const od = Math.hypot(ox, oy) || 1e-6;
          const swirl = Math.sin(px[i] * 23 + t * 3) * Math.cos(py[i] * 19 - t * 2);
          const push = 0.9 * fs * fs;
          vx[i] += ((ox / od) * push + (-oy / od) * swirl * 0.4 * fs) * dt;
          vy[i] += ((oy / od) * push + (ox / od) * swirl * 0.4 * fs) * dt;
        }
        const damp = Math.exp(-drag[i] * dt);
        vx[i] *= damp;
        vy[i] *= damp;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
      }
    };

    const enc16 = (v: number, lo: number, hi: number, o: number) => {
      const n = Math.round(Math.min(Math.max((v - lo) / (hi - lo), 0), 1) * 65535);
      data[o] = n >> 8;
      data[o + 1] = n & 255;
    };
    const upload = (t: number) => {
      const fs = Math.min(Math.max((t - FLOOD_START) / FLOOD_LEN, 0), 1);
      const flood = fs * fs * fs;
      for (let i = 0; i < count; i++) {
        const o0 = i * 4;
        const o1 = (MAX_PARTICLES + i) * 4;
        enc16(px[i], -1, 2, o0);
        enc16(py[i], -1, 2, o0 + 2);
        // droplets swell as the flood arrives so they merge into the front
        const r = born[i] > t ? 0.0001 : rad[i] * (1 + FLOOD_GROW[kind[i]] * flood * 4);
        enc16(r / KERNEL_Q, 0, 4, o1);
        const speed = Math.hypot(vx[i], vy[i]);
        const th = speed > 0.05 ? Math.atan2(vy[i], vx[i]) : head[i];
        data[o1 + 2] = Math.round(((((th % TAU) + TAU) % TAU) / TAU) * 255);
        // fast droplets streak along their heading on top of their lasting shape
        const stretch = Math.min(
          elong[i] * (1 - fs) + (kind[i] === CORE ? 0 : Math.min(speed * 0.3, 1.2)),
          3
        );
        data[o1 + 3] = Math.round((stretch / 3) * 255);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_PARTICLES, 2, gl.RGBA, gl.UNSIGNED_BYTE, data);
    };

    const draw = (t: number) => {
      // pass 1: density field at reduced resolution
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fieldW, fieldH);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.useProgram(fieldProgram);
      gl.uniform1i(fCount, count);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // pass 2: ink, flood, logo at full resolution
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.useProgram(inkProgram);
      gl.uniform1f(iTime, t);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // the screen starts blank: `start` is set by the first click, and every
    // click after that re-seeds and replays the splat
    let start = -1;
    let simT = 0;
    let raf = 0;

    // once the flood has covered the screen nothing moves, so the loop stops
    // after DURATION and only repaints on a theme change or resize
    const render = () => {
      const t = Math.min((performance.now() - start) / 1000, DURATION);
      // fixed-step physics so the settle is identical at any frame rate
      while (simT < t) {
        const dt = Math.min(1 / 120, t - simT);
        step(dt, simT);
        simT += dt;
      }
      upload(t);
      draw(t);
      if (t < DURATION) raf = requestAnimationFrame(render);
    };
    const repaint = () => {
      if (start < 0) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    applyThemeRef.current = () => {
      setTheme();
      repaint();
    };
    const splat = () => {
      cancelAnimationFrame(raf);
      gl.useProgram(inkProgram);
      gl.uniform1f(iSeed, Math.random() * 100);
      spawn();
      start = performance.now();
      simT = 0;
      raf = requestAnimationFrame(render);
    };
    window.addEventListener('pointerdown', splat);

    const observer = new MutationObserver(() => {
      setTheme();
      repaint();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const sizeObserver = new ResizeObserver(() => {
      resize();
      repaint();
    });
    sizeObserver.observe(canvas);

    return () => {
      applyThemeRef.current = null;
      cancelAnimationFrame(raf);
      observer.disconnect();
      sizeObserver.disconnect();
      window.removeEventListener('pointerdown', splat);
      // no loseContext() here: React StrictMode remounts the effect on the same
      // canvas, and getContext() would hand back the dead context
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label="pmndrs"
      role="img"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
