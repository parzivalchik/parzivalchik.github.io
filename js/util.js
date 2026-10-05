// Shared helpers
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = id => document.getElementById(id);
const cache = {};
export const css = n => cache[n] || (cache[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim());
export const MONO = css('--mono');
