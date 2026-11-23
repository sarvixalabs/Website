# Sarvixa Labs Website

Website of Sarvixa Labs, a clinical AI research group: https://sarvixalabs.com

## 1. Structure

- `index.html`: the whole page (Home, Team, Our Work, Contact Us)
- `404.html`: page not found
- `css/styles.css`: all styles, with colours and fonts as variables at the top
- `js/main.js`: navbar, scroll animations and card effects
- `js/hero.js`: 3D particle animation on the first screen
- `js/ambient.js`: background particles
- `js/team.js`: builds the team cards from `data/team.json`
- `js/publications.js`: builds the publication list from `data/publications.json`
- `data/team.json`: team members
- `data/publications.json`: publications
- `tools/prerender.py`: writes the publication list into `index.html` as plain HTML (run after editing `data/publications.json`)
- `assets/`: logo, favicon, icons, share image and `team/` photos
- `favicon.ico`: browser tab icon
- `CNAME`: custom domain (sarvixalabs.com)
- `robots.txt` and `sitemap.xml`: search engine files
- `LICENSE`: MIT License for the code
- `.nojekyll`: tells GitHub Pages to serve the files as they are


