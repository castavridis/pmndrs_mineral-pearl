import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type CDPSession, type Page } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
export const CLIPS_DIR = join(here, '..', 'public', 'clips');
const VT_SCRIPT = readFileSync(join(here, 'virtual-time.js'), 'utf8');

// --------------------------------------------------------------------------
// Shots
// --------------------------------------------------------------------------

export type Point = { x: number; y: number };
/** A CSS selector (its element's centre), a point in CSS px, or a selector with an anchor. */
export type Target =
  string | Point | { selector: string; anchor?: [number, number]; offset?: [number, number] };
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'snap' | 'smooth' | 'sine';

export interface Shot {
  /** Output name; the CLI sets it from the file name (`shots/<name>.ts`). */
  name?: string;
  /** App route, e.g. `/` (the bento) or `/dev/splat`. */
  path: string;
  /** CSS viewport. Smaller = the UI reads bigger on screen. Default 1280×720. */
  viewport?: { width: number; height: number };
  /** Device scale factor; 2 keeps the edit's punch-ins crisp. Default 2. */
  scale?: number;
  /** Output frame rate. Default 60. */
  fps?: number;
  /** Seed for Math.random, so a take is repeatable. Default 1. */
  seed?: number;
  /** Selector to wait for before rolling. */
  ready?: string;
  /** Seconds of virtual time to let the page settle before the first frame. Default 1. */
  warmup?: number;
  /** Extra CSS for the take (the Leva panel is always hidden). */
  css?: string;
  /** Let link clicks navigate. Off by default so a stray click cannot end the take. */
  allowNavigation?: boolean;
  /** Where the pointer rests before the first move. Default: bottom-right, out of the way. */
  cursorStart?: Point;
  /**
   * Elements to follow: each CSS selector (a list is one box around all its
   * matches) has its box recorded on every frame, so the edit can frame a
   * component wherever the layout moves it (`focus: 'track:<name>'`).
   */
  track?: Record<string, string>;
  /**
   * Staging before the camera rolls, with the same director calls: switch the
   * theme, open a menu, park the pointer. It plays in virtual time but no
   * frame of it is kept.
   */
  setup?: (d: Director) => Promise<void>;
  /** The take itself. Every director call consumes screen time. */
  script: (d: Director) => Promise<void>;
}

export const defineShot = (s: Shot) => s;

export interface Mark {
  name: string;
  frame: number;
  time: number;
  rect?: { x: number; y: number; width: number; height: number };
}

export interface ClipMeta {
  name: string;
  fps: number;
  frames: number;
  duration: number;
  viewport: { width: number; height: number };
  scale: number;
  /** Per frame: pointer x, y (CSS px) and whether a button is held. */
  cursor: [number, number, 0 | 1][];
  /** Per frame: how fast virtual time ran (1 = real time, 0.25 = 4× slow motion). */
  speed: number[];
  marks: Mark[];
  /** Per tracked element, per frame: its box [x, y, width, height] in CSS px, or null when absent. */
  tracks: Record<string, ([number, number, number, number] | null)[]>;
}

// --------------------------------------------------------------------------
// Easing and paths
// --------------------------------------------------------------------------

const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  // fast departure, soft landing: the way a hand throws a cursor at a target
  snap: (t) => 1 - (1 - t) ** 5,
  // minimum jerk: how an unhurried hand moves between two points
  smooth: (t) => t * t * t * (t * (6 * t - 15) + 10),
  sine: (t) => (1 - Math.cos(Math.PI * t)) / 2,
};

/** A gently arcing cubic from a to b, so the pointer moves like a hand, not a ruler. */
function arc(a: Point, b: Point, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = -dy * bend;
  const ny = dx * bend;
  const c1 = { x: a.x + dx * 0.3 + nx, y: a.y + dy * 0.3 + ny };
  const c2 = { x: a.x + dx * 0.7 + nx, y: a.y + dy * 0.7 + ny };
  return (t: number): Point => {
    const u = 1 - t;
    return {
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    };
  };
}

// --------------------------------------------------------------------------
// The director
// --------------------------------------------------------------------------

export class Director {
  readonly page: Page;
  private cdp: CDPSession;
  private ffmpeg: ChildProcess;
  private fps: number;
  private timeScale = 1;
  private ramp: { from: number; to: number; n: number; i: number; ease: (t: number) => number } | null =
    null;
  private pos: Point;
  private down = false;
  private rolling = false;
  private track: Record<string, string>;
  readonly meta: ClipMeta;

  constructor(
    page: Page,
    cdp: CDPSession,
    ffmpeg: ChildProcess,
    meta: ClipMeta,
    start: Point,
    track: Record<string, string> = {}
  ) {
    this.page = page;
    this.track = track;
    this.cdp = cdp;
    this.ffmpeg = ffmpeg;
    this.meta = meta;
    this.fps = meta.fps;
    this.pos = start;
  }

  /** Seconds of footage recorded so far. */
  get time() {
    return this.meta.frames / this.fps;
  }

  /** Start recording; everything before (the shot's `setup`) plays but is not kept. */
  roll() {
    this.rolling = true;
    this.meta.marks.length = 0;
  }

  /** Step one frame of virtual time and expose it. */
  private async frame() {
    if (this.ramp) {
      const r = this.ramp;
      r.i++;
      this.timeScale = r.from + (r.to - r.from) * r.ease(Math.min(1, r.i / r.n));
      if (r.i >= r.n) this.ramp = null;
    }
    const dt = (1000 / this.fps) * this.timeScale;
    // one round trip: step time, then measure the tracked elements as they now stand
    const boxes = await this.page.evaluate(
      async ([ms, track]) => {
        await (window as any).__vt.advance(ms);
        const out: Record<string, [number, number, number, number] | null> = {};
        for (const [name, sel] of Object.entries(track)) {
          const rs = [...document.querySelectorAll(sel)]
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0);
          if (!rs.length) {
            out[name] = null;
            continue;
          }
          const x = Math.min(...rs.map((r) => r.left));
          const y = Math.min(...rs.map((r) => r.top));
          const w = Math.max(...rs.map((r) => r.right)) - x;
          const h = Math.max(...rs.map((r) => r.bottom)) - y;
          out[name] = [x, y, w, h].map((v) => Math.round(v * 10) / 10) as [
            number,
            number,
            number,
            number,
          ];
        }
        return out;
      },
      [dt, this.rolling ? this.track : {}] as const
    );
    if (!this.rolling) return;
    for (const name of Object.keys(this.track))
      (this.meta.tracks[name] ??= []).push(boxes[name] ?? null);
    const shot = await this.cdp.send('Page.captureScreenshot', {
      format: 'png',
      optimizeForSpeed: true,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const buf = Buffer.from(shot.data, 'base64');
    if (this.meta.frames === 0) {
      // PNG: width and height at bytes 16 and 20
      const w = buf.readUInt32BE(16);
      const want = Math.round(this.meta.viewport.width * this.meta.scale);
      if (w !== want)
        throw new Error(`frames are ${w} px wide, not ${want}: the device scale did not take`);
    }
    if (!this.ffmpeg.stdin!.write(buf)) {
      await new Promise((r) => this.ffmpeg.stdin!.once('drain', r));
    }
    this.meta.cursor.push([+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), this.down ? 1 : 0]);
    this.meta.speed.push(this.timeScale);
    this.meta.frames++;
  }

  private frames(seconds: number) {
    return Math.max(1, Math.round(seconds * this.fps));
  }

  /** Resolve a target to a point in CSS px. */
  async point(target: Target): Promise<Point> {
    if (typeof target !== 'string' && 'x' in target) return target;
    const sel = typeof target === 'string' ? target : target.selector;
    const anchor = (typeof target !== 'string' && target.anchor) || [0.5, 0.5];
    const offset = (typeof target !== 'string' && target.offset) || [0, 0];
    const r = await this.rect(sel);
    return { x: r.x + r.width * anchor[0] + offset[0], y: r.y + r.height * anchor[1] + offset[1] };
  }

  /** An element's box in CSS px. */
  async rect(selector: string) {
    const el = this.page.locator(selector).first();
    const r = await el.boundingBox();
    if (!r) throw new Error(`no box for "${selector}"`);
    return r;
  }

  /** Hold the shot: let the page play for `seconds`. */
  async wait(seconds: number) {
    const n = this.frames(seconds);
    for (let i = 0; i < n; i++) await this.frame();
  }

  /**
   * Keep recording until `condition` holds in the page (checked every frame),
   * then `after` seconds more. Throws past `max` seconds, so a take never
   * hangs on a state that does not come.
   */
  async waitUntil<A>(
    condition: (arg: A) => boolean,
    opts: { arg?: A; max?: number; after?: number; min?: number } = {}
  ) {
    const max = this.frames(opts.max ?? 10);
    const min = opts.min ? this.frames(opts.min) : 0;
    for (let i = 0; ; i++) {
      if (i >= min && (await this.page.evaluate(condition as any, opts.arg))) break;
      if (i >= max) throw new Error(`waitUntil: not true after ${opts.max ?? 10}s: ${condition}`);
      await this.frame();
    }
    if (opts.after) await this.wait(opts.after);
  }

  /** Scroll the page to `y` over `duration` seconds, eased (frames are recorded even if it is already there). */
  async scrollTo(y: number, opts: { duration?: number; ease?: Ease } = {}) {
    const from = await this.page.evaluate(() => window.scrollY);
    const n = this.frames(opts.duration ?? 0.6);
    const ease = EASE[opts.ease ?? 'inOut'];
    for (let i = 1; i <= n; i++) {
      await this.page.evaluate((v) => window.scrollTo(0, v), from + (y - from) * ease(i / n));
      await this.frame();
    }
  }

  /** Let virtual time pass without recording anything (a jump cut inside the take). */
  async skip(seconds: number) {
    const step = 1000 / 60;
    for (let t = 0; t < seconds * 1000; t += step) {
      await this.page.evaluate((ms) => (window as any).__vt.advance(ms), step);
    }
  }

  /**
   * How fast the page's time runs from here on, for the frames that follow:
   * 0.25 is 4× slow motion (every frame still new, nothing interpolated),
   * 2 is double speed. Screen time is unaffected: `wait(1)` is still 1 s of footage.
   */
  speed(factor: number, opts: { over?: number; ease?: Ease } = {}) {
    // `over`: ease into the new rate across that many seconds of footage
    // instead of switching on the next frame — a speed ramp, not a jump
    if (opts.over) {
      const n = this.frames(opts.over);
      this.ramp = { from: this.timeScale, to: factor, n, i: 0, ease: EASE[opts.ease ?? 'sine'] };
      return;
    }
    this.ramp = null;
    this.timeScale = factor;
  }

  /** Glide the pointer to a target. */
  async moveTo(target: Target, opts: { duration?: number; ease?: Ease; bend?: number } = {}) {
    const to = await this.point(target);
    const from = { ...this.pos };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = opts.duration ?? Math.min(0.9, 0.35 + dist / 1600);
    const ease = EASE[opts.ease ?? 'inOut'];
    const path = arc(from, to, opts.bend ?? 0.12);
    const n = this.frames(duration);
    for (let i = 1; i <= n; i++) {
      this.pos = path(ease(i / n));
      await this.page.mouse.move(this.pos.x, this.pos.y);
      await this.frame();
    }
  }

  /** Move along several points in one smooth, continuous gesture (a flourish, a figure-eight). */
  async trace(points: Target[], opts: { duration?: number; ease?: Ease } = {}) {
    const pts = [this.pos, ...(await Promise.all(points.map((p) => this.point(p))))];
    const n = this.frames(opts.duration ?? 1.5);
    const ease = EASE[opts.ease ?? 'inOut'];
    // Catmull-Rom through every point
    const at = (t: number): Point => {
      const f = t * (pts.length - 1);
      const i = Math.min(Math.floor(f), pts.length - 2);
      const u = f - i;
      const p0 = pts[Math.max(0, i - 1)]!;
      const p1 = pts[i]!;
      const p2 = pts[i + 1]!;
      const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * u +
          (2 * a - 5 * b + 4 * c - d) * u * u +
          (-a + 3 * b - 3 * c + d) * u * u * u);
      return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
    };
    for (let i = 1; i <= n; i++) {
      this.pos = at(ease(i / n));
      await this.page.mouse.move(this.pos.x, this.pos.y);
      await this.frame();
    }
  }

  /** Press and release, optionally travelling to a target first. */
  async click(target?: Target, opts: { hold?: number; move?: number; ease?: Ease } = {}) {
    if (target) await this.moveTo(target, { duration: opts.move, ease: opts.ease ?? 'snap' });
    await this.mouseDown();
    await this.wait(opts.hold ?? 0.09);
    await this.mouseUp();
  }

  async mouseDown() {
    this.down = true;
    await this.page.mouse.down();
  }

  async mouseUp() {
    this.down = false;
    await this.page.mouse.up();
  }

  /** Press at one target, drag to another, release. */
  async drag(from: Target, to: Target, opts: { duration?: number; ease?: Ease } = {}) {
    await this.moveTo(from);
    await this.mouseDown();
    await this.wait(0.06);
    await this.moveTo(to, { duration: opts.duration ?? 0.8, ease: opts.ease ?? 'inOut' });
    await this.mouseUp();
  }

  /** Scroll by `dy` CSS px over `duration` seconds. */
  async scroll(dy: number, opts: { duration?: number; ease?: Ease } = {}) {
    const n = this.frames(opts.duration ?? 0.6);
    const ease = EASE[opts.ease ?? 'inOut'];
    let done = 0;
    for (let i = 1; i <= n; i++) {
      const next = dy * ease(i / n);
      await this.page.mouse.wheel(0, next - done);
      done = next;
      await this.frame();
    }
  }

  async key(key: string) {
    await this.page.keyboard.press(key);
  }

  /** Name this moment (and optionally where an element is) for the edit to cut or zoom on. */
  async mark(name: string, selector?: string) {
    const m: Mark = { name, frame: this.meta.frames, time: this.time };
    if (selector) m.rect = await this.bounds(selector);
    this.meta.marks.push(m);
  }

  /** The box around every element a selector matches (a group the camera should frame together). */
  async bounds(selector: string) {
    const boxes = (
      await Promise.all((await this.page.locator(selector).all()).map((l) => l.boundingBox()))
    ).filter((b): b is NonNullable<typeof b> => !!b && b.width > 0);
    if (!boxes.length) throw new Error(`no box for "${selector}"`);
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const right = Math.max(...boxes.map((b) => b.x + b.width));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    return { x, y, width: right - x, height: bottom - y };
  }

  /**
   * Click a button by its exact text without moving the pointer, hidden or
   * not: how a take presses the (hidden) Leva panel's buttons, like `engulf`.
   */
  async invoke(text: string) {
    const ok = await this.page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === t);
      b?.click();
      return !!b;
    }, text);
    if (!ok) throw new Error(`no button "${text}"`);
  }

  /** Run code in the page (call a component's imperative handle, flip a store). */
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg?: A) {
    return this.page.evaluate(fn as any, arg) as Promise<R>;
  }
}

// --------------------------------------------------------------------------
// Running a shot
// --------------------------------------------------------------------------

// One browser per device scale factor. The scale is the browser's own
// (--force-device-scale-factor), not an emulated one: headless Chrome's fast
// screenshot path returns the window's surface, which under emulation stays
// at CSS size — the page draws at 2×, the shot comes back at 1×. At the
// browser's own scale the surface is full size and costs no more to take.
const browsers = new Map<number, Browser>();
async function getBrowser(scale: number) {
  const open = browsers.get(scale);
  if (open) return open;
  const args = [
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    `--force-device-scale-factor=${scale}`,
    // roomy: the viewport itself is pinned per page (see runShot)
    '--window-size=2400,2400',
  ];
  let b: Browser;
  try {
    // the system Chrome gets the real GPU (ANGLE on Metal) in headless mode;
    // the ink is WebGL2 with float targets, so this is the difference between
    // the real shaders and the reduced fallback
    b = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--use-angle=metal', ...args],
    });
  } catch {
    b = await chromium.launch({ headless: true, args });
  }
  browsers.set(scale, b);
  return b;
}

export async function closeBrowser() {
  await Promise.all([...browsers.values()].map((b) => b.close()));
  browsers.clear();
}

const HIDE_CSS = `
  /* the dev tweak panel is not part of the product */
  #leva__root, [class*="leva-c-"] { display: none !important; }
`;

export async function runShot(shot: Shot, baseUrl: string, log = console.log) {
  const viewport = shot.viewport ?? { width: 1280, height: 720 };
  const scale = shot.scale ?? 2;
  const fps = shot.fps ?? 60;
  mkdirSync(CLIPS_DIR, { recursive: true });
  const name = shot.name ?? 'take';
  const out = join(CLIPS_DIR, `${name}.mp4`);

  const b = await getBrowser(scale);
  // no emulated viewport: the size is pinned below, the scale is the browser's
  const context = await b.newContext({ viewport: null, colorScheme: 'dark' });
  await context.addInitScript({
    content: `window.__VT_CONFIG__ = ${JSON.stringify({ seed: shot.seed ?? 1 })};\n${VT_SCRIPT}`,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // the viewport's size, leaving the device scale alone (0 = no override)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 0,
    mobile: false,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // Loading can wait on the page's own timers, which only run when virtual
  // time is ticked, so tick it until the document is complete.
  const tick = () => page.evaluate(() => (window as any).__vt?.advance(1000 / 60)).catch(() => {});
  await page.goto(new URL(shot.path, baseUrl).toString(), { waitUntil: 'commit' });
  const loadDeadline = Date.now() + 90000;
  while ((await page.evaluate(() => document.readyState).catch(() => 'loading')) !== 'complete') {
    if (Date.now() > loadDeadline) throw new Error(`${name}: the page never finished loading`);
    await tick();
    await new Promise((r) => setTimeout(r, 50));
  }
  await page.addStyleTag({ content: HIDE_CSS + (shot.css ?? '') });
  if (!shot.allowNavigation) {
    await page.evaluate(() => {
      document.addEventListener(
        'click',
        (e) => {
          const a = (e.target as Element | null)?.closest?.('a[href]');
          if (a) e.preventDefault();
        },
        true
      );
    });
  }

  // Warm up: tick virtual time while the page loads fonts, builds its GPU
  // resources and settles, until the ready selector shows.
  if (shot.ready) {
    const deadline = Date.now() + 20000;
    while (
      !(await page
        .locator(shot.ready)
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      if (Date.now() > deadline) throw new Error(`${name}: "${shot.ready}" never appeared`);
      await tick();
    }
  }
  await page.evaluate(() => document.fonts.ready);
  const warm = Math.round((shot.warmup ?? 1) * 60);
  for (let i = 0; i < warm; i++) await tick();

  const start = shot.cursorStart ?? { x: viewport.width * 0.92, y: viewport.height * 1.1 };
  await page.mouse.move(start.x, start.y);

  // The footage is an intermediate the edit scales and crops, so it is kept
  // near-lossless; the Mac's hardware encoder keeps up with the capture where
  // x264 at this size would be the bottleneck.
  const encoder =
    process.platform === 'darwin'
      ? ['-c:v', 'h264_videotoolbox', '-b:v', '80M', '-profile:v', 'high']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12'];
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-c:v',
      'png',
      '-i',
      '-',
      '-pix_fmt',
      'yuv420p',
      ...encoder,
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-colorspace',
      'bt709',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  const done = new Promise<void>((res, rej) =>
    ffmpeg.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))))
  );

  const meta: ClipMeta = {
    name,
    fps,
    frames: 0,
    duration: 0,
    viewport,
    scale,
    cursor: [],
    speed: [],
    marks: [],
    tracks: {},
  };
  const d = new Director(page, cdp, ffmpeg, meta, start, shot.track);
  const t0 = Date.now();
  try {
    if (shot.setup) {
      await shot.setup(d);
      d.speed(1);
    }
    d.roll();
    await shot.script(d);
  } finally {
    ffmpeg.stdin!.end();
    await done;
    meta.duration = meta.frames / fps;
    writeFileSync(join(CLIPS_DIR, `${name}.json`), JSON.stringify(meta));
    await context.close();
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  log(
    `✓ ${name}: ${meta.frames} frames (${meta.duration.toFixed(2)}s) in ${secs}s → public/clips/${name}.mp4`
  );
  if (errors.length) log(`  page errors:\n  ${[...new Set(errors)].slice(0, 5).join('\n  ')}`);
  return meta;
}
