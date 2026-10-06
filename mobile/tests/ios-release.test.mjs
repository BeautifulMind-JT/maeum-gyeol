import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel, encoding) => readFileSync(new URL(rel, import.meta.url), encoding);

function pngInfo(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('binary'), '\x89PNG\r\n\x1a\n');
  assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function pngIdat(bytes) {
  let pos = 8;
  const chunks = [];
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const tag = bytes.subarray(pos + 4, pos + 8).toString();
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (tag === 'IDAT') chunks.push(body);
    if (tag === 'IEND') break;
  }
  return inflateSync(Buffer.concat(chunks));
}

function cornerRgb(bytes, width) {
  const raw = pngIdat(bytes);
  assert.equal(raw[0], 0, 'splash rows must be filter 0 for this check');
  return [raw[1], raw[2], raw[3]];
}

test('the 1024 App Store icon is opaque RGB and the launch images use 마음결 cobalt, not Capacitor', () => {
  const icon = read('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  assert.deepEqual(pngInfo(icon), {width: 1024, height: 1024, bitDepth: 8, colorType: 2});
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    const splash = read('../ios/App/App/Assets.xcassets/Splash.imageset/' + name);
    assert.deepEqual(pngInfo(splash), {width: 2732, height: 2732, bitDepth: 8, colorType: 2}, name);
    assert.deepEqual(cornerRgb(splash, 2732), [8, 100, 173], name);
  }
  const launch = read('../ios/App/App/Base.lproj/LaunchScreen.storyboard', 'utf8');
  assert.match(launch, /0\.031372549019607844/);
  assert.doesNotMatch(launch, /systemBackgroundColor/);
  assert.doesNotMatch(launch, /Capacitor/i);
});

test('the release script reuses ExportOptions, requires store secrets, and does not archive off macOS', () => {
  const script = read('../scripts/build-ios-release.mjs', 'utf8');
  assert.match(script, /ExportOptions\.plist/);
  assert.match(script, /authenticationKeyPath/);
  assert.match(script, /CURRENT_PROJECT_VERSION/);
  const env = {
    ...process.env,
    MAEUM_SUPABASE_URL: 'https://example.supabase.co',
    MAEUM_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    MAEUM_IOS_TEAM_ID: 'ABCDE12345',
    MAEUM_REVIEWER_EMAIL: 'review@example.invalid',
  };
  assert.throws(
    () => execFileSync(process.execPath, ['scripts/build-ios-release.mjs'], {cwd: root, encoding: 'utf8', env: {...env, MAEUM_IOS_TEAM_ID: ''}}),
    /MAEUM_IOS_TEAM_ID/,
  );
  if (process.platform === 'darwin') return;
  assert.throws(
    () => execFileSync(process.execPath, ['scripts/build-ios-release.mjs'], {cwd: root, encoding: 'utf8', env}),
    /macOS/,
  );
});

test('ExportOptions stays a Team ID template for automatic App Store signing', () => {
  const plist = read('../ios/App/ExportOptions.plist', 'utf8');
  assert.match(plist, /<string>app-store-connect<\/string>/);
  assert.match(plist, /<string>automatic<\/string>/);
  assert.match(plist, /<string>MAEUM_IOS_TEAM_ID<\/string>/);
  assert.doesNotMatch(plist, /<string>[A-Z0-9]{10}<\/string>/);
});
