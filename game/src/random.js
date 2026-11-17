// EMBERFALL - deterministic seeded PRNG (mulberry32 style).
// Same seed always produces the same sequence, which keeps runs
// reproducible and lets tests drive the world headlessly.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    return min + next() * (max - min);
  }

  function int(min, maxExclusive) {
    return min + Math.floor(next() * (maxExclusive - min));
  }

  function angle() {
    return next() * Math.PI * 2;
  }

  function pick(array) {
    if (!array || array.length === 0) return undefined;
    return array[Math.floor(next() * array.length)];
  }

  return { next, range, int, angle, pick };
}
