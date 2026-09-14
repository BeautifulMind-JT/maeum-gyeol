import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const expected=JSON.parse(await readFile('docs/production-schema-2026-09-14.json','utf8'));
const actual=JSON.parse(await readFile('recreated-schema.json','utf8'));
const index=rows=>new Map(rows.map(x=>[x.kind+':'+x.name,x.value]));
const e=index(expected),a=index(actual),differences=[];
for(const key of new Set([...e.keys(),...a.keys()])){try{assert.deepEqual(a.get(key),e.get(key));}catch{differences.push(key);}}
assert.deepEqual(differences,[],'Recreated application schema differs from the read-only hosted catalog snapshot');
console.log('Matched',actual.length,'application catalog objects, including permissions and photo bucket policy');
