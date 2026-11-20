// A small seeded random number generator (splitmix32): the same seed always gives
// the same stream, which is what makes the city layout, the traffic and the staged
// screenshot scenes repeatable. The returned object wraps the raw stream with the
// range, integer, pick and chance helpers the rest of the game keeps reaching for.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;

  function next() {
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  }

  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of a non-empty array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability p (0..1). */
    chance(p) {
      return next() < p;
    },
  };
}
