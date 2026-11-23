/* ==========================================================================
   Ambient background: slow drifting teal particles with faint links.
   Strongest in the left and right margins, almost invisible behind text.
   Lightweight 2D canvas, pauses when the tab is hidden.
   ========================================================================== */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.createElement('canvas');
canvas.className = 'ambient';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);
const ctx = canvas.getContext('2d');

let W = 0, H = 0, dpr = 1, parts = [], raf = 0;
const mouse = { x: -9999, y: -9999 };
const TEAL = '45, 181, 181';
const LINK = 150;

function sideWeight(x) {
  // 0 in the middle of the page, 1 at the edges
  const d = Math.abs(x - W / 2) / (W / 2);
  return Math.min(1, Math.max(0.12, Math.pow(d, 1.6) * 1.35));
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.min(110, Math.round((W * H) / 16000));
  parts = Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    r: 0.7 + Math.random() * 1.3,
  }));
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!reduceMotion) {
      // gentle push away from the pointer
      const mx = p.x - mouse.x, my = p.y - mouse.y, md = Math.hypot(mx, my);
      if (md < 120 && md > 0) { p.vx += (mx / md) * 0.02; p.vy += (my / md) * 0.02; }
      p.vx *= 0.995; p.vy *= 0.995;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 0.05) { p.vx += (Math.random() - 0.5) * 0.02; p.vy += (Math.random() - 0.5) * 0.02; }
      p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    }
    const w = sideWeight(p.x);
    for (let j = i + 1; j < parts.length; j++) {
      const q = parts[j];
      const dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
      if (d < LINK * LINK) {
        const a = (1 - Math.sqrt(d) / LINK) * 0.22 * Math.min(w, sideWeight(q.x));
        ctx.strokeStyle = `rgba(${TEAL}, ${a.toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(${TEAL}, ${(0.55 * w).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  if (!reduceMotion) raf = requestAnimationFrame(draw);
}

window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
document.addEventListener('mouseleave', () => { mouse.x = mouse.y = -9999; });
let t = 0;
window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { resize(); if (reduceMotion) draw(); }, 150); });
document.addEventListener('visibilitychange', () => {
  if (reduceMotion) return;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(draw);
});

resize();
draw();
requestAnimationFrame(() => canvas.classList.add('is-on'));
