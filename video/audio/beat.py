#!/usr/bin/env python3
"""A placeholder soundtrack and sound effects, synthesised from nothing (numpy only).

    python3 audio/beat.py --bpm 120 --beats 48 --drop 24:33

writes public/music/beat-<bpm>.wav (four-on-the-floor, a minor-key bass that
ducks under the kick, claps, hats) and public/sfx/{click,impact,whoosh}.wav.
`--drop a:b` strips the drums between those beats, for a slow-motion passage,
with a riser into it. Swap the music for a licensed track any time: the reel
only needs its file name and tempo (remotion/cuts/*.ts).
"""
import argparse
import os
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)
here = os.path.dirname(os.path.abspath(__file__))
public = os.path.join(here, "..", "public")


def env(n, decay):
    return np.exp(-np.arange(n) / (decay * SR))


def fft_filter(x, lo=None, hi=None):
    """Brick-ish band filter with soft (raised-cosine) edges, done in the frequency domain."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= np.clip(1 - (f - hi) / hi, 0, 1) ** 2
    if lo:
        g *= np.clip(f / lo, 0, 1) ** 2
    return np.fft.irfft(X * g, len(x))


def kick(punch=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    freq = 42 + 120 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * env(n, 0.16)
    click = fft_filter(rng.standard_normal(n), lo=1500) * env(n, 0.004) * 0.35
    return np.tanh((body + click) * 1.6 * punch)


def clap():
    n = int(0.35 * SR)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=5000)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += env(n - i, 0.012 if k < 2 else 0.14)
    return noise * e * 0.55


def hat(open_=False):
    n = int((0.3 if open_ else 0.06) * SR)
    return fft_filter(rng.standard_normal(n), lo=7000) * env(n, 0.09 if open_ else 0.018) * 0.28


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune) if detune else (0,):
        ph = (t * freq * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / (3 if detune else 1)


def place(buf, clip, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i] * gain


def write(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    pcm = (np.stack([x, x], axis=1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", os.path.relpath(path))


def music(bpm, beats, drop):
    beat = 60 / bpm
    total = beats * beat + 2.5
    n = int(total * SR)
    drums = np.zeros(n)
    bass = np.zeros(n)
    pad = np.zeros(n)
    duck = np.ones(n)
    in_drop = lambda b: drop and drop[0] <= b < drop[1]

    # A minor: Am  F  C  G, one chord a bar
    roots = [55.0, 43.65, 65.41, 49.0]
    chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 261.63, 329.63], [196.0, 246.94, 293.66]]

    for b in range(beats):
        t0 = b * beat
        bar = b // 4
        if not in_drop(b):
            place(drums, kick(), t0)
            d = int(t0 * SR)
            k = min(n - d, int(beat * SR))
            duck[d : d + k] = np.minimum(duck[d : d + k], 1 - 0.8 * env(k, 0.09))
            if b % 4 in (1, 3):
                place(drums, clap(), t0)
            place(drums, hat(open_=(b % 4 == 3)), t0 + beat / 2)
            place(drums, hat(), t0 + beat * 0.25, 0.5)
            place(drums, hat(), t0 + beat * 0.75, 0.5)
            # offbeat bass stabs
            root = roots[bar % 4]
            for off, mul in ((0.5, 1), (0.75, 2)):
                m = int(beat * 0.22 * SR)
                note = fft_filter(saw(root * mul * 2, m, 0.004), hi=900) * env(m, 0.08)
                place(bass, note, t0 + beat * off, 0.8)
        # the pad runs everywhere, and swells in the drop
        m = int(beat * SR)
        tone = sum(saw(f, m, 0.006) for f in chords[bar % 4])
        tone = fft_filter(tone, hi=1400 if in_drop(b) else 700)
        place(pad, tone, t0, 0.22 if in_drop(b) else 0.08)

    if drop:
        # a noise riser into the drop
        a = drop[0] * beat
        m = int(2 * beat * SR)
        r = rng.standard_normal(m)
        chunks = np.array_split(r, 32)
        r = np.concatenate([fft_filter(c, lo=300 + 6000 * (i / 32) ** 2) for i, c in enumerate(chunks)])
        r *= np.linspace(0, 1, m) ** 2.5
        place(drums, r, a - 2 * beat, 0.5)
    # impacts are placed by the reel (on a cut's shake or hit), not here

    mix = drums * 1.0 + bass * duck * 0.9 + pad * (0.6 + 0.4 * duck)
    mix = np.tanh(mix * 1.2)
    fade = int(2.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    return mix


def impact():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    freq = 30 + 70 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(n, 0.5)
    crack = fft_filter(rng.standard_normal(n), lo=200, hi=6000) * env(n, 0.06) * 0.6
    return np.tanh((boom + crack) * 1.4)


def click_sfx():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    tick = np.sin(2 * np.pi * 2400 * t) * env(n, 0.004)
    thock = np.sin(2 * np.pi * 180 * t) * env(n, 0.012) * 0.8
    return tick * 0.6 + thock


def whoosh():
    n = int(0.45 * SR)
    r = rng.standard_normal(n)
    chunks = np.array_split(r, 24)
    r = np.concatenate([fft_filter(c, lo=400 + 3000 * np.sin(np.pi * i / 24), hi=6000) for i, c in enumerate(chunks)])
    return r * np.sin(np.pi * np.linspace(0, 1, n)) ** 2


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--bpm", type=float, default=120)
    p.add_argument("--beats", type=int, default=48)
    p.add_argument("--drop", type=str, default=None, help="a:b — beats with no drums")
    a = p.parse_args()
    drop = tuple(int(v) for v in a.drop.split(":")) if a.drop else None
    write(os.path.join(public, "music", f"beat-{int(a.bpm)}.wav"), music(a.bpm, a.beats, drop))
    write(os.path.join(public, "sfx", "click.wav"), click_sfx())
    write(os.path.join(public, "sfx", "impact.wav"), impact())
    write(os.path.join(public, "sfx", "whoosh.wav"), whoosh())
