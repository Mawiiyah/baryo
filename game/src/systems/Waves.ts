import Phaser from 'phaser';
import { WAVES, type AttackerKind } from '../config';

type Weighted = Exclude<AttackerKind, 'kapre'>;

/** Bumubuo ng listahan ng halimaw para sa isang wave. */
export function composeWave(wave: number): AttackerKind[] {
  const count = WAVES.baseCount + (wave - 1) * WAVES.growthPerWave;
  const pool = (Object.keys(WAVES.weights) as Weighted[]).filter(
    (k) =>
      (k !== 'manananggal' || wave >= WAVES.manananggalFromWave) &&
      (k !== 'tikbalang' || wave >= WAVES.tikbalangFromWave),
  );
  const total = pool.reduce((s, k) => s + WAVES.weights[k], 0);
  const list: AttackerKind[] = [];
  for (let i = 0; i < count; i++) {
    let r = Phaser.Math.FloatBetween(0, total);
    const pick = pool.find((k) => (r -= WAVES.weights[k]) <= 0) ?? 'aswang';
    list.push(pick);
  }
  if (wave % WAVES.bossEvery === 0) list.push('kapre');
  return list;
}

export const hpScaleFor = (wave: number) => 1 + (wave - 1) * WAVES.hpScalePerWave;
