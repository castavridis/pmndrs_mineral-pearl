import {
  FLOOD_LEN,
  FLOOD_START,
  KERNEL_Q,
  MAX_PARTICLES,
  TAU,
  floodReach,
  type FloodEase,
} from './config';

// The ink is a particle fluid: on impact a burst of droplets is launched from
// the centre with velocity, drag and a weak surface-tension attraction, all
// simulated here on the CPU. The GPU renders them as a metaball density field
// (see shaders.ts) — where droplets overlap the field merges, so strands,
// necks, bulbs and pinch-offs come out of the motion rather than being drawn
// by hand.

// droplet kinds decide how the flood treats them: the mass leads, strands
// follow, loose drops swell least so the front overtakes them
const CORE = 0;
const JET = 1;
const DROP = 2;
const SPATTER = 3;
const FLOOD_GROW = [1.5, 0.3, 0.3, 0.3];

/** Bytes per droplet column in the RGBA8 data texture (two rows of RGBA). */
export const DATA_BYTES = MAX_PARTICLES * 2 * 4;

export class InkParticles {
  px = new Float32Array(MAX_PARTICLES);
  py = new Float32Array(MAX_PARTICLES);
  vx = new Float32Array(MAX_PARTICLES);
  vy = new Float32Array(MAX_PARTICLES);
  rad = new Float32Array(MAX_PARTICLES);
  drag = new Float32Array(MAX_PARTICLES);
  kind = new Uint8Array(MAX_PARTICLES);
  // launch heading and a lasting elongation along it: jets stay drawn out
  // into strands after they stop, drops keep a faint teardrop
  head = new Float32Array(MAX_PARTICLES);
  elong = new Float32Array(MAX_PARTICLES);
  // droplets born after the impact wait, invisible, until their moment
  born = new Float32Array(MAX_PARTICLES);
  count = 0;

  /** Impact point in shader units; set from the viewport before spawning. */
  cx = 0.5;
  cy = 0.5;
  /** Canvas size in shader units. */
  dimX = 1;
  dimY = 1;
  /** Half extents of the flood's clip box in shader units; 0 means no clip. */
  clipHalfX = 0;
  clipHalfY = 0;
  /** Flood timing, seconds after impact. */
  floodStart = FLOOD_START;
  floodLen = FLOOD_LEN;
  /** How the flood's reach grows; the droplets swell in step with the front. */
  floodEase: FloodEase = 'in';
  /** True after `spawnEdge`: the flood closes in and the droplets came from the edge. */
  engulf = false;

  /** 0 → 1 progress of the flood at simulation time `t`. */
  phase(t: number) {
    return Math.min(Math.max((t - this.floodStart) / this.floodLen, 0), 1);
  }

  /** The box the ink is bounded by: the clip box, else the canvas. Half extents. */
  private box() {
    const clipped = this.clipHalfX > 0 && this.clipHalfY > 0;
    return {
      hx: clipped ? this.clipHalfX : this.dimX / 2,
      hy: clipped ? this.clipHalfY : this.dimY / 2,
      mx: this.dimX / 2,
      my: this.dimY / 2,
    };
  }

  private add(
    x: number,
    y: number,
    sx: number,
    sy: number,
    r: number,
    k: number,
    type: number,
    stretch: number,
    delay = 0
  ) {
    const i = this.count;
    if (i >= MAX_PARTICLES) return;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = sx;
    this.vy[i] = sy;
    this.rad[i] = r;
    this.drag[i] = k;
    this.kind[i] = type;
    this.head[i] = Math.atan2(sy, sx);
    this.elong[i] = stretch;
    this.born[i] = delay;
    this.count++;
  }

  /**
   * The impact: everything starts at the centre and is thrown outward.
   * Speeds are in units/s; with exponential drag k a droplet travels v/k.
   */
  /**
   * @param spatter How much of the burst flies: 1 is the study's splat, and
   * lower keeps more of the ink in the mass. It thins the counts of everything
   * thrown, shortens what is left, and flattens the lobes the launch speed
   * carries, so the blot draws in toward a round one rather than a starred
   * one. At 0 only the core lands.
   */
  spawn(random: () => number = Math.random, spatter = 1) {
    const { cx, cy } = this;
    const R = random;
    const sp = Math.max(0, Math.min(1, spatter));
    /** how many of a group to throw */
    const N = (n: number) => Math.round(n * sp);
    this.count = 0;
    this.engulf = false;
    const s1 = R() * TAU;
    const s2 = R() * TAU;
    const s3 = R() * TAU;

    // core: a heavy, slow burst of fat droplets that pile into the mass.
    // Launch speed follows a few low harmonics so the settled blob has lobes
    const lobeAt = (a: number) =>
      1 +
      0.5 *
        sp *
        (0.5 * Math.sin(3 * a + s1) + 0.3 * Math.sin(5 * a + s2) + 0.2 * Math.sin(8 * a + s3));
    // a few heavy anchors barely move, so the middle is always solid under
    // the logo whatever the rest of the burst does
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + R();
      const speed = 0.12 + 0.2 * R();
      this.add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 0.06 + 0.02 * R(), 7, CORE, 0);
    }
    for (let i = 0; i < 34; i++) {
      const a = R() * TAU;
      const speed = (0.35 + 0.85 * R()) * lobeAt(a) * (0.55 + 0.45 * sp);
      const r = 0.02 + 0.035 * R() * R() + (i < 5 ? 0.025 : 0);
      const d0 = 0.01 * R();
      this.add(
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
    for (let i = 0; i < N(22); i++) {
      const a = R() * TAU;
      const speed = (0.95 + 0.95 * R()) * lobeAt(a) * (0.5 + 0.5 * sp);
      const r = 0.007 + 0.01 * R();
      this.add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, 7, JET, 0.3);
    }

    // jets: strings of droplets fired along one heading with graded speed,
    // so they draw out into a tapered strand as they fly. The lead droplet
    // is a bulb; if the jet is fast enough the neck stretches past the
    // kernel reach and the bulb pinches off on its own. A shared sideways
    // kick that grows with speed bends each strand into a whip.
    const JETS = N(9);
    const LINKS = 8;
    for (let j = 0; j < JETS; j++) {
      const a = ((j + (R() - 0.5) * 0.8) / JETS) * TAU;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let S = (1.7 + 1.6 * R()) * (0.35 + 0.65 * sp);
      if (R() < 0.3) S *= 1.3;
      const lat = (R() - 0.5) * 0.4 * S;
      for (let k = 0; k <= LINKS; k++) {
        const u = k / LINKS;
        const f = 0.4 + 0.6 * Math.pow(u, 1.1);
        const tip = k === LINKS;
        const r = tip ? 0.005 + 0.005 * R() : (0.009 + (0.0035 - 0.009) * u) * (0.85 + 0.3 * R());
        const v = S * f;
        const w = lat * f * f;
        this.add(
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
    for (let i = 0; i < N(30); i++) {
      const a = R() * TAU;
      const speed = (1.0 + 3.0 * Math.pow(R(), 1.3)) * (0.4 + 0.6 * sp);
      const k = 2.5 + 3 * R();
      const r = 0.0025 + 0.011 * R() * R() * R();
      dropA.push(a);
      dropS.push(speed);
      dropK.push(k);
      this.add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, k, DROP, 0.1 + 0.06 * speed);
    }

    // crown: as the mass lands, a second wave of tiny droplets is thrown
    // off its rim a beat after the impact
    for (let i = 0; i < N(16); i++) {
      const a = R() * TAU;
      const speed = (0.8 + 1.0 * R()) * (0.5 + 0.5 * sp);
      const r = 0.002 + 0.0025 * R();
      this.add(
        cx + Math.cos(a) * 0.12,
        cy + Math.sin(a) * 0.12,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        r,
        5,
        SPATTER,
        0.3,
        0.09 + 0.08 * R()
      );
    }

    // mist: pinpricks that fall close around the blot
    for (let i = 0; i < N(20); i++) {
      const a = R() * TAU;
      const speed = (0.5 + 1.4 * R()) * (0.5 + 0.5 * sp);
      const r = 0.0012 + 0.001 * R();
      this.add(
        cx,
        cy,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        r,
        5,
        SPATTER,
        0.2,
        0.02 + 0.04 * R()
      );
    }

    // spatter: pinpricks shed in the wake of the drops, trailing behind them
    for (let i = 0; i < N(18) && dropA.length; i++) {
      const j = Math.floor(R() * dropA.length);
      const a = dropA[j] + (R() - 0.5) * 0.3;
      const speed = dropS[j] * (0.35 + 0.45 * R());
      const r = 0.0015 + 0.0025 * R();
      this.add(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, dropK[j], SPATTER, 0.25);
    }
  }

  /**
   * The inverse impact: droplets are shed from the box's edge and thrown
   * inward, staggered over the first second, ahead of the flood that follows
   * them in from the edge. Nothing lands at the centre; the flood does that.
   */
  spawnEdge(random: () => number = Math.random) {
    const R = random;
    const { hx, hy, mx, my } = this.box();
    this.count = 0;
    this.engulf = true;
    // the flood push pulls everything toward the centre
    this.cx = mx;
    this.cy = my;

    // a random point on the perimeter and its inward normal
    const edge = () => {
      const perim = 2 * (hx + hy);
      let u = R() * perim;
      if (u < hx * 2) return { x: mx - hx + u, y: my - hy, nx: 0, ny: 1 };
      u -= hx * 2;
      if (u < hy * 2) return { x: mx + hx, y: my - hy + u, nx: -1, ny: 0 };
      u -= hy * 2;
      if (u < hx * 2) return { x: mx + hx - u, y: my + hy, nx: 0, ny: -1 };
      u -= hx * 2;
      return { x: mx - hx, y: my + hy - u, nx: 1, ny: 0 };
    };
    const rotate = (nx: number, ny: number, a: number) => ({
      dx: nx * Math.cos(a) - ny * Math.sin(a),
      dy: nx * Math.sin(a) + ny * Math.cos(a),
    });

    // drops: mid-weight debris flung in from all round the edge
    for (let i = 0; i < 44; i++) {
      const e = edge();
      const { dx, dy } = rotate(e.nx, e.ny, (R() - 0.5) * 1.0);
      const sp = 0.4 + 1.3 * Math.pow(R(), 1.3);
      const k = 3 + 3 * R();
      const r = 0.003 + 0.011 * R() * R();
      this.add(e.x, e.y, dx * sp, dy * sp, r, k, DROP, 0.1 + 0.08 * sp, R() * 0.9);
    }

    // jets: strings fired inward from a few points, drawing out into tendrils
    const JETS = 6;
    const LINKS = 7;
    for (let j = 0; j < JETS; j++) {
      const e = edge();
      const { dx, dy } = rotate(e.nx, e.ny, (R() - 0.5) * 0.6);
      const S = 1.0 + 1.1 * R();
      const lat = (R() - 0.5) * 0.35 * S;
      const delay = 0.1 + 0.6 * R();
      for (let k = 0; k <= LINKS; k++) {
        const u = k / LINKS;
        const f = 0.4 + 0.6 * Math.pow(u, 1.1);
        const tip = k === LINKS;
        const r = tip ? 0.005 + 0.004 * R() : (0.008 + (0.003 - 0.008) * u) * (0.85 + 0.3 * R());
        const v = S * f;
        const w = lat * f * f;
        this.add(
          e.x,
          e.y,
          dx * v - dy * w,
          dy * v + dx * w,
          r,
          6,
          JET,
          tip ? 0.3 : 1.0 + 0.4 * R(),
          delay
        );
      }
    }

    // spatter: pinpricks that barely make it in from the edge
    for (let i = 0; i < 36; i++) {
      const e = edge();
      const { dx, dy } = rotate(e.nx, e.ny, (R() - 0.5) * 1.4);
      const sp = 0.3 + 1.0 * R();
      const r = 0.0015 + 0.0025 * R();
      this.add(e.x, e.y, dx * sp, dy * sp, r, 4 + 2 * R(), SPATTER, 0.25, R() * 1.0);
    }
  }

  /**
   * One physics step. Surface tension is a weak attraction between droplets
   * whose kernels overlap but which have drifted apart: it lets strands
   * relax and bulbs bob without ever dragging debris back home.
   */
  step(dt: number, t: number) {
    const { px, py, vx, vy, rad, drag, born, count, cx, cy } = this;
    const fs = this.phase(t);
    // the flood shoves everything outward from the blot, or inward from the edge
    const dir = this.engulf ? -1 : 1;
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
        const push = 0.9 * fs * fs * dir;
        vx[i] += ((ox / od) * push + (-oy / od) * swirl * 0.4 * fs) * dt;
        vy[i] += ((oy / od) * push + (ox / od) * swirl * 0.4 * fs) * dt;
      }
      const damp = Math.exp(-drag[i] * dt);
      vx[i] *= damp;
      vy[i] *= damp;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
  }

  /**
   * Pack droplet state into the RGBA8 data texture: two rows per droplet
   * column, 16-bit fixed point for position and reach — no float-texture
   * extension needed, and far finer than a pixel.
   */
  encode(t: number, data: Uint8Array) {
    const { px, py, vx, vy, rad, kind, head, elong, born, count } = this;
    const clipped = this.clipHalfX > 0 && this.clipHalfY > 0;
    const { hx, hy, mx, my } = this.box();
    const fs = this.phase(t);
    const flood = floodReach(fs, this.floodEase);
    const enc16 = (v: number, lo: number, hi: number, o: number) => {
      const n = Math.round(Math.min(Math.max((v - lo) / (hi - lo), 0), 1) * 65535);
      data[o] = n >> 8;
      data[o + 1] = n & 255;
    };
    for (let i = 0; i < count; i++) {
      const o0 = i * 4;
      const o1 = (MAX_PARTICLES + i) * 4;
      enc16(px[i], -1, 2, o0);
      enc16(py[i], -1, 2, o0 + 2);
      // droplets swell as the flood arrives so they merge into the front. With
      // a clip box the front alone covers it, and a swollen core would burst
      // out past the box, so droplets keep their size and lie around as
      // spatter; the small edge droplets of an engulf may swell while inside
      const inside = Math.abs(px[i] - mx) < hx && Math.abs(py[i] - my) < hy;
      const grow = this.engulf
        ? inside
          ? FLOOD_GROW[kind[i]]
          : 0
        : clipped
          ? 0
          : FLOOD_GROW[kind[i]];
      const r = born[i] > t ? 0.0001 : rad[i] * (1 + grow * flood * 4);
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
  }
}
