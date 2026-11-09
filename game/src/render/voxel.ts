import * as THREE from 'three';

// Voxel builder: naglalagay ng mga cube sa grid, tapos ginagawang iisang mesh
// (nakikitang mukha lang, may vertex colors). Ang voxel (x,y,z) ay nasa
// [x-½,x+½] × [y,y+1] × [z-½,z+½] — kaya simetriko sa x=0 at nasa lupa ang y=0.

interface Cell {
  c: number;
  glow: boolean;
}

type P3 = readonly [number, number, number];

const FACES: { n: P3; v: P3[] }[] = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

const geoCache = new Map<string, THREE.BufferGeometry>();

export class Vox {
  private cells = new Map<string, Cell>();

  set(x: number, y: number, z: number, c: number, glow = false) {
    this.cells.set(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`, { c, glow });
    return this;
  }

  /** Puno na kahon (inclusive, kahit anong pagkakasunod). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, glow = false) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, c, glow);
    return this;
  }

  /** Kahon sa magkabilang gilid (x at -x). */
  boxSym(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, glow = false) {
    this.box(x0, y0, z0, x1, y1, z1, c, glow);
    return this.box(-x0, y0, z0, -x1, y1, z1, c, glow);
  }

  /** Ellipsoid; `color` ay puwedeng function para sa pattern (null = walang voxel). */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, color: number | ((x: number, y: number, z: number) => number | null)) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 > 1) continue;
          const c = typeof color === 'number' ? color : color(x, y, z);
          if (c !== null) this.set(x, y, z, c);
        }
    return this;
  }

  /** Kurbadang linya ng voxels (para sa laso, crest, buntot). */
  line(points: readonly P3[], c: number, thick = 0, glow = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const n = Math.ceil(curve.getLength() * 3) + 2;
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n);
      for (let d = -thick; d <= thick; d++) this.set(p.x + d, p.y, p.z, c, glow);
    }
    return this;
  }

  has(x: number, y: number, z: number) {
    return this.cells.has(`${x},${y},${z}`);
  }

  /**
   * Gumagawa ng mga mesh: isa para sa karaniwang voxels at isa kada kulay ng
   * kumikinang na voxels. Naka-cache ang geometry kada `key` (huwag i-dispose).
   */
  build(key: string, unit: number) {
    const groups = new Map<string, { glow: number | null; cells: [number, number, number, number][] }>();
    for (const [k, cell] of this.cells) {
      const [x, y, z] = k.split(',').map(Number) as [number, number, number];
      const gk = cell.glow ? `g${cell.c}` : 's';
      if (!groups.has(gk)) groups.set(gk, { glow: cell.glow ? cell.c : null, cells: [] });
      groups.get(gk)!.cells.push([x, y, z, cell.c]);
    }
    const out: { geometry: THREE.BufferGeometry; glow: number | null }[] = [];
    for (const [gk, g] of groups) {
      const cacheKey = `${key}:${gk}`;
      let geometry = geoCache.get(cacheKey);
      if (!geometry) {
        geometry = this.toGeometry(g.cells, unit);
        geometry.userData.shared = true;
        geoCache.set(cacheKey, geometry);
      }
      out.push({ geometry, glow: g.glow });
    }
    return out;
  }

  private toGeometry(cells: [number, number, number, number][], unit: number) {
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const color = new THREE.Color();
    for (const [x, y, z, c] of cells) {
      color.setHex(c, THREE.SRGBColorSpace);
      for (const f of FACES) {
        if (this.has(x + f.n[0], y + f.n[1], z + f.n[2])) continue; // nakatago
        const quad = f.v.map(([vx, vy, vz]) => [(x - 0.5 + vx) * unit, (y + vy) * unit, (z - 0.5 + vz) * unit]);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          pos.push(...quad[i]!);
          nor.push(...f.n);
          col.push(color.r, color.g, color.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
