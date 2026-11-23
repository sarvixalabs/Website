/* ==========================================================================
   Sarvixa Labs: hero 3D scene (Three.js)
   --------------------------------------------------------------------------
   One cloud of particles keeps reshaping itself to tell the story of
   clinical AI. Every cycle picks a random scene from each of four groups:

     1. Clinical data              brain MRI, chest X-ray, heart, lungs and
                                   airways, retina, EEG, ECG, a person wearing
                                   an EEG cap, EMG on a forearm, health
                                   records, DNA
     2. Learned representations    embedding clusters, latent manifold,
                                   contrastive embeddings, feature maps,
                                   attention map
     3. Models                     neural network, CNN, U-Net, graph neural
                                   network, transformer
     4. Explainable, trustworthy   decision paths, saliency map, uncertainty,
        AI                         feature attribution, calibration, shield

   To add a scene, add an entry to SCENES with a category (0 to 3), a name and
   a build() function that returns point(rand, out). See existing entries.
   MORPH_TIME and HOLD_TIME below control the speed.
   This is generated artwork. No real scans or patient data are used.
   ========================================================================== */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const hero = document.querySelector('.hero');
const canvas = hero && hero.querySelector('.hero__canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MORPH_TIME = 2.8;   // seconds to change shape
const HOLD_TIME = 3.4;    // seconds each scene stays

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}
function fallback() { if (hero) hero.classList.add('is-fallback'); }

/* ==========================================================================
   Small math helpers
   ========================================================================== */
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rand) => (rand() + rand() + rand() + rand() - 2) / 0.58;
function sphereDir(rand) {
  const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
}
function jitter(rand, r) {
  const d = sphereDir(rand), k = r * Math.cbrt(rand());
  return [d[0] * k, d[1] * k, d[2] * k];
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotateAxis(v, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2], x = cross(k, v);
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
}
const bez = (p0, p1, p2, p3) => (t) => {
  const u = 1 - t;
  return [0, 1, 2].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
function set(o, x, y, z, tint, hi = 0) { o[0] = x; o[1] = y; o[2] = z; o[3] = tint; o[4] = hi; }

/* Pick one of several parts by weight. list = [[weight, fn(rand, o)], ...] */
function weighted(list) {
  const total = list.reduce((a, b) => a + b[0], 0);
  return (rand, o) => {
    let x = rand() * total;
    for (const [w, f] of list) { x -= w; if (x <= 0) return f(rand, o); }
    return list[list.length - 1][1](rand, o);
  };
}

/* Segments are [x0, y0, z0, x1, y1, z1, radius]. Sample a point on them by length. */
function segSampler(segs) {
  const cum = [];
  let total = 0;
  segs.forEach((s) => { total += Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]) + 1e-6; cum.push(total); });
  return (rand, out) => {
    const x = rand() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    const s = segs[lo], t = rand(), j = jitter(rand, s[6] || 0.01);
    out[0] = s[0] + (s[3] - s[0]) * t + j[0];
    out[1] = s[1] + (s[4] - s[1]) * t + j[1];
    out[2] = s[2] + (s[5] - s[2]) * t + j[2];
    return lo;
  };
}
function curveSegs(f, n, r) {
  const segs = [];
  let p = f(0);
  for (let i = 1; i <= n; i++) { const q = f(i / n); segs.push([...p, ...q, r]); p = q; }
  return segs;
}
function toLines(segs) {
  const a = new Float32Array(segs.length * 6);
  segs.forEach((s, i) => a.set([s[0], s[1], s[2], s[3], s[4], s[5]], i * 6));
  return a;
}
function boxEdges(cx, cy, cz, sx, sy, sz) {
  const c = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) c.push([cx + x * sx, cy + y * sy, cz + z * sz]);
  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  return pairs.map(([a, b]) => [...c[a], ...c[b], 0.004]);
}
function boxSurface(rand, out, cx, cy, cz, sx, sy, sz) {
  const ax = sy * sz, ay = sx * sz, az = sx * sy, r = rand() * (ax + ay + az);
  let x = (rand() * 2 - 1) * sx, y = (rand() * 2 - 1) * sy, z = (rand() * 2 - 1) * sz;
  const side = rand() < 0.5 ? -1 : 1;
  if (r < ax) x = side * sx; else if (r < ax + ay) y = side * sy; else z = side * sz;
  out[0] = cx + x; out[1] = cy + y; out[2] = cz + z;
}
function boxVolume(rand, out, cx, cy, cz, sx, sy, sz) {
  out[0] = cx + (rand() * 2 - 1) * sx; out[1] = cy + (rand() * 2 - 1) * sy; out[2] = cz + (rand() * 2 - 1) * sz;
}
/* Recursive branching tree, used for airways and retinal vessels */
function branchTree(rand, segs, p, d, len, r, depth, spread, flat) {
  const q = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len];
  segs.push([...p, ...q, r]);
  if (depth === 0) return;
  for (const s of [-1, 1]) {
    let axis = flat ? [0, 0, 1] : norm(cross(d, sphereDir(rand)));
    let nd = rotateAxis(d, axis, s * (spread + rand() * spread * 0.6));
    if (flat) nd[2] = 0;
    branchTree(rand, segs, q, norm(nd), len * (0.72 + rand() * 0.12), r * 0.75, depth - 1, spread, flat);
  }
}
const tintXY = (x, y) => clamp01(x * 0.45 + 0.5 + y * 0.25);

/* ==========================================================================
   SCENES
   Each build() returns { point(rand, out), lines?, hiLines? }.
   point() fills out = [x, y, z, tint 0..1, highlight -1..1].
   Negative highlight dims a particle, positive makes it glow.
   Keep shapes inside about -1.1 to 1.1 on every axis.
   ========================================================================== */

/* ---------- 1. Clinical data ---------- */

function brainPoint(rand, out) {
  const pick = rand();
  const [dx, dy, dz] = sphereDir(rand);
  if (pick < 0.86) {
    const h = rand() < 0.5 ? -1 : 1;
    const shell = rand() < 0.74;
    let r = shell ? 0.92 + rand() * 0.08 : Math.cbrt(rand()) * 0.9;
    if (shell) r *= 1 + 0.05 * Math.sin(dx * 9 + dy * 13) * Math.cos(dz * 11 - dy * 7) + 0.03 * Math.sin(dz * 23 + dx * 17 + dy * 5);
    let x = h * 0.34 + dx * 0.42 * r;
    let y = dy * 0.6 * r;
    const z = dz * 0.86 * r;
    if (h * x < 0.035) x = h * (0.035 + Math.abs(h * x - 0.035) * 0.04);
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.45;
    x *= 1 - 0.14 * Math.max(0, z);
    y += 0.06 * Math.cos(z * 1.6);
    out[0] = x; out[1] = y; out[2] = z;
  } else if (pick < 0.97) {
    const h = rand() < 0.5 ? -1 : 1, r = 0.85 + rand() * 0.15;
    out[0] = h * 0.16 + dx * 0.24 * r;
    out[1] = -0.36 + dy * 0.15 * r * (1 + 0.06 * Math.sin(dy * 40));
    out[2] = -0.56 + dz * 0.2 * r;
  } else {
    const t = rand(), a = rand() * TAU, rr = 0.07 * (1 - t * 0.3) * Math.sqrt(rand());
    out[0] = Math.cos(a) * rr; out[1] = -0.3 - t * 0.5; out[2] = -0.24 - t * 0.1 + Math.sin(a) * rr;
  }
}

const brainScene = {
  cat: 0, name: 'Brain MRI',
  build: () => ({ point(rand, o) { brainPoint(rand, o); o[3] = tintXY(o[0], o[1]); o[4] = 0; } }),
};

const chestScene = {
  cat: 0, name: 'Chest X-ray',
  build() {
    const segs = [];
    for (let k = 0; k < 10; k++) {
      const y0 = 0.66 - k * 0.13;
      const a = 0.34 + 0.27 * Math.sin((Math.PI * (k + 1.5)) / 11.5);
      const c = 0.38 + 0.08 * Math.sin((Math.PI * (k + 1)) / 11);
      const pm = Math.PI * (0.9 - k * 0.028);
      for (const s of [-1, 1]) {
        segs.push(...curveSegs((t) => {
          const ph = t * pm;
          return [s * (0.06 + a * Math.sin(ph)), y0 - 0.09 * (1 - Math.cos(ph)) - 0.08 * t, -0.3 + c * (1 - Math.cos(ph))];
        }, 18, 0.017));
      }
    }
    segs.push(...curveSegs((t) => [0, 0.66 - 0.52 * t, 0.46 - 0.04 * t], 6, 0.028));             // sternum
    for (const s of [-1, 1]) segs.push(...curveSegs((t) => [s * (0.04 + 0.5 * t), 0.74 + 0.06 * t - 0.06 * Math.sin(Math.PI * t), 0.44 - 0.42 * t], 10, 0.02)); // clavicles
    const bones = segSampler(segs);
    return {
      point: weighted([
        [82, (rand, o) => { bones(rand, o); o[3] = clamp01(0.5 - o[1] * 0.4); o[4] = 0; }],
        [18, (rand, o) => { // vertebrae
          const i = Math.floor(rand() * 19), j = jitter(rand, 0.055);
          set(o, j[0] * 1.2, 0.86 - i * 0.095 + j[1] * 0.6, -0.36 + j[2], 0.3, 0.1);
        }],
      ]),
    };
  },
};

function heartF(x, y, z) {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
}
const heartScene = {
  cat: 0, name: 'Cardiac imaging',
  build() {
    const vessels = [
      ...curveSegs(bez([0.08, 0.42, 0.05], [0.1, 0.98, 0.05], [-0.32, 0.98, -0.1], [-0.3, 0.25, -0.22]), 22, 0.06),  // aorta
      ...curveSegs(bez([-0.06, 0.4, 0.16], [-0.1, 0.76, 0.22], [0.26, 0.76, 0.1], [0.38, 0.6, 0]), 14, 0.045),      // pulmonary trunk
      ...curveSegs((t) => [0.3 + 0.02 * t, 0.45 + 0.5 * t, -0.05], 8, 0.04),                                          // vena cava
      ...curveSegs((t) => [0.02, 0.86 + 0.2 * t, 0.0], 4, 0.024),
      ...curveSegs((t) => [-0.1, 0.88 + 0.18 * t, -0.03], 4, 0.022),
      ...curveSegs((t) => [-0.2, 0.86 + 0.16 * t, -0.06], 4, 0.02),
    ];
    const vs = segSampler(vessels);
    const ca = Math.cos(-0.35), sa = Math.sin(-0.35);
    return {
      point: weighted([
        [80, (rand, o) => {
          const shell = rand() < 0.85;
          let x, y, z;
          for (let k = 0; k < 4000; k++) {
            x = rand() * 2.6 - 1.3; y = rand() * 1.6 - 0.8; z = rand() * 2.6 - 1.2;
            if (heartF(x, y, z) <= 0 && (!shell || heartF(x * 1.07, y * 1.07, z * 1.07) > 0)) break;
          }
          const X = x * 0.46, Y = z * 0.46 + 0.02, Z = y * 0.46;
          set(o, X * ca - Y * sa, X * sa + Y * ca, Z, tintXY(X, Y), shell ? 0 : -0.3);
        }],
        [20, (rand, o) => { vs(rand, o); o[3] = 0.15; o[4] = 0.35; }],
      ]),
    };
  },
};

const lungScene = {
  cat: 0, name: 'Lung CT and airways',
  build(rand) {
    const tree = [[0, 1.0, 0, 0, 0.45, 0, 0.045]];
    for (const s of [-1, 1]) branchTree(rand, tree, [0, 0.45, 0], norm([s * 0.75, -0.65, 0]), 0.3, 0.035, 6, 0.5, false);
    const ts = segSampler(tree);
    return {
      point: weighted([
        [52, (rand, o) => { ts(rand, o); o[3] = clamp01(0.4 - o[1] * 0.3); o[4] = 0.25; }],
        [48, (rand, o) => {
          const h = rand() < 0.5 ? -1 : 1;
          const [dx, dy, dz] = sphereDir(rand);
          let x = h * 0.42 + dx * 0.38, y = -0.12 + dy * 0.66, z = dz * 0.36;
          if (h * x < 0.12) x = h * (0.12 + (0.12 - h * x) * 0.1);
          if (y < -0.62) y = -0.62 + (y + 0.62) * 0.3;
          set(o, x, y, z, tintXY(x, y), -0.35);
        }],
      ]),
    };
  },
};

const retinaScene = {
  cat: 0, name: 'Retinal imaging',
  build(rand) {
    const disc = [0.36, 0.04];
    const vessels = [];
    for (const [ang, len] of [[2.5, 0.32], [3.8, 0.32], [1.9, 0.22], [4.4, 0.22], [0.3, 0.16], [-0.4, 0.16]]) {
      branchTree(rand, vessels, [disc[0], disc[1], 0], [Math.cos(ang), Math.sin(ang), 0], len, 0.016, 5, 0.38, true);
    }
    const vs = segSampler(vessels.filter((s) => Math.hypot(s[3], s[4]) < 0.9));
    const dome = (x, y) => 0.22 * (1 - (x * x + y * y) / 0.81) - 0.1;
    return {
      point: weighted([
        [44, (rand, o) => { vs(rand, o); o[2] = dome(o[0], o[1]) + o[2] * 0.3; o[3] = 0.85; o[4] = 0.2; }],
        [34, (rand, o) => {
          let x, y;
          do { const a = rand() * TAU, r = 0.9 * Math.sqrt(rand()); x = Math.cos(a) * r; y = Math.sin(a) * r; } while (Math.hypot(x + 0.22, y) < 0.13 && rand() < 0.85);
          set(o, x, y, dome(x, y), tintXY(x, y) * 0.6, -0.4);
        }],
        [10, (rand, o) => { const a = rand() * TAU; const x = Math.cos(a) * 0.9, y = Math.sin(a) * 0.9; set(o, x, y, dome(x, y), 0.5, 0); }],
        [12, (rand, o) => { const a = rand() * TAU, r = 0.1 * Math.sqrt(rand()); const x = disc[0] + Math.cos(a) * r, y = disc[1] + Math.sin(a) * r; set(o, x, y, dome(x, y) + 0.01, 0.05, 0.7); }],
      ]),
    };
  },
};

const eegScene = {
  cat: 0, name: 'EEG signals',
  build(rand) {
    const ch = 10;
    const ph = Array.from({ length: ch }, () => [rand() * TAU, rand() * TAU, rand() * TAU, 0.8 + rand() * 0.5]);
    const evStart = -0.4 + rand() * 0.7;
    const evCh = new Set([2 + Math.floor(rand() * 3), 5 + Math.floor(rand() * 3), 8]);
    return {
      point(rand, o) {
        const c = Math.floor(rand() * ch), x = rand() * 2.3 - 1.15, p = ph[c];
        let s = Math.sin(x * 26 * p[3] + p[0]) + 0.6 * Math.sin(x * 57 + p[1]) + 0.35 * Math.sin(x * 121 + p[2]);
        const inEv = evCh.has(c) && x > evStart && x < evStart + 0.32;
        if (inEv) s += 2.6 * Math.sin(x * 95) * Math.sin(((x - evStart) / 0.32) * Math.PI);
        const y = -0.74 + c * 0.165 + s * 0.042 + gauss(rand) * 0.003;
        set(o, x, y, -0.18 * Math.cos(x * 1.3) + (c - 4.5) * 0.025, c / (ch - 1), inEv ? 1 : 0);
      },
    };
  },
};

function pqrst(u) {
  const g = (v, w) => Math.exp(-(v * v) / (2 * w * w));
  return 0.12 * g(u - 0.2, 0.025) - 0.12 * g(u - 0.355, 0.008) + 1.0 * g(u - 0.38, 0.009) - 0.26 * g(u - 0.405, 0.01) + 0.3 * g(u - 0.6, 0.04);
}
const ecgScene = {
  cat: 0, name: 'ECG signals',
  build(rand) {
    const leads = [[0.42, 0.3, rand()], [-0.02, 0.22, rand()], [-0.46, 0.16, rand()]];
    return {
      point: weighted([
        [74, (rand, o) => {
          const L = leads[Math.floor(rand() * 3)], x = rand() * 2.3 - 1.15;
          const u = (((x + 1.15) / 0.58 + L[2]) % 1 + 1) % 1;
          const v = pqrst(u);
          set(o, x, L[0] + v * L[1] + gauss(rand) * 0.003, -0.08 * x * x, 0.2 + L[0] * 0.5, v > 0.5 ? 0.6 : 0);
        }],
        [26, (rand, o) => { // ECG paper grid
          const t = rand() * 2.4 - 1.2;
          if (rand() < 0.5) { const k = Math.round((rand() * 1.5 - 0.75) / 0.125) * 0.125; set(o, t, k, -0.08 * t * t - 0.05, 0.7, -0.75); } else { const k = Math.round(t / 0.125) * 0.125; const y = rand() * 1.5 - 0.75; set(o, k, y, -0.08 * k * k - 0.05, 0.7, -0.75); }
        }],
      ]),
    };
  },
};

const wearableScene = {
  cat: 0, name: 'Wearable EEG',
  build() {
    const C = [0, 0.4, 0], R = [0.3, 0.38, 0.34];
    const electrodes = [];
    const onHead = (th, phi) => [C[0] + Math.sin(th) * Math.cos(phi) * R[0] * 1.03, C[1] + Math.cos(th) * R[1] * 1.03, C[2] + Math.sin(th) * Math.sin(phi) * R[2] * 1.03];
    electrodes.push(onHead(0, 0));
    for (let i = 0; i < 8; i++) electrodes.push(onHead(0.6, (i / 8) * TAU));
    for (let i = 0; i < 12; i++) electrodes.push(onHead(1.12, (i / 12) * TAU + 0.26));
    const lines = [];
    electrodes.forEach((a, i) => {
      electrodes.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])]).filter(([j]) => j > i)
        .sort((p, q) => p[1] - q[1]).slice(0, 3).forEach(([j]) => lines.push([...a, ...electrodes[j], 0]));
    });
    return {
      lines: toLines(lines),
      point: weighted([
        [32, (rand, o) => { const [dx, dy, dz] = sphereDir(rand); set(o, C[0] + dx * R[0], C[1] + dy * R[1], C[2] + dz * R[2], 0.35, 0); }],
        [4, (rand, o) => { const j = jitter(rand, 0.05); const s = rand() < 0.5 ? -1 : 1; set(o, s * 0.3 + j[0] * 0.4, 0.36 + j[1], j[2] * 0.7, 0.4, 0); }],
        [2, (rand, o) => { const j = jitter(rand, 0.045); set(o, j[0], 0.33 + j[1], 0.36 + j[2], 0.4, 0); }],
        [6, (rand, o) => { const a = rand() * TAU, y = -0.1 + rand() * 0.16; set(o, Math.cos(a) * 0.12, y, Math.sin(a) * 0.12, 0.5, -0.2); }],
        [38, (rand, o) => {
          let x, y, z;
          do { const [dx, dy, dz] = sphereDir(rand); x = dx * 0.66; y = -0.62 + dy * 0.52; z = dz * 0.28; } while (y > -0.12 || y < -1.0);
          set(o, x, y, z, 0.6 + x * 0.3, -0.25);
        }],
        [18, (rand, o) => { const e = electrodes[Math.floor(rand() * electrodes.length)], j = jitter(rand, 0.028); set(o, e[0] + j[0], e[1] + j[1], e[2] + j[2], 0.05, 1); }],
      ]),
    };
  },
};

const emgScene = {
  cat: 0, name: 'EMG and wearables',
  build(rand) {
    const radius = (x) => 0.17 - (0.06 * (x + 1)) / 1.35 + 0.03 * Math.exp(-(((x + 0.65) / 0.25) ** 2));
    const fingers = [-0.11, -0.04, 0.04, 0.11].map((z, i) => [0.74, 0, z, 1.0 + (i === 1 || i === 2 ? 0.05 : 0), -0.02, z * 1.1, 0.028]);
    fingers.push([0.5, 0, 0.15, 0.7, 0, 0.3, 0.03]);
    const fs = segSampler(fingers);
    const ph = [rand() * TAU, rand() * TAU];
    return {
      point: weighted([
        [38, (rand, o) => { const x = -1.0 + rand() * 1.35, a = rand() * TAU, r = radius(x); set(o, x, r * Math.cos(a), r * Math.sin(a), 0.45, -0.1); }],
        [14, (rand, o) => { const [dx, dy, dz] = sphereDir(rand); set(o, 0.56 + dx * 0.2, dy * 0.06, dz * 0.16, 0.5, -0.1); }],
        [9, (rand, o) => { fs(rand, o); o[3] = 0.55; o[4] = -0.1; }],
        [14, (rand, o) => { const x = rand() < 0.5 ? -0.55 : -0.15, a = rand() * TAU, r = radius(x) + 0.025; set(o, x + (rand() - 0.5) * 0.06, r * Math.cos(a), r * Math.sin(a), 0.05, 1); }],
        [25, (rand, o) => {
          const x = -1.0 + rand() * 1.4;
          const env = Math.exp(-(((x + 0.4) / 0.22) ** 2)) + 0.7 * Math.exp(-(((x - 0.15) / 0.12) ** 2));
          const n = Math.sin(x * 140 + ph[0]) * 0.6 + Math.sin(x * 233 + ph[1]) * 0.4;
          set(o, x, 0.48 + n * (0.015 + 0.13 * env), 0, 0.15, env > 0.45 ? 0.7 : 0);
        }],
      ]),
    };
  },
};

const ehrScene = {
  cat: 0, name: 'Electronic health records',
  build(rand) {
    const cards = [[-0.16, 0.14, -0.32], [-0.04, 0.04, 0], [0.08, -0.06, 0.32]];
    const W = 0.65, H = 0.45;
    const rows = cards.map(() => {
      const segs = [];
      for (let r = 0; r < 7; r++) {
        let x = -W + 0.1;
        const y = H - 0.22 - r * 0.085;
        while (x < W - 0.15) {
          const len = 0.06 + rand() * 0.24;
          if (x + len > W - 0.1) break;
          segs.push([x, y, len]);
          x += len + 0.045;
          if (r === 0 && segs.length > 2) break;
        }
      }
      return segs;
    });
    const spark = Array.from({ length: 8 }, () => rand());
    const events = Array.from({ length: 9 }, () => -0.95 + rand() * 1.9);
    const lines = [];
    cards.forEach(([cx, cy, cz]) => {
      lines.push([cx - W, cy - H, cz, cx + W, cy - H, cz], [cx + W, cy - H, cz, cx + W, cy + H, cz], [cx + W, cy + H, cz, cx - W, cy + H, cz], [cx - W, cy + H, cz, cx - W, cy - H, cz]);
    });
    lines.push([-1, -0.78, 0.32, 1, -0.78, 0.32]);
    return {
      lines: toLines(lines.map((l) => [...l, 0])),
      point: weighted([
        [66, (rand, o) => {
          const ci = Math.floor(rand() * 3), [cx, cy, cz] = cards[ci], dim = ci === 2 ? 0 : -0.45;
          const part = rand();
          if (part < 0.22) { // outline
            const t = rand() * 2 - 1;
            if (rand() < 0.5) set(o, cx + t * W, cy + (rand() < 0.5 ? -H : H), cz, 0.6, dim); else set(o, cx + (rand() < 0.5 ? -W : W), cy + t * H, cz, 0.6, dim);
          } else if (part < 0.32) { // header
            set(o, cx - W + rand() * 2 * W, cy + H - 0.06 - rand() * 0.05, cz, 0.0, dim + 0.2);
          } else if (part < 0.82 || ci !== 2) { // text lines
            const s = rows[ci][Math.floor(rand() * rows[ci].length)];
            set(o, cx + s[0] + rand() * s[2], cy + s[1] + gauss(rand) * 0.006, cz, 0.75, dim);
          } else { // small vitals chart on the front card
            const u = rand(), k = Math.min(6, Math.floor(u * 7)), f = u * 7 - k;
            const v = spark[k] * (1 - f) + spark[k + 1] * f;
            set(o, cx + 0.05 + u * 0.5, cy - H + 0.08 + v * 0.16, cz, 0.1, 0.8);
          }
        }],
        [10, (rand, o) => set(o, -1 + rand() * 2, -0.78, 0.32, 0.6, -0.3)],
        [24, (rand, o) => { const e = events[Math.floor(rand() * events.length)], j = jitter(rand, 0.035); set(o, e + j[0], -0.78 + j[1], 0.32 + j[2], 0.1, 1); }],
      ]),
    };
  },
};

const dnaScene = {
  cat: 0, name: 'Genomics and omics',
  build() {
    const tilt = 0.5, ct = Math.cos(tilt), st = Math.sin(tilt);
    const place = (o, x, y, z, tint, hi) => set(o, x * ct - y * st, x * st + y * ct, z, tint, hi);
    return {
      point: weighted([
        [55, (rand, o) => {
          const y = rand() * 2.2 - 1.1, a = y * 5.2 + (rand() < 0.5 ? 0 : Math.PI), j = jitter(rand, 0.025);
          place(o, Math.cos(a) * 0.26 + j[0], y + j[1], Math.sin(a) * 0.26 + j[2], 0.5 + Math.cos(a) * 0.3, 0.2);
        }],
        [45, (rand, o) => {
          const k = Math.floor(rand() * 24), y = -1.1 + (k + 0.5) * (2.2 / 24), a = y * 5.2, t = rand() * 2 - 1;
          place(o, Math.cos(a) * 0.26 * t, y + gauss(rand) * 0.006, Math.sin(a) * 0.26 * t, t < 0 ? (k % 2 ? 0.05 : 0.3) : (k % 2 ? 0.95 : 0.7), -0.1);
        }],
      ]),
    };
  },
};

/* ---------- 2. Learned representations ---------- */

const clusterScene = {
  cat: 1, name: 'Embedding clusters',
  build(rand) {
    const cl = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + rand() * 0.5, r = 0.4 + rand() * 0.4;
      return [Math.cos(a) * r * 1.1, (rand() - 0.5) * 0.95, Math.sin(a) * r * 0.85, 0.08 + rand() * 0.08, 0.07 + rand() * 0.07, 0.08 + rand() * 0.07, i / 6];
    });
    return {
      point(rand, o) {
        const c = cl[Math.floor(rand() * cl.length)];
        set(o, c[0] + gauss(rand) * c[3], c[1] + gauss(rand) * c[4], c[2] + gauss(rand) * c[5], c[6], 0);
      },
    };
  },
};

const manifoldScene = {
  cat: 1, name: 'Latent manifold',
  build: () => ({
    point(rand, o) {
      const t = 1.5 * Math.PI + rand() * 3 * Math.PI, h = rand() * 1.3 - 0.65, j = jitter(rand, 0.018);
      set(o, t * Math.cos(t) * 0.075 + j[0], t * Math.sin(t) * 0.075 + j[1], h * 0.8 + j[2], (t - 1.5 * Math.PI) / (3 * Math.PI), 0);
    },
  }),
};

const sphereScene = {
  cat: 1, name: 'Contrastive embeddings',
  build(rand) {
    const caps = Array.from({ length: 9 }, () => sphereDir(rand));
    const lines = [];
    for (let k = 0; k < 6; k++) {
      const axis = sphereDir(rand), u = norm(cross(axis, [0.3, 1, 0.2])), v = cross(axis, u);
      lines.push(...curveSegs((t) => [0, 1, 2].map((i) => (Math.cos(t * TAU) * u[i] + Math.sin(t * TAU) * v[i]) * 0.86), 48, 0));
    }
    return {
      lines: toLines(lines),
      point(rand, o) {
        if (rand() < 0.85) {
          const ci = Math.floor(rand() * caps.length), c = caps[ci];
          const d = norm([c[0] + gauss(rand) * 0.2, c[1] + gauss(rand) * 0.2, c[2] + gauss(rand) * 0.2]);
          set(o, d[0] * 0.85, d[1] * 0.85, d[2] * 0.85, ci / 8, 0);
        } else {
          const d = sphereDir(rand);
          set(o, d[0] * 0.85, d[1] * 0.85, d[2] * 0.85, 0.5, -0.6);
        }
      },
    };
  },
};

const featureMapScene = {
  cat: 1, name: 'Feature maps',
  build(rand) {
    const planes = Array.from({ length: 5 }, (_, i) => ({
      c: [-0.5 + i * 0.24, 0.32 - i * 0.16, -0.45 + i * 0.22],
      k: [3 + rand() * 7, 3 + rand() * 7, rand() * TAU, rand() * TAU],
      tint: i / 4,
    }));
    const S = 0.42, N = 26;
    const f = (p, u, v) => 0.5 + 0.5 * Math.sin(u * p.k[0] + p.k[2]) * Math.cos(v * p.k[1] + p.k[3]);
    const lines = [];
    planes.forEach(({ c }) => lines.push(
      [c[0] - S, c[1] - S, c[2], c[0] + S, c[1] - S, c[2], 0], [c[0] + S, c[1] - S, c[2], c[0] + S, c[1] + S, c[2], 0],
      [c[0] + S, c[1] + S, c[2], c[0] - S, c[1] + S, c[2], 0], [c[0] - S, c[1] + S, c[2], c[0] - S, c[1] - S, c[2], 0],
    ));
    return {
      lines: toLines(lines),
      point(rand, o) {
        const p = planes[Math.floor(rand() * planes.length)];
        let u, v, val;
        for (let k = 0; k < 40; k++) {
          u = (Math.floor(rand() * N) + 0.5) / N * 2 - 1; v = (Math.floor(rand() * N) + 0.5) / N * 2 - 1;
          val = f(p, u, v);
          if (rand() < val * val * 0.95 + 0.04) break;
        }
        set(o, p.c[0] + u * S + gauss(rand) * 0.005, p.c[1] + v * S + gauss(rand) * 0.005, p.c[2], p.tint, val > 0.85 ? 0.5 : val < 0.3 ? -0.4 : 0);
      },
    };
  },
};

const attentionScene = {
  cat: 1, name: 'Attention map',
  build(rand) {
    const N = 22;
    const blocks = [[0, 6], [6, 13], [13, 22]];
    const peaks = Array.from({ length: 6 }, () => [Math.floor(rand() * N), Math.floor(rand() * N)]);
    const A = (i, j) => {
      let v = Math.exp(-Math.abs(i - j) / 1.6) * 0.8;
      for (const [a, b] of blocks) if (i >= a && i < b && j >= a && j < b) v += 0.28;
      for (const [a, b] of peaks) if (Math.abs(i - a) + Math.abs(j - b) < 2) v += 0.5;
      return Math.min(1, v);
    };
    const S = 0.8;
    return {
      point: weighted([
        [86, (rand, o) => {
          let i, j, v;
          for (let k = 0; k < 40; k++) { i = Math.floor(rand() * N); j = Math.floor(rand() * N); v = A(i, j); if (rand() < v * 0.95 + 0.03) break; }
          const x = ((i + rand() * 0.8 + 0.1) / N) * 2 * S - S, y = S - ((j + rand() * 0.8 + 0.1) / N) * 2 * S;
          set(o, x, y, 0.12 * Math.cos(x * 1.4) * Math.cos(y * 1.4), 1 - v, v > 0.75 ? 0.6 : v < 0.2 ? -0.5 : 0);
        }],
        [14, (rand, o) => { // token rows along the top and left
          const k = Math.floor(rand() * N), t = ((k + 0.5) / N) * 2 * S - S, j = jitter(rand, 0.02);
          if (rand() < 0.5) set(o, t + j[0], S + 0.12 + j[1], 0.12 + j[2], k / N, 0.3); else set(o, -S - 0.12 + j[0], -t + j[1], 0.12 + j[2], k / N, 0.3);
        }],
      ]),
    };
  },
};

/* ---------- 3. Models ---------- */

function buildMLP(rand) {
  const layers = [5, 8, 11, 11, 8, 5], width = 1.95;
  const nodes = [], start = [];
  layers.forEach((count, li) => {
    start.push(nodes.length);
    const x = -width / 2 + (li / (layers.length - 1)) * width;
    for (let i = 0; i < count; i++) nodes.push([x, (i - (count - 1) / 2) * 0.15, Math.sin(i * 1.7 + li) * 0.14]);
  });
  const edges = [];
  for (let li = 0; li < layers.length - 1; li++) {
    for (let a = 0; a < layers[li]; a++) for (let b = 0; b < layers[li + 1]; b++) edges.push([start[li] + a, start[li + 1] + b]);
  }
  const key = new Set(), keyNodes = new Set();
  for (let p = 0; p < 3; p++) {
    let prev = start[0] + Math.floor(rand() * layers[0]);
    keyNodes.add(prev);
    for (let li = 1; li < layers.length; li++) {
      let best = start[li], bestD = Infinity;
      for (let i = 0; i < layers[li]; i++) {
        const d = Math.abs(nodes[start[li] + i][1] - nodes[prev][1]) + rand() * 0.3;
        if (d < bestD) { bestD = d; best = start[li] + i; }
      }
      key.add(`${prev}-${best}`); keyNodes.add(best); prev = best;
    }
  }
  const seg = (e) => [...nodes[e[0]], ...nodes[e[1]], 0.004];
  return { nodes, edges, seg, isKey: (e) => key.has(`${e[0]}-${e[1]}`), keyNodes };
}

const mlpScene = {
  cat: 2, name: 'Neural network',
  build(rand) {
    const net = buildMLP(rand);
    const es = segSampler(net.edges.map(net.seg));
    return {
      lines: toLines(net.edges.map(net.seg)), lineOpacity: 0.08,
      point: weighted([
        [30, (rand, o) => { const n = net.nodes[Math.floor(rand() * net.nodes.length)], j = jitter(rand, 0.035); set(o, n[0] + j[0], n[1] + j[1], n[2] + j[2], tintXY(n[0], n[1]), 0.15); }],
        [70, (rand, o) => { es(rand, o); o[3] = tintXY(o[0], o[1]); o[4] = 0; }],
      ]),
    };
  },
};

const cnnScene = {
  cat: 2, name: 'Convolutional network',
  build() {
    const blocks = [[-0.95, 0.05, 0.62, 0.62], [-0.55, 0.1, 0.5, 0.5], [-0.15, 0.15, 0.36, 0.36], [0.2, 0.2, 0.24, 0.24], [0.52, 0.24, 0.14, 0.14]];
    const lines = [];
    blocks.forEach((b) => lines.push(...boxEdges(b[0], 0, 0, b[1] / 2, b[2], b[3])));
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i], b = blocks[i + 1], px = a[0] + a[1] / 2, ph = a[2] * 0.35;
      for (const [sy, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) lines.push([px, 0.15 + sy * ph * 0.4, 0.1 + sz * ph * 0.4, b[0] - b[1] / 2, 0, 0, 0.006]);
    }
    const dense = Array.from({ length: 8 }, (_, i) => [0.92, (i - 3.5) * 0.13, 0]);
    dense.forEach((d) => lines.push([blocks[4][0] + blocks[4][1] / 2, 0, 0, ...d, 0.004]));
    const ls = segSampler(lines.slice(blocks.length * 12));
    return {
      lines: toLines(lines), lineOpacity: 0.22,
      point: weighted([
        [70, (rand, o) => { const i = Math.floor(rand() * blocks.length), b = blocks[i]; boxSurface(rand, o, b[0], 0, 0, b[1] / 2, b[2], b[3]); o[3] = i / 4; o[4] = 0; }],
        [16, (rand, o) => { ls(rand, o); o[3] = 0.5; o[4] = 0.3; }],
        [14, (rand, o) => { const d = dense[Math.floor(rand() * dense.length)], j = jitter(rand, 0.03); set(o, d[0] + j[0], d[1] + j[1], d[2] + j[2], 1, 0.3); }],
      ]),
    };
  },
};

const unetScene = {
  cat: 2, name: 'U-Net',
  build() {
    const blocks = [];
    for (let L = 0; L < 4; L++) {
      const y = 0.66 - L * 0.36, sx = 0.035 + L * 0.02, sy = 0.11 - L * 0.012, sz = 0.36 - L * 0.06;
      blocks.push([-0.95 + L * 0.27, y, sx, sy, sz, L], [0.95 - L * 0.27, y, sx, sy, sz, L]);
    }
    blocks.push([0, -0.74, 0.12, 0.07, 0.14, 4]);
    const lines = [];
    blocks.forEach((b) => lines.push(...boxEdges(b[0], b[1], 0, b[2], b[3], b[4])));
    const skips = [], flow = [];
    for (let L = 0; L < 4; L++) {
      const e = blocks[L * 2], d = blocks[L * 2 + 1];
      skips.push([e[0] + e[2], e[1], 0, d[0] - d[2], d[1], 0, 0.006]);
      const ne = L < 3 ? blocks[(L + 1) * 2] : blocks[8], nd = L < 3 ? blocks[(L + 1) * 2 + 1] : blocks[8];
      flow.push([e[0], e[1] - e[3], 0, ne[0], ne[1] + ne[3], 0, 0.006], [nd[0], nd[1] + nd[3], 0, d[0], d[1] - d[3], 0, 0.006]);
    }
    const sk = segSampler(skips), fl = segSampler(flow);
    return {
      lines: toLines([...lines, ...flow]), hiLines: toLines(skips), lineOpacity: 0.22,
      point: weighted([
        [66, (rand, o) => { const b = blocks[Math.floor(rand() * blocks.length)]; boxSurface(rand, o, b[0], b[1], 0, b[2], b[3], b[4]); o[3] = b[5] / 4; o[4] = 0; }],
        [20, (rand, o) => { sk(rand, o); o[3] = 0.1; o[4] = 0.6; }],
        [14, (rand, o) => { fl(rand, o); o[3] = 0.8; o[4] = 0; }],
      ]),
    };
  },
};

const gnnScene = {
  cat: 2, name: 'Graph neural network',
  build(rand) {
    const nodes = [];
    while (nodes.length < 42) {
      const d = sphereDir(rand), r = 0.35 + rand() * 0.55, p = [d[0] * r * 1.15, d[1] * r * 0.9, d[2] * r];
      if (nodes.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 0.2)) nodes.push(p);
    }
    const edges = [];
    nodes.forEach((a, i) => nodes.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])]).filter(([j]) => j > i)
      .sort((p, q) => p[1] - q[1]).slice(0, 3).forEach(([j]) => edges.push([...a, ...nodes[j], 0.006])));
    const hubs = new Set([0, 1, 2, 3].map(() => Math.floor(rand() * nodes.length)));
    const es = segSampler(edges);
    return {
      lines: toLines(edges), lineOpacity: 0.2,
      point: weighted([
        [38, (rand, o) => { const i = Math.floor(rand() * nodes.length), n = nodes[i], hub = hubs.has(i), j = jitter(rand, hub ? 0.06 : 0.035); set(o, n[0] + j[0], n[1] + j[1], n[2] + j[2], tintXY(n[0], n[1]), hub ? 0.8 : 0.1); }],
        [62, (rand, o) => { es(rand, o); o[3] = tintXY(o[0], o[1]); o[4] = -0.1; }],
      ]),
    };
  },
};

const transformerScene = {
  cat: 2, name: 'Transformer',
  build(rand) {
    const L = 4, T = 8, tokens = [];
    for (let l = 0; l < L; l++) for (let t = 0; t < T; t++) tokens.push([-0.9 + (t / (T - 1)) * 1.8, -0.66 + l * 0.44, 0, l]);
    const arcs = [];
    for (let l = 0; l < L - 1; l++) {
      for (let t = 0; t < T; t++) {
        const to = tokens[(l + 1) * T + t];
        const picks = new Set([t, Math.floor(rand() * T), Math.floor(rand() * T)]);
        picks.forEach((s) => {
          const from = tokens[l * T + s], bulge = 0.25 + rand() * 0.3;
          arcs.push(...curveSegs(bez(from.slice(0, 3), [from[0], from[1] + 0.15, bulge], [to[0], to[1] - 0.15, bulge], to.slice(0, 3)), 8, 0.006));
        });
      }
    }
    const as = segSampler(arcs);
    const plates = [];
    for (let l = 0; l < L; l++) plates.push(...boxEdges(0, -0.66 + l * 0.44, 0, 1.0, 0.0, 0.22).slice(0, 8).filter((_, i) => i % 2 === 0 || i > 3));
    return {
      lines: toLines(plates), lineOpacity: 0.18,
      point: weighted([
        [34, (rand, o) => { const tk = tokens[Math.floor(rand() * tokens.length)], j = jitter(rand, 0.045); set(o, tk[0] + j[0], tk[1] + j[1] * 0.6, tk[2] + j[2], tk[3] / 3, 0.2); }],
        [66, (rand, o) => { as(rand, o); o[3] = clamp01(0.5 + o[1] * 0.5); o[4] = -0.15; }],
      ]),
    };
  },
};

/* ---------- 4. Explainable and trustworthy AI ---------- */

const pathsScene = {
  cat: 3, name: 'Decision paths',
  build(rand) {
    const net = buildMLP(rand);
    const keyEdges = net.edges.filter(net.isKey);
    const ks = segSampler(keyEdges.map(net.seg)), es = segSampler(net.edges.map(net.seg));
    const keyNodes = [...net.keyNodes];
    return {
      lines: toLines(net.edges.map(net.seg)), hiLines: toLines(keyEdges.map(net.seg)), lineOpacity: 0.035,
      point: weighted([
        [14, (rand, o) => { ks(rand, o); o[3] = 0.2; o[4] = 1; }],
        [10, (rand, o) => { const n = net.nodes[keyNodes[Math.floor(rand() * keyNodes.length)]], j = jitter(rand, 0.045); set(o, n[0] + j[0], n[1] + j[1], n[2] + j[2], 0.1, 1); }],
        [20, (rand, o) => { const n = net.nodes[Math.floor(rand() * net.nodes.length)], j = jitter(rand, 0.035); set(o, n[0] + j[0], n[1] + j[1], n[2] + j[2], tintXY(n[0], n[1]), -0.5); }],
        [56, (rand, o) => { es(rand, o); o[3] = tintXY(o[0], o[1]); o[4] = -0.65; }],
      ]),
    };
  },
};

const saliencyScene = {
  cat: 3, name: 'Saliency map',
  build(rand) {
    const hot = [0.12 + rand() * 0.3, 0.1 + rand() * 0.3], hr = 0.22;
    const inside = (x, y) => (x / 0.7) ** 2 + (y / 0.86) ** 2 < 1;
    return {
      point: weighted([
        [82, (rand, o) => {
          let x, y;
          for (let k = 0; k < 60; k++) {
            x = (rand() * 2 - 1) * 0.7; y = (rand() * 2 - 1) * 0.86;
            if (!inside(x, y)) continue;
            const r = Math.hypot(x / 0.7, y / 0.86), th = Math.atan2(y, x);
            const folds = Math.sin(r * 22 + 3 * Math.sin(th * 5) + 2 * Math.cos(th * 3));
            const ventricle = Math.hypot((Math.abs(x) - 0.1) / 0.06, (y - 0.05) / 0.2) < 1;
            if (!ventricle && folds > -0.3 && !(Math.abs(x) < 0.015 && y > -0.2)) break;
          }
          const d = Math.hypot(x - hot[0], y - hot[1]) / hr;
          const heat = d < 1 ? 1 - d * d : 0;
          set(o, x, y, gauss(rand) * 0.02, heat > 0 ? 0.0 : tintXY(x, y) * 0.8 + 0.2, heat > 0 ? heat : -0.35);
        }],
        [18, (rand, o) => { const a = rand() * TAU, r = hr * 1.15; set(o, hot[0] + Math.cos(a) * r, hot[1] + Math.sin(a) * r, 0.01, 0.0, 0.9); }],
      ]),
    };
  },
};

const uncertaintyScene = {
  cat: 3, name: 'Uncertainty estimation',
  build(rand) {
    const a = 1.8 + rand() * 1.2, b = rand() * TAU;
    const f = (x) => 0.3 * Math.sin(a * x + b) + 0.12 * x;
    const sigma = (x) => 0.025 + 0.32 * Math.max(0, Math.abs(x) - 0.4) ** 1.4;
    const data = Array.from({ length: 14 }, () => { const x = -0.4 + rand() * 0.8; return [x, f(x) + gauss(rand) * 0.02]; });
    return {
      lines: toLines([[-1.15, -0.85, 0, 1.15, -0.85, 0], [-1.15, -0.85, 0, -1.15, 0.85, 0]].map((l) => [...l, 0])), lineOpacity: 0.25,
      point: weighted([
        [70, (rand, o) => {
          const x = rand() * 2.3 - 1.15, s = sigma(x), g = gauss(rand);
          set(o, x, f(x) + g * s, gauss(rand) * s * 0.7, clamp01(Math.abs(g) / 2.2), Math.abs(g) > 1.4 ? -0.5 : -0.1);
        }],
        [18, (rand, o) => { const x = rand() * 2.3 - 1.15; set(o, x, f(x), 0, 0.05, 1); }],
        [12, (rand, o) => { const p = data[Math.floor(rand() * data.length)], j = jitter(rand, 0.022); set(o, p[0] + j[0], p[1] + j[1], j[2], 0.9, 0.6); }],
      ]),
    };
  },
};

const attributionScene = {
  cat: 3, name: 'Feature attribution',
  build(rand) {
    const vals = Array.from({ length: 9 }, (_, i) => (0.95 - i * 0.1) * (rand() < 0.35 ? -1 : 1) * (0.85 + rand() * 0.15));
    const H = 0.05, D = 0.06;
    const area = vals.map((v) => Math.abs(v));
    const total = area.reduce((p, q) => p + q, 0);
    return {
      lines: toLines([[0, 0.8, 0, 0, -0.8, 0, 0]]), lineOpacity: 0.35,
      point: weighted([
        [86, (rand, o) => {
          let x = rand() * total, i = 0;
          while (i < vals.length - 1 && x > area[i]) { x -= area[i]; i++; }
          const v = vals[i], y = 0.72 - i * 0.18;
          boxVolume(rand, o, (v / 2) * 0.95, y, 0, (Math.abs(v) / 2) * 0.95, H, D);
          o[3] = v > 0 ? 0.0 : 1.0; o[4] = i < 3 ? 0.7 : -0.1;
        }],
        [14, (rand, o) => { const i = Math.floor(rand() * vals.length), len = 0.12 + ((i * 37) % 5) * 0.03; set(o, -1.12 + rand() * len, 0.72 - i * 0.18 + gauss(rand) * 0.006, 0, 0.6, -0.4); }],
      ]),
    };
  },
};

const calibrationScene = {
  cat: 3, name: 'Calibration',
  build(rand) {
    const S = 0.8, bins = 10;
    const heights = Array.from({ length: bins }, (_, i) => clamp01((i + 0.5) / bins + (rand() - 0.5) * 0.12));
    const toX = (u) => -S + u * 2 * S;
    const axes = [[-S, -S, 0, S, -S, 0, 0], [-S, -S, 0, -S, S, 0, 0]];
    const diag = [[-S, -S, 0.08, S, S, 0.08, 0.008]];
    const ds = segSampler(diag);
    return {
      lines: toLines(axes), hiLines: toLines(diag), lineOpacity: 0.35,
      point: weighted([
        [72, (rand, o) => {
          const i = Math.floor(rand() * bins), w = (2 * S) / bins, h = heights[i] * 2 * S;
          boxVolume(rand, o, toX((i + 0.5) / bins), -S + h / 2, 0, w * 0.38, h / 2, 0.06);
          o[3] = i / (bins - 1); o[4] = Math.abs(heights[i] - (i + 0.5) / bins) < 0.04 ? 0.2 : -0.2;
        }],
        [28, (rand, o) => { ds(rand, o); o[3] = 0.05; o[4] = 1; }],
      ]),
    };
  },
};

const shieldScene = {
  cat: 3, name: 'Trustworthy AI',
  build() {
    const hw = (y) => { const s = (0.72 - y) / 1.58; return 0.62 * Math.pow(Math.max(0, 1 - Math.pow(s, 2.2)), 0.55); };
    const outline = [];
    outline.push(...curveSegs((t) => [-0.62 + 1.24 * t, 0.72 + 0.06 * Math.sin(Math.PI * t) - 0.06, 0], 20, 0.012));
    outline.push(...curveSegs((t) => { const y = 0.66 - t * 1.52; return [hw(y), y, 0]; }, 30, 0.012));
    outline.push(...curveSegs((t) => { const y = 0.66 - t * 1.52; return [-hw(y), y, 0]; }, 30, 0.012));
    const check = [[-0.28, 0.0, 0, -0.07, -0.24, 0, 0.035], [-0.07, -0.24, 0, 0.33, 0.3, 0, 0.035]];
    const os = segSampler(outline), cs = segSampler(check);
    return {
      hiLines: toLines(check), lineOpacity: 0,
      point: weighted([
        [34, (rand, o) => { os(rand, o); o[2] = rand() < 0.5 ? -0.07 : 0.07; o[3] = 0.3; o[4] = 0.35; }],
        [40, (rand, o) => { const y = 0.66 - rand() * 1.5, w = hw(y), x = (rand() * 2 - 1) * w; set(o, x, y, gauss(rand) * 0.04, tintXY(x, y), -0.45); }],
        [26, (rand, o) => { cs(rand, o); o[3] = 0.05; o[4] = 1; }],
      ]),
    };
  },
};

const SCENES = [
  brainScene, chestScene, heartScene, lungScene, retinaScene, eegScene, ecgScene, wearableScene, emgScene, ehrScene, dnaScene,
  clusterScene, manifoldScene, sphereScene, featureMapScene, attentionScene,
  mlpScene, cnnScene, unetScene, gnnScene, transformerScene,
  pathsScene, saliencyScene, uncertaintyScene, attributionScene, calibrationScene, shieldScene,
];

/* ==========================================================================
   Renderer
   ========================================================================== */
async function init() {
  if (!hero || !canvas) return;
  if (!hasWebGL()) { fallback(); return; }

  let THREE;
  try { THREE = await import(THREE_URL); } catch (e) { fallback(); return; }

  const isSmall = window.matchMedia('(max-width: 760px)').matches || window.matchMedia('(pointer: coarse)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  const COUNT = isSmall ? 6000 : lowPower ? 10000 : 16000;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { fallback(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);

  /* Buffers: each particle morphs from "from" to "to" */
  const fromPos = new Float32Array(COUNT * 3);
  const toPos = new Float32Array(COUNT * 3);
  const fromInfo = new Float32Array(COUNT * 2);
  const toInfo = new Float32Array(COUNT * 2);
  const seeds = new Float32Array(COUNT);
  const rand = mulberry32((Math.random() * 1e9) | 0);
  for (let i = 0; i < COUNT; i++) seeds[i] = rand();

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(fromPos, 3);
  const toAttr = new THREE.BufferAttribute(toPos, 3);
  const fromInfoAttr = new THREE.BufferAttribute(fromInfo, 2);
  const toInfoAttr = new THREE.BufferAttribute(toInfo, 2);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aTo', toAttr);
  geometry.setAttribute('aFromInfo', fromInfoAttr);
  geometry.setAttribute('aToInfo', toInfoAttr);
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uMix: { value: 1 },
    uSize: { value: isSmall ? 15 : 17 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uColorA: { value: new THREE.Color('#2db5b5') },
    uColorB: { value: new THREE.Color('#7ad7cf') },
    uColorHi: { value: new THREE.Color('#d9fbff') },
    uOpacity: { value: 0.85 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uMix;
      uniform float uSize;
      uniform float uPixelRatio;
      attribute vec3 aTo;
      attribute vec2 aFromInfo;
      attribute vec2 aToInfo;
      attribute float aSeed;
      varying float vTint;
      varying float vAlpha;
      varying float vHi;

      float ease(float t) { return t * t * (3.0 - 2.0 * t); }

      void main() {
        float m = ease(clamp(uMix * 1.6 - aSeed * 0.6, 0.0, 1.0));
        vec3 p = mix(position, aTo, m);

        // particles swirl outward a little while they travel
        float w = sin(3.14159 * m);
        p += vec3(sin(aSeed * 91.0 + uTime * 0.8), cos(aSeed * 53.0 + uTime * 0.6), sin(aSeed * 27.0)) * 0.2 * w;

        float t = uTime * 0.6 + aSeed * 30.0;
        p += vec3(sin(t), cos(t * 0.8), sin(t * 0.7)) * 0.005;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        vec2 info = mix(aFromInfo, aToInfo, m);
        float hi = max(info.y, 0.0);
        float size = uSize * (0.55 + aSeed * 0.75) * (1.0 + hi * 0.45);
        gl_PointSize = size * uPixelRatio / -mv.z;

        vTint = info.x;
        vHi = hi;
        vAlpha = mix(0.55, 1.0, aSeed) * (1.0 + min(info.y, 0.0) * 0.72);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorHi;
      uniform float uOpacity;
      varying float vTint;
      varying float vAlpha;
      varying float vHi;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.1, 0.5, d);
        if (a < 0.02) discard;
        vec3 col = mix(uColorA, uColorB, vTint);
        col = mix(col, uColorHi, vHi * 0.55);
        gl_FragColor = vec4(col, a * vAlpha * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const makeLines = (color) => {
    const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    l.frustumCulled = false;
    return l;
  };
  const lines = makeLines(0x2db5b5);
  const hiLines = makeLines(0x9ff3f3);

  const group = new THREE.Group();
  group.add(points, lines, hiLines);
  const pivot = new THREE.Group();
  pivot.add(group);
  scene.add(pivot);

  /* Build a scene into the "to" buffers */
  const out = [0, 0, 0, 0, 0];
  function generate(def) {
    const built = def.build(rand);
    for (let i = 0; i < COUNT; i++) {
      out[0] = out[1] = out[2] = out[3] = out[4] = 0;
      built.point(rand, out);
      toPos[i * 3] = out[0]; toPos[i * 3 + 1] = out[1]; toPos[i * 3 + 2] = out[2];
      toInfo[i * 2] = out[3]; toInfo[i * 2 + 1] = out[4];
    }
    toAttr.needsUpdate = true;
    toInfoAttr.needsUpdate = true;
    // fit the scene: wide scenes are scaled down so they never reach the headline
    let mx = 0, my = 0;
    for (let i = 0; i < COUNT; i += 7) { mx = Math.max(mx, Math.abs(toPos[i * 3])); my = Math.max(my, Math.abs(toPos[i * 3 + 1])); }
    built.fit = Math.min(1, 0.92 / (mx || 1), 1.08 / (my || 1));
    return built;
  }
  function setLineGeometry(obj, arr) {
    obj.geometry.dispose();
    obj.geometry = new THREE.BufferGeometry();
    if (arr && arr.length) obj.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  }

  /* Layout */
  const resize = () => {
    // size from the canvas itself (on phones it only covers a band at the top)
    const w = canvas.clientWidth || hero.clientWidth, h = canvas.clientHeight || hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const wide = window.innerWidth > 860;
    if (wide) {
      // right half of the screen, beside the text
      pivot.position.set(Math.min(halfW * 0.5, 2.2), 0.3, 0);
      pivot.scale.setScalar(Math.min(0.9, halfW * 0.36, halfH * 0.6));
    } else {
      // centred in its own band above the text
      pivot.position.set(0, 0, 0);
      pivot.scale.setScalar(Math.min(1.45, (halfW * 0.92) / 0.95, (halfH * 0.94) / 1.08));
    }
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    requestRender();
  };

  /* Pointer parallax and scroll */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  let scrollProg = 0;
  const gsap = window.gsap;
  if (gsap && window.ScrollTrigger && !reduceMotion) {
    window.ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => { scrollProg = s.progress; } });
  }

  /* Sequencer: data, representation, model, explainability, then repeat */
  const lastPick = [null, null, null, null];
  const choose = (cat) => {
    const list = SCENES.filter((s) => s.cat === cat && s !== lastPick[cat]);
    const pick = list[Math.floor(Math.random() * list.length)];
    lastPick[cat] = pick;
    return pick;
  };
  let visible = true;
  let category = 0;
  let current = null;

  function show(def, instant) {
    fromPos.set(instant ? fromPos : toPos);
    fromInfo.set(instant ? fromInfo : toInfo);
    const built = generate(def);
    if (instant) { fromPos.set(toPos); fromInfo.set(toInfo); }
    posAttr.needsUpdate = true;
    fromInfoAttr.needsUpdate = true;
    setLineGeometry(lines, built.lines);
    setLineGeometry(hiLines, built.hiLines);
    current = built;
    if (instant || !window.gsap) group.scale.setScalar(built.fit);
    else window.gsap.to(group.scale, { x: built.fit, y: built.fit, z: built.fit, duration: MORPH_TIME, ease: 'power2.inOut' });
  }
  function fadeLinesIn() {
    if (!current) return;
    gsap.to(lines.material, { opacity: current.lineOpacity ?? 0.15, duration: 1 });
    gsap.to(hiLines.material, { opacity: current.hiLines ? 0.45 : 0, duration: 1 });
  }
  function next() {
    if (!visible || document.hidden) { gsap.delayedCall(1, next); return; }
    category = (category + 1) % 4;
    gsap.to([lines.material, hiLines.material], {
      opacity: 0, duration: 0.5,
      onComplete: () => {
        show(choose(category), false);
        uniforms.uMix.value = 0;
        gsap.to(uniforms.uMix, {
          value: 1, duration: MORPH_TIME, ease: 'power2.inOut',
          onComplete: () => { fadeLinesIn(); gsap.delayedCall(HOLD_TIME, next); },
        });
      },
    });
  }

  // First scene: a random piece of clinical data
  lastPick[0] = null;
  show(choose(0), true);
  uniforms.uMix.value = 1;

  /* Render loop, paused when the hero is off screen or the tab is hidden */
  const clock = new THREE.Clock();
  let running = false, rafId = 0, time = 0;

  function frame() {
    rafId = 0;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    uniforms.uTime.value = time;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    // gentle sway so flat scenes (signals, charts) are never seen edge on
    group.rotation.y = -0.38 + Math.sin(time * 0.17) * 0.55;
    group.rotation.x = 0.1 + Math.sin(time * 0.11) * 0.08;
    pivot.rotation.y = pointer.x * 0.25 + scrollProg * 0.6;
    pivot.rotation.x = pointer.y * 0.14 + scrollProg * 0.35;
    camera.position.z = 4.6 + scrollProg * 1.4;
    camera.position.y = -scrollProg * 0.6;
    renderer.render(scene, camera);
    if (running) rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduceMotion) return;
    running = true;
    clock.getDelta();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }
  function requestRender() { if (!running && !rafId) rafId = requestAnimationFrame(frame); }

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !document.hidden) start(); else stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (visible) start(); });

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

  resize();
  start();
  requestRender();
  hero.classList.add('is-ready');

  if (gsap && !reduceMotion) {
    fadeLinesIn();
    gsap.delayedCall(HOLD_TIME + 1, next);
  }
}

const kick = () => init().catch((e) => { console.error(e); fallback(); });
if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 1200 });
else setTimeout(kick, 200);
