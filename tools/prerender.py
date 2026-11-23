"""Writes the publication list from data/publications.json into index.html as plain HTML.

Run after editing data/publications.json:   python3 tools/prerender.py
Search engines and visitors without JavaScript then see the same list.
"""
import json
import re
from html import escape
from pathlib import Path

root = Path(__file__).resolve().parent.parent
pubs = json.loads((root / "data" / "publications.json").read_text(encoding="utf-8"))
pubs.sort(key=lambda p: p.get("year", 0), reverse=True)


ICONS = {"Paper": "i-paper", "Code": "i-code", "DOI": "i-link"}


def link(label, url):
    if not url:
        return ""
    if label == "DOI" and not re.match(r"^https?:", url):
        url = "https://doi.org/" + url
    return f'<a class="btn btn--ghost btn--sm" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#{ICONS[label]}"/></svg>{label}</a>'


def item(p):
    authors = ", ".join(p["authors"]) if isinstance(p.get("authors"), list) else p.get("authors", "")
    actions = "".join([link("Paper", p.get("paper")), link("Code", p.get("code")), link("DOI", p.get("doi"))])
    return (
        '\n          <li class="pub">'
        f'\n            <div class="pub__year">{escape(str(p.get("year", "")))}</div>'
        "\n            <div>"
        f'\n              <h4 class="pub__title">{escape(p.get("title", ""))}</h4>'
        f'\n              <p class="pub__meta">{escape(authors)}</p>'
        f'\n              <p class="pub__meta"><em>{escape(p.get("venue", ""))}</em></p>'
        f'\n              <div class="pub__tags"><span class="tag">{escape(p.get("type", "Paper"))}</span></div>'
        "\n            </div>"
        f'\n            <div class="pub__actions">{actions}</div>'
        "\n          </li>"
    )


html = "".join(item(p) for p in pubs)
index = root / "index.html"
text = index.read_text(encoding="utf-8")
new, n = re.subn(r"<!--PUBS:START-->.*?<!--PUBS:END-->", lambda m: "<!--PUBS:START-->" + html + "\n          <!--PUBS:END-->", text, flags=re.S)
if n != 1:
    raise SystemExit("Markers PUBS:START / PUBS:END not found in index.html")
index.write_text(new, encoding="utf-8")
print(f"Wrote {len(pubs)} publications into index.html")
