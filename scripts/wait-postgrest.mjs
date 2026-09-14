const url='http://127.0.0.1:54323/mg_public_entries?select=id';
for(let i=0;i<40;i++){
 try{const r=await fetch(url);if(r.ok){console.log('Actual PostgREST ready');process.exit(0);}}catch{}
 await new Promise(r=>setTimeout(r,1000));
}
throw Error('PostgREST did not become ready');
