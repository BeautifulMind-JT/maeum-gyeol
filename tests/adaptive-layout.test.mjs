import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// iPhone, iPad multitasking and foldable inner screens share one bundle, so the
// layout must react to the window (media queries, safe-area env) and never to a
// sniffed device model. These checks guard the contracts of the adaptive pass.
test('the shared shell adapts by available width and height, not device sniffing',async()=>{
 const html=await readFile(new URL('../mobile/src/index.html',import.meta.url),'utf8');
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/interactive-widget=resizes-content/);
 const css=await readFile(new URL('../mobile/src/style.css',import.meta.url),'utf8');
 assert.ok(css.includes('env(safe-area-inset-left)'),'horizontal safe areas are respected');
 assert.ok(css.includes('env(safe-area-inset-right)'),'horizontal safe areas are respected');
 assert.match(css,/\.summer-hero\{max-height:min\(/,'short windows keep the shelf reachable below the cover');
 assert.match(css,/@media\(min-width:720px\) and \(max-width:959px\)/,'records read as two panes on iPad portrait and unfolded foldables');
 const main=await readFile(new URL('../mobile/src/main.mjs',import.meta.url),'utf8');
 assert.ok(!/innerWidth|userAgent|matchMedia/.test(main),'no width or device branching in view rendering');
});

test('the native iOS shell defers safe-area spacing to CSS, avoiding double insets',async()=>{
 const config=JSON.parse(await readFile(new URL('../mobile/capacitor.config.json',import.meta.url),'utf8'));
 assert.equal(config.ios.contentInset,'never');
});
