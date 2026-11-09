/** Maliliit na random helpers (para walang dependency sa engine). */
export const randFloat = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(randFloat(min, max + 1));
