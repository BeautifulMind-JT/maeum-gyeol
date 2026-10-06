import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const mobile = fileURLToPath(new URL('..', import.meta.url));
const ios = fileURLToPath(new URL('../ios/App', import.meta.url));

// Store builds must never ship without account features (Guideline 4.2 risk)
// or without a signing team. Public values live in config/production-public.json.
for (const name of ['MAEUM_SUPABASE_URL', 'MAEUM_SUPABASE_PUBLISHABLE_KEY', 'MAEUM_IOS_TEAM_ID']) {
  if (!process.env[name]) throw new Error(`${name} is required for the App Store release build.`);
}
if (!/^[A-Z0-9]{10}$/.test(process.env.MAEUM_IOS_TEAM_ID)) {
  throw new Error('MAEUM_IOS_TEAM_ID must be the 10-character Apple Developer Team ID.');
}
if (process.platform !== 'darwin') {
  throw new Error('The iOS archive/export steps require macOS with Xcode. Run this script on a Mac.');
}

function run(command, args, cwd = mobile) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', env: process.env});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.env.MAEUM_BUILD_MODE = 'store';
run(process.execPath, ['build.mjs']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'ios']);

// Resolve the Team ID into a copy of the committed ExportOptions template.
mkdirSync(`${ios}/build`, {recursive: true});
const template = readFileSync(`${ios}/ExportOptions.plist`, 'utf8');
writeFileSync(`${ios}/build/ExportOptions.plist`, template.replaceAll('MAEUM_IOS_TEAM_ID', process.env.MAEUM_IOS_TEAM_ID));

run('xcodebuild', [
  'archive',
  '-project', 'App.xcodeproj',
  '-scheme', 'App',
  '-configuration', 'Release',
  '-destination', 'generic/platform=iOS',
  '-archivePath', 'build/App.xcarchive',
  `DEVELOPMENT_TEAM=${process.env.MAEUM_IOS_TEAM_ID}`,
  '-allowProvisioningUpdates',
], ios);
run('xcodebuild', [
  '-exportArchive',
  '-archivePath', 'build/App.xcarchive',
  '-exportOptionsPlist', 'build/ExportOptions.plist',
  '-exportPath', 'build/export',
  '-allowProvisioningUpdates',
], ios);
console.log('Exported build/export/App.ipa — upload it with Transporter or Xcode Organizer.');
