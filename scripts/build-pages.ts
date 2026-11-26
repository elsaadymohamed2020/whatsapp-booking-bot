/** Builds docs/ (static demo for GitHub Pages): npx esbuild is used for the browser bundle. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEMO_PAGE } from '../src/web/page';

mkdirSync('docs', { recursive: true });
execFileSync(
  'npx',
  ['esbuild', 'src/web/browser.ts', '--bundle', '--minify', '--format=iife', '--outfile=docs/bot.js'],
  { stdio: 'inherit' },
);
writeFileSync('docs/index.html', DEMO_PAGE.replace('<script>\n(function(){', '<script src="bot.js"></script>\n<script>\n(function(){'));
writeFileSync('docs/.nojekyll', '');
