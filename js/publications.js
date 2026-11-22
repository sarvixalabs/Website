/* Publications: renders data/publications.json. To add a paper, add one object to that file. */
const list = document.getElementById('pub-list');
const ICONS = 'assets/icons.svg';
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function link(label, icon, url) {
  if (!url) return '';
  const href = label === 'DOI' && !/^https?:/.test(url) ? `https://doi.org/${url}` : url;
  return `<a class="btn btn--ghost btn--sm" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><svg class="icon" aria-hidden="true"><use href="${ICONS}#${icon}"/></svg>${label}</a>`;
}

function item(p) {
  const authors = Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || '';
  return `
    <li class="pub">
      <div class="pub__year">${esc(p.year)}</div>
      <div>
        <h4 class="pub__title">${esc(p.title)}</h4>
        <p class="pub__meta">${esc(authors)}</p>
        <p class="pub__meta"><em>${esc(p.venue || '')}</em></p>
        <div class="pub__tags"><span class="tag">${esc(p.type || 'Paper')}</span></div>
      </div>
      <div class="pub__actions">
        ${link('Paper', 'i-paper', p.paper)}
        ${link('Code', 'i-code', p.code)}
        ${link('DOI', 'i-link', p.doi)}
      </div>
    </li>`;
}

async function init() {
  if (!list) return;
  try {
    const res = await fetch('data/publications.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const pubs = (await res.json()).sort((a, b) => (b.year || 0) - (a.year || 0));
    list.innerHTML = pubs.map(item).join('');
    if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.gsap.fromTo(list.children, { opacity: 0, y: 24 }, {
        opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out', clearProps: 'transform',
        scrollTrigger: { trigger: list, start: 'top 88%', once: true },
      });
    }
  } catch (e) {
    list.innerHTML = '<li class="pub-empty">Publications could not be loaded. If you are viewing this locally, run a local web server (see README).</li>';
  }
}

init();
