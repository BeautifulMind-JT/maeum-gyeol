import {spawnSync} from 'node:child_process';
import {accessSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const mobile = fileURLToPath(new URL('..', import.meta.url));
for (const name of ['MAEUM_SUPABASE_URL', 'MAEUM_SUPABASE_PUBLISHABLE_KEY', 'MAEUM_PREVIEW_KEYSTORE']) {
  if (!process.env[name]) throw new Error(`${name} is required for the cloud-connected preview.`);
}
// Reuse the saved preview key so installed previews can receive updates.
accessSync(process.env.MAEUM_PREVIEW_KEYSTORE);
function run(command, args, cwd = mobile) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', env: process.env});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ['build.mjs']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['--no-daemon', '--max-workers=2', ':app:assembleDebug'], fileURLToPath(new URL('../android', import.meta.url)));
