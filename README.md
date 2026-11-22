# Sarvixa Labs website

The website of **Sarvixa Labs**, a clinical AI research group. It is a single scrolling page (Home, Team, Our Work, Contact Us) built with plain HTML, CSS and JavaScript. There is no build step, and it is ready to host on GitHub Pages at **sarvixalabs.com**.

## Folder structure

```
sarvixalabs/
├── index.html              The whole site: Home (about and mission), Team, Our Work, Contact Us
├── 404.html                Page not found
├── css/
│   └── styles.css          All styles. Colours, fonts and spacing are variables at the top.
├── js/
│   ├── main.js             Navbar, active link while scrolling, cursor, card tilt, scroll animations
│   ├── hero.js             3D particle animation on the first screen (Three.js)
│   ├── ambient.js          Drifting particles in the page background
│   ├── team.js             Builds the team cards from data/team.json
│   └── publications.js     Builds the publication list from data/publications.json
├── data/
│   ├── team.json           Team members
│   └── publications.json   Publications
├── assets/
│   ├── logo.svg            Logo (dark background version)
│   ├── favicon.svg, favicon-32.png, apple-touch-icon.png
│   ├── og-image.png        Image shown when the link is shared (1200 x 630)
│   ├── icons.svg           Small icons used on the publication buttons
│   └── team/               Team photos
├── favicon.ico
├── CNAME                   Custom domain for GitHub Pages (sarvixalabs.com)
├── .nojekyll               Tells GitHub Pages to serve the files as they are
├── robots.txt
└── sitemap.xml
```

External libraries are loaded from a pinned CDN: Three.js `0.160.0`, GSAP and ScrollTrigger `3.12.5`, and the Inter and Space Grotesk fonts.

## Preview on your computer

The page loads its data files with JavaScript, which browsers block when you open the file directly. Run a small local server instead:

```bash
cd sarvixalabs
python3 -m http.server 8000
```

Then open http://localhost:8000. After changing files, press **Ctrl + Shift + R** (Cmd + Shift + R on Mac) to reload without the cache.

## Editing content

### Text

All page text is in `index.html`, in clearly marked sections (HOME, TEAM, OUR WORK, CONTACT US).

### Team (`data/team.json`)

Each person is one object, shown in the same order as the file. To add someone, copy an object, add a comma between objects and change the values. Leave a field as `""` (or remove it) to hide it.

```json
{
  "name": "Full Name",
  "role": "Co-founder",
  "designation": "Assistant Professor",
  "affiliation": "Institute name",
  "photo": "assets/team/full-name.webp",
  "links": {
    "linkedin": "https://www.linkedin.com/in/...",
    "scholar": "https://scholar.google.com/citations?user=...",
    "orcid": "https://orcid.org/0000-0000-0000-0000",
    "github": "https://github.com/..."
  }
}
```

Photos: put them in `assets/team/`. A portrait with a transparent background works best (PNG or WebP, about 500 x 500 px). If a photo is missing, the card shows the person's initials.

### Publications (`data/publications.json`)

Add one object per paper. The list is sorted by year automatically. The Code and Paper buttons only appear when a link is filled in.

```json
{
  "year": 2026,
  "type": "Journal article",
  "title": "Paper title",
  "authors": "A. Author, B. Author",
  "venue": "Journal name, vol. 1, 2026",
  "doi": "https://doi.org/10.xxxx/xxxxx",
  "code": ""
}
```

### Contact email

The Contact Us section links to `sarvixalabs@gmail.com`. To change it, edit the address in the CONTACT US section of `index.html` (it appears twice on one line).

### Colours and fonts

All colours are CSS variables at the top of `css/styles.css`. The main ones are `--bg` (background), `--text`, `--accent` (logo teal) and `--accent-2` (light aqua). The 3D animation colours are in `js/hero.js` (search for `uColorA`).

### 3D animation

`js/hero.js` contains 27 scenes in four groups (clinical data, learned representations, models, explainable and trustworthy AI). Every loop plays one random scene from each group. `MORPH_TIME` and `HOLD_TIME` at the top of the file control the speed.

## Deploying to GitHub Pages

### 1. Create the repository

1. Sign in to GitHub and click **New repository**.
2. Name it, for example, `sarvixalabs.com`, and make it **Public**.
3. Do not add a README or licence. Click **Create repository**.

### 2. Upload the files

With Git:

```bash
cd sarvixalabs
git init
git add .
git commit -m "Sarvixa Labs website"
git branch -M main
git remote add origin https://github.com/<your-username>/sarvixalabs.com.git
git push -u origin main
```

Without Git: on the new repository page click **uploading an existing file**, drag in everything inside the `sarvixalabs` folder (including the `css`, `js`, `data` and `assets` folders), then click **Commit changes**. Make sure `CNAME` and `.nojekyll` are included (files starting with a dot can be hidden; press `Ctrl + H` in the Linux file manager or `Cmd + Shift + .` on Mac to show them).

### 3. Turn on Pages

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. Under **Custom domain**, enter `sarvixalabs.com` and click **Save**.

### 4. Set up DNS on GoDaddy

1. Sign in to GoDaddy and open **My Products > Domains > sarvixalabs.com > DNS**.
2. Delete any existing **A** records for `@`, any **CNAME** record for `www`, and any parked or forwarding entries.
3. Add four **A** records:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |

4. Add one **CNAME** record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | www | `<your-username>.github.io` |

5. Optional, for IPv6, add four **AAAA** records for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

### 5. Turn on HTTPS

DNS changes take from a few minutes to a few hours (up to 48). When GitHub shows "DNS check successful" under **Settings > Pages**, tick **Enforce HTTPS**.

### Checking it works

- `https://sarvixalabs.com` and `https://www.sarvixalabs.com` both open the site.
- A wrong address such as `https://sarvixalabs.com/xyz` shows the 404 page.
- `dig sarvixalabs.com +short` lists the four GitHub IP addresses.

## Notes

- The 3D artwork is generated in the browser from mathematical shapes. No real scans or patient data are used.
- Without WebGL, the first screen shows a soft gradient instead of the 3D animation. On phones the animation uses fewer particles, and it pauses when it is off screen.
- All motion is turned off for visitors who choose "reduce motion" in their system settings.
- Update the `<lastmod>` date in `sitemap.xml` after changing the site.
