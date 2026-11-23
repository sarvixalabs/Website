/* ==========================================================================
   Sarvixa Labs: shared site behaviour
   - navbar background on scroll, mobile menu, active link while scrolling
   - custom cursor and card tilt (desktop only)
   - scroll reveal animations (GSAP + ScrollTrigger, loaded before this file)
   ========================================================================== */

const root = document.documentElement;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
export const canAnimate = Boolean(gsap && ScrollTrigger) && !prefersReducedMotion;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---------- Navbar: background on scroll and mobile menu ---------- */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = nav.querySelector('.nav__toggle');
  const menu = nav.querySelector('.nav__links');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------- Highlight the nav link of the section in view ---------- */
function initScrollSpy() {
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;
  const update = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    let current = sections[0];
    sections.forEach((s) => { if (s.offsetTop <= y) current = s; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
    links.forEach((a) => {
      if (a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* ---------- Keep the address bar clean: scroll to a section without adding #section ---------- */
function initCleanUrl() {
  const clean = () => history.replaceState(null, '', window.location.pathname + window.location.search);

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    let target = null;
    if (id === '#') target = document.body;
    else {
      try { target = document.querySelector(id); } catch (err) { target = null; }
    }
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    clean();
  });

  // a link such as sarvixalabs.com/#team scrolls there first, then the #team part is removed
  if (window.location.hash) {
    const removeHash = () => setTimeout(clean, 50);
    if (document.readyState === 'complete') removeHash();
    else window.addEventListener('load', removeHash, { once: true });
  }
}

/* ---------- Custom cursor (desktop only) ---------- */
function initCursor() {
  if (!finePointer || prefersReducedMotion) return;
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ring);

  let x = -100, y = -100, rx = x, ry = y, raf = 0;
  const loop = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    root.classList.add('has-cursor');
    root.classList.remove('cursor-hidden');
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('mouseleave', () => root.classList.add('cursor-hidden'));
  document.addEventListener('pointerover', (e) => {
    const hit = Boolean(e.target.closest('a, button'));
    ring.classList.toggle('is-hover', hit);
    dot.classList.toggle('is-hover', hit);
  });
}

/* ---------- Card tilt (elements with data-tilt) ---------- */
export function initTilt(scope = document) {
  if (!finePointer || prefersReducedMotion) return;
  scope.querySelectorAll('[data-tilt]').forEach((card) => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = '1';
    const max = parseFloat(card.dataset.tilt) || 5;
    card.addEventListener('pointerenter', () => card.classList.add('is-tilting'));
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ---------- Split a heading into words ---------- */
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const word = document.createElement('span');
          word.className = 'word';
          const inner = document.createElement('span');
          inner.className = 'word-inner';
          inner.textContent = part;
          word.append(inner);
          frag.append(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
  el.classList.add('is-split');
  return el.querySelectorAll('.word-inner');
}

/* ---------- Scroll reveal animations ----------
   data-split   heading reveals word by word
   data-reveal  fades and slides up ("scale" for a soft zoom)
   data-stagger children reveal one after another
   data-delay   optional delay in seconds                         */
function initReveals() {
  if (!canAnimate) {
    root.classList.remove('js');
    return;
  }

  document.querySelectorAll('[data-split]').forEach((el) => {
    gsap.fromTo(splitWords(el), { yPercent: 110 }, {
      yPercent: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.045,
      delay: parseFloat(el.dataset.delay) || 0,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const from = el.dataset.reveal === 'scale' ? { opacity: 0, scale: 0.96, y: 16 } : { opacity: 0, y: 28 };
    gsap.fromTo(el, from, {
      opacity: 1, y: 0, scale: 1,
      duration: 1,
      ease: 'power3.out',
      delay: parseFloat(el.dataset.delay) || 0,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      clearProps: 'transform',
      onStart: () => el.classList.add('is-revealing'),
      onComplete: () => el.classList.remove('is-revealing'),
    });
  });

  document.querySelectorAll('[data-stagger]').forEach((group) => {
    gsap.fromTo(group.children, { opacity: 0, y: 36 }, {
      opacity: 1, y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      clearProps: 'transform',
      onStart: () => [...group.children].forEach((c) => c.classList.add('is-revealing')),
      onComplete: () => [...group.children].forEach((c) => c.classList.remove('is-revealing')),
    });
  });

  // recalculate trigger positions once fonts and images have loaded
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ---------- Boot ---------- */
initNav();
initScrollSpy();
initCleanUrl();
initCursor();
initTilt();
initReveals();
root.classList.add('anim-ready');
