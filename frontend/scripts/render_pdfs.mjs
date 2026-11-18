import { chromium } from '../node_modules/@playwright/test/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const mockupsDir = path.resolve(projectRoot, 'docs/mockups');
const htmlDir = path.resolve(__dirname, 'mockups');

if (!fs.existsSync(mockupsDir)) {
  fs.mkdirSync(mockupsDir, { recursive: true });
}

async function render() {
  console.log('Launching Chromium...');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const targets = [
    {
      html: path.join(htmlDir, 'version_1_timeline.html'),
      pdf: path.join(mockupsDir, 'Version_1_Timeline_Design_Mockup.pdf'),
      name: 'Version 1 (Timeline)'
    },
    {
      html: path.join(htmlDir, 'version_2_sleeve.html'),
      pdf: path.join(mockupsDir, 'Version_2_Sleeve_Design_Mockup.pdf'),
      name: 'Version 2 (Sleeve)'
    }
  ];

  for (const t of targets) {
    if (!fs.existsSync(t.html)) {
      console.error(`Missing HTML file: ${t.html}`);
      continue;
    }
    console.log(`Rendering ${t.name}...`);
    await page.goto('file://' + t.html, { waitUntil: 'networkidle' });
    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: t.pdf,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
    const stats = fs.statSync(t.pdf);
    console.log(`Generated: ${t.pdf} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('Rendering complete!');
}

render().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
