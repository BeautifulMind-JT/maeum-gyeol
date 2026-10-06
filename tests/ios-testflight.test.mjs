import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {IOS_TESTFLIGHT_SECRETS, missingIosTestflightSecrets, requireIosTestflightSecrets} from '../mobile/scripts/ios-testflight-secrets.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

function field(text, label) {
  const match = text.match(new RegExp('\\*\\*' + label + ':\\*\\*\\s+(.+)'));
  assert.ok(match, 'missing ' + label);
  return match[1].trim();
}

test('the TestFlight workflow is dispatch-only on macos-26 and names every required secret', async () => {
  const workflow = await read('.github/workflows/ios-testflight.yml');
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /runs-on:\s+macos-26/);
  assert.match(workflow, /npm --prefix mobile run build:ios/);
  assert.match(workflow, /xcrun altool --upload-app/);
  assert.match(workflow, /github\.run_number/);
  assert.match(workflow, /ExportOptions/);
  assert.doesNotMatch(workflow, /-----BEGIN [A-Z ]*PRIVATE KEY-----/);
  for (const name of IOS_TESTFLIGHT_SECRETS) {
    assert.match(workflow, new RegExp('secrets\\.' + name), name);
    assert.match(workflow, new RegExp(name + ': \\$\\{\\{ secrets\\.' + name + ' \\}\\}'), name);
  }
});

test('required TestFlight secret names fail fast with a clear message and are documented', async () => {
  assert.deepEqual(IOS_TESTFLIGHT_SECRETS, [
    'MAEUM_IOS_TEAM_ID',
    'ASC_KEY_ID',
    'ASC_ISSUER_ID',
    'ASC_KEY_P8',
    'MAEUM_REVIEWER_EMAIL',
    'MAEUM_SUPABASE_URL',
    'MAEUM_SUPABASE_PUBLISHABLE_KEY',
  ]);
  assert.deepEqual(missingIosTestflightSecrets({}), IOS_TESTFLIGHT_SECRETS);
  assert.throws(() => requireIosTestflightSecrets({MAEUM_IOS_TEAM_ID: 'ABCDE12345'}), /Missing required secrets: ASC_KEY_ID/);
  const empty = {PATH: process.env.PATH};
  assert.throws(
    () => execFileSync(process.execPath, ['mobile/scripts/ios-testflight-secrets.mjs'], {cwd: repo, env: empty, encoding: 'utf8'}),
    /Missing required secrets: MAEUM_IOS_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, MAEUM_REVIEWER_EMAIL, MAEUM_SUPABASE_URL, MAEUM_SUPABASE_PUBLISHABLE_KEY/,
  );
  const docs = await read('docs/TESTFLIGHT.md');
  for (const name of IOS_TESTFLIGHT_SECRETS) assert.match(docs, new RegExp('`' + name + '`'), name);
  assert.match(docs, /workflow_dispatch/);
  assert.match(docs, /Internal Testing/);
});

test('store metadata drafts stay inside App Store limits and match the privacy/export contracts', async () => {
  const text = await read('docs/APP-STORE-METADATA.md');
  const english = text.slice(text.indexOf('## English'));
  for (const part of [text, english]) {
    assert.ok(field(part, 'Subtitle').length <= 30, field(part, 'Subtitle'));
    assert.ok(field(part, 'Keywords').length <= 100, field(part, 'Keywords'));
    assert.ok(field(part, 'Promotional text').length <= 170, field(part, 'Promotional text'));
  }
  assert.match(text, /ITSAppUsesNonExemptEncryption.*false/s);
  assert.match(text, /iPhone 6\.9/);
  assert.match(text, /iPad 13/);
  assert.match(text, /1320 × 2868/);
  assert.match(text, /2064 × 2752/);
  assert.match(text, /Infrequent\/Mild/);
  assert.match(text, /User-Generated Content/);
  assert.match(text, /Unrestricted Web Access/);
  assert.doesNotMatch(text, /chatgpt\.site/);
  const privacy = await read('mobile/ios/App/App/PrivacyInfo.xcprivacy');
  for (const type of ['EmailAddress', 'Name', 'UserID', 'PhotosorVideos', 'OtherUserContent']) {
    assert.match(privacy, new RegExp('NSPrivacyCollectedDataType' + type), type);
  }
  assert.match(privacy, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  const info = await read('mobile/ios/App/App/Info.plist');
  assert.match(info, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
});
