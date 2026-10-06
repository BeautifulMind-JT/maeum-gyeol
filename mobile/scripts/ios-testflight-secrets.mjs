import {pathToFileURL} from 'node:url';

// Exact GitHub Actions secret names for the dispatch-only TestFlight upload.
// Values must never be committed. The workflow fails before archive if any is empty.
export const IOS_TESTFLIGHT_SECRETS = [
  'MAEUM_IOS_TEAM_ID',
  'ASC_KEY_ID',
  'ASC_ISSUER_ID',
  'ASC_KEY_P8',
  'MAEUM_REVIEWER_EMAIL',
  'MAEUM_SUPABASE_URL',
  'MAEUM_SUPABASE_PUBLISHABLE_KEY',
];

export function missingIosTestflightSecrets(env = process.env) {
  return IOS_TESTFLIGHT_SECRETS.filter((name) => !String(env[name] ?? '').trim());
}

export function requireIosTestflightSecrets(env = process.env) {
  const missing = missingIosTestflightSecrets(env);
  if (missing.length) {
    throw new Error(
      `Missing required secrets: ${missing.join(', ')}. Add them in the repository Settings → Secrets and variables → Actions. See docs/TESTFLIGHT.md.`,
    );
  }
  return IOS_TESTFLIGHT_SECRETS;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  requireIosTestflightSecrets();
  console.log('All required iOS TestFlight secrets are present.');
}
