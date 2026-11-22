/* ==========================================================================
   Current Team: renders data/team.json into cards.
   To add a person, add one object to data/team.json. Nothing to change here.
   Supported links: linkedin, scholar, orcid, github, website.
   ========================================================================== */
import { initTilt, canAnimate } from './main.js';

const grid = document.getElementById('team-grid');
const ICONS = 'assets/icons.svg';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name = '') => name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/* Simple initials avatar, used only when a photo is missing */
function avatar(name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#151518"/>
    <text x="200" y="228" text-anchor="middle" font-family="Space Grotesk, Inter, sans-serif" font-size="96" font-weight="600" fill="#2db5b5">${esc(initials(name))}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* Brand logos are embedded here so they always load, even from cache */
const BRAND = {
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  scholar: 'M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  orcid: 'M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z',
};
function linkIcon(type) {
  if (BRAND[type]) return `<svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${BRAND[type]}"/></svg>`;
  return `<svg class="icon" aria-hidden="true"><use href="${ICONS}#${type === 'email' ? 'i-mail' : 'i-link'}"/></svg>`;
}
const LABELS = { linkedin: 'LinkedIn', scholar: 'Google Scholar', orcid: 'ORCID', github: 'GitHub', website: 'Website', email: 'Email' };

function card(person) {
  const links = Object.entries(person.links || {})
    .filter(([, url]) => url)
    .map(([type, url]) => {
      const href = type === 'email' && !url.startsWith('mailto:') ? `mailto:${url}` : url;
      const ext = href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a class="social social--${esc(type)}" href="${esc(href)}"${ext} aria-label="${esc(person.name)} on ${LABELS[type] || type}" title="${LABELS[type] || type}">${linkIcon(type)}</a>`;
    })
    .join('');

  const photo = person.photo || '';
  return `
    <article class="team-card" data-tilt="4">
      <div class="team-card__photo">
        <img src="${esc(photo ? encodeURI(photo) : avatar(person.name))}" alt="Portrait of ${esc(person.name)}" loading="lazy" decoding="async" width="460" height="500" data-name="${esc(person.name)}">
      </div>
      <div class="team-card__body">
        <h3 class="team-card__name">${esc(person.name)}</h3>
        ${person.role ? `<p class="team-card__role">${esc(person.role)}</p>` : ''}
        ${person.designation ? `<p class="team-card__desig">${esc(person.designation)}</p>` : ''}
        ${person.affiliation ? `<p class="team-card__aff">${esc(person.affiliation)}</p>` : ''}
        ${person.bio ? `<p class="team-card__bio">${esc(person.bio)}</p>` : ''}
        ${links ? `<div class="team-card__links">${links}</div>` : ''}
      </div>
    </article>`;
}

async function render() {
  if (!grid) return;
  try {
    const res = await fetch('data/team.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const people = await res.json();
    grid.innerHTML = people.map(card).join('');
    // Swap missing photos for a generated avatar
    grid.querySelectorAll('img[data-name]').forEach((img) => {
      img.addEventListener('error', () => { img.src = avatar(img.dataset.name); }, { once: true });
    });
    initTilt(grid);
    if (canAnimate) {
      window.gsap.fromTo(grid.children, { opacity: 0, y: 36 }, {
        opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', clearProps: 'transform',
        scrollTrigger: { trigger: grid, start: 'top 88%', once: true },
      });
    }
  } catch (e) {
    grid.innerHTML = '<p class="notice">The team list could not be loaded. If you are viewing this file locally, run a local web server (see README).</p>';
  }
}

render();
