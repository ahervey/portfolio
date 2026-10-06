# Aj Hervey portfolio

Personal UX portfolio site. Open `index.html` in a browser.

- Live at https://ahervey.dev (GitHub Pages, custom domain set by the `CNAME` file)
- `img/` optimized images used by the site
- `files/` résumé PDF
- `source-images/` original project screenshots

## How it works

Everything lives in `index.html` as separate views (home, four case studies, about, résumé).
`app.js` shows the right view based on the URL hash, e.g. `index.html#oracle`.

- `styles.css` design tokens and all styling
- `app.js` routing, the tin animation, contents sidebar, screenshot lightbox
- `tools/build_artifact.py` makes a copy for publishing as a Claude artifact
- `tools/stamp_assets.py` run before each release so browsers fetch the matching CSS/JS
