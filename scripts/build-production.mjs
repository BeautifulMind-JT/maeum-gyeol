import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(await readFile(new URL('../config/production-public.json',import.meta.url),'utf8'));
const r=spawnSync(process.execPath,['scripts/build-vercel.mjs'],{stdio:'inherit',env:{...process.env,MAEUM_SUPABASE_URL:config.url,MAEUM_SUPABASE_PUBLISHABLE_KEY:config.publishableKey}});
if(r.error)throw r.error;process.exit(r.status??1);
