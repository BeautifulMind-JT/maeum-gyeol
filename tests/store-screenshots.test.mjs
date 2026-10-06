import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {STORE_DEVICES, STORE_SCREENS, inspectPng} from '../scripts/store-screenshot-png.mjs';

test('store screenshots are 8-bit RGB PNGs at the App Store pixel sizes, with no alpha', async () => {
  for (const device of STORE_DEVICES) {
    const files = (await readdir(device.dir)).filter(name => name.endsWith('.png')).sort();
    assert.deepEqual(files, STORE_SCREENS.map(screen => screen.file), device.id);
    for (const name of files) {
      const info = inspectPng(await readFile(device.dir + '/' + name));
      assert.equal(info.width, device.width, name);
      assert.equal(info.height, device.height, name);
      assert.equal(info.bitDepth, 8, name);
      assert.equal(info.colorType, 2, name + ' must be RGB');
      assert.equal(info.hasAlphaChunk, false, name + ' must not use tRNS');
    }
  }
});
