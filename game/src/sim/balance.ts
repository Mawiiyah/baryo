import { BALANCE, type UnitKind, type UnitStats } from '../config';

/** Lakas ng isang unit: HP × (damage/s + heal/s), may dagdag para sa ranged at boss. */
export function basePower(s: UnitStats): number {
  const perSec = 1000 / s.cooldownMs;
  let p = s.hp * (s.damage * perSec + s.heal * perSec);
  if (s.ranged) p *= BALANCE.rangedFactor;
  if (s.boss) p *= BALANCE.bossFactor;
  return p;
}

/**
 * Stats na tugma sa coins na binayad para sa isang unit.
 * @returns k = multiplier ng lakas (HP at damage ay × √k para lakas ≈ × k)
 */
export function statsForCoins(kind: UnitKind, base: UnitStats, coins: number | undefined): { stats: UnitStats; k: number } {
  if (!coins || coins <= 0) return { stats: base, k: 1 };
  const target = BALANCE.refPower * (coins / BALANCE.refCoins) ** BALANCE.coinExponent;
  const raw = target / basePower(base) / (BALANCE.valueFactor[kind] ?? 1);
  const k = Math.min(BALANCE.maxMultiplier, Math.max(BALANCE.minMultiplier, raw));
  const f = Math.sqrt(k);
  const size = base.size * Math.min(BALANCE.maxSizeScale, Math.max(1, k ** BALANCE.sizeExp));
  return {
    stats: { ...base, hp: base.hp * f, damage: Math.round(base.damage * f), heal: Math.round(base.heal * f), size },
    k,
  };
}
