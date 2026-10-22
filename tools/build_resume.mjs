// Render tools/resume.html to files/aj-hervey-resume.pdf with Chromium.
// usage: node tools/build_resume.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(here, 'resume.html'));
await page.pdf({ path: path.join(here, '..', 'files', 'aj-hervey-resume.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: false });
await browser.close();
