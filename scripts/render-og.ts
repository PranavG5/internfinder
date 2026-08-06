/**
 * Renders scripts/og-image.html into public/og.png, the 1200x630 card that
 * Slack, iMessage, Discord, X, LinkedIn and Google show when someone shares
 * internindex.online.
 *
 *   npm i -D playwright-core        # once, and a Chromium to point it at
 *   node --import tsx scripts/render-og.ts
 *
 * playwright-core is deliberately not a dependency of this project: the PNG is
 * committed, so a build, a deploy and a crawler never need any of this. Set
 * CHROMIUM_PATH if Playwright cannot find a browser on its own.
 *
 * The shot is taken at 2x and downscaled by the browser to a flat 1200x630,
 * which keeps the type crisp without shipping a file twice the size.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WIDTH = 1200;
const HEIGHT = 630;

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const source = resolve(root, 'scripts/og-image.html');
const target = resolve(root, 'public/og.png');

async function loadPlaywright() {
  // Resolved through a variable on purpose: playwright-core is an optional
  // tool, not a dependency, so `tsc` must not demand its types be installed.
  const specifier = 'playwright-core';
  try {
    return (await import(specifier)) as { chromium: any };
  } catch {
    throw new Error(
      'playwright-core is not installed. Run `npm i -D playwright-core` first, then re-run this script.',
    );
  }
}

async function main() {
  const { chromium } = await loadPlaywright();

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
    });

    await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' });
    // Inter is fetched over the network; without this the card can rasterise
    // mid-swap and ship with the fallback face baked in.
    await page.evaluate(() => document.fonts.ready);

    const shot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      scale: 'css',
    });

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, shot);
    console.log(`wrote ${target} (${WIDTH}x${HEIGHT}, ${(shot.length / 1024).toFixed(1)} kB)`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
