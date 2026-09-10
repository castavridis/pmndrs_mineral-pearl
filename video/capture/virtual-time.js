// Injected before any page script (Playwright `addInitScript`). It takes the
// page's clocks away from the wall and hands them to the capture driver:
// `performance.now`, `Date`, `requestAnimationFrame`, timers, event
// timestamps, `Math.random` and every CSS / Web Animation run only when the
// driver calls `__vt.advance(ms)`. Each captured frame is then exactly one
// step of simulated time, however long the GPU or the screenshot took, so the
// footage is smooth, repeatable, and can be shot in slow motion for free.
(() => {
  const cfg = window.__VT_CONFIG__ || {};
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;
  const EPOCH = cfg.epoch ?? RealDate.UTC(2026, 0, 1, 12);
  // Not zero: code that stamps "time of last impact" and treats < 0 as
  // "never" must not see a first frame at t = 0 as special.
  let now = 1000;

  // --- clocks -------------------------------------------------------------
  performance.now = () => now;
  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(EPOCH + now);
      else super(...args);
    }
    static now() {
      return EPOCH + now;
    }
  }
  window.Date = VirtualDate;
  try {
    Object.defineProperty(Event.prototype, 'timeStamp', {
      configurable: true,
      get: () => now,
    });
  } catch {}

  // --- seeded randomness: the same take every time -------------------------
  let seed = (cfg.seed ?? 1) >>> 0;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // --- timers ----------------------------------------------------------------
  let nextId = 1;
  const timers = new Map(); // id -> { due, fn, args, interval }
  function addTimer(fn, delay, args, repeat) {
    if (typeof fn !== 'function') return 0;
    const id = nextId++;
    const d = Math.max(0, Number(delay) || 0);
    timers.set(id, { due: now + d, fn, args, interval: repeat ? Math.max(1, d) : 0 });
    return id;
  }
  window.setTimeout = (fn, delay, ...args) => addTimer(fn, delay, args, false);
  window.setInterval = (fn, delay, ...args) => addTimer(fn, delay, args, true);
  window.clearTimeout = window.clearInterval = (id) => {
    timers.delete(id);
  };

  // --- animation frames --------------------------------------------------------
  let rafQueue = new Map();
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    rafQueue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafQueue.delete(id);
  };

  // --- CSS transitions / animations and element.animate() -------------------
  // Each is paused the first time it is seen and then seeked to the virtual
  // time elapsed since; one that reaches its end is finished, so
  // transitionend / animationend still fire.
  const owned = new WeakMap();
  function syncAnimations() {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let s = owned.get(a);
      if (!s) {
        if (a.playState !== 'running') continue;
        s = { start: now };
        owned.set(a, s);
        a.pause();
      }
      const t = (now - s.start) * (a.playbackRate || 1);
      const end = a.effect?.getComputedTiming().endTime ?? Infinity;
      if (t >= end) {
        try {
          a.finish();
        } catch {}
      } else {
        a.currentTime = t;
      }
    }
  }

  const yieldToBrowser = () => new Promise((r) => realSetTimeout(r, 0));

  window.__vt = {
    get now() {
      return now;
    },
    /** Step virtual time by `ms`: due timers in order, then one animation frame. */
    async advance(ms) {
      const target = now + ms;
      for (let guard = 0; guard < 10000; guard++) {
        let id = -1;
        let best = Infinity;
        for (const [k, t] of timers) {
          if (t.due <= target && t.due < best) {
            best = t.due;
            id = k;
          }
        }
        if (id < 0) break;
        const t = timers.get(id);
        now = Math.max(now, t.due);
        if (t.interval) t.due = now + t.interval;
        else timers.delete(id);
        try {
          t.fn(...t.args);
        } catch (e) {
          console.error(e);
        }
        // let the callback's promise jobs run, as they would after a real task
        await Promise.resolve();
      }
      now = target;
      const queue = rafQueue;
      rafQueue = new Map();
      for (const cb of queue.values()) {
        try {
          cb(now);
        } catch (e) {
          console.error(e);
        }
      }
      syncAnimations();
      // let React's scheduler (a MessageChannel, left on the real clock)
      // commit whatever the frame set in motion before the shutter
      await yieldToBrowser();
    },
  };
})();
