import {newId} from './identity.mjs';
import {photoFiles} from './photos.mjs';

export function socialCloud({client,actor,unwrap,account}){
 const count=async query=>{const result=await query;if(result.error)throw result.error;return result.count||0;};
 async function ensure(c,u){await unwrap(c.from('mg_profiles').upsert({id:u.id},{onConflict:'id',ignoreDuplicates:true}));}
 return {
  async feed(offset=0,{following=false,stage=null,owner=null,cursor=null}={}){
   return unwrap(client.rpc('mg_feed',{p_following:following,p_stage:stage||null,p_owner:owner,p_before_at:cursor?.created_at||null,p_after_id:cursor?.id||null}).select('*,author:mg_profiles(name)').range(offset,offset+19));
  },
  publicProfile:id=>unwrap(client.from('mg_profiles').select('id,name,bio').eq('id',id).single()),
  featured:id=>unwrap(client.from('mg_public_entries').select('*,author:mg_profiles(name)').eq('owner_id',id).eq('featured',true).order('created_at',{ascending:false}).limit(4)),
  async profileCounts(id){
   const [entries,followers,following]=await Promise.all([
    count(client.from('mg_public_entries').select('id',{count:'exact',head:true}).eq('owner_id',id)),
    count(client.from('mg_follows').select('follower_id',{count:'exact',head:true}).eq('following_id',id)),
    count(client.from('mg_follows').select('following_id',{count:'exact',head:true}).eq('follower_id',id))]);
   return {entries,followers,following};
  },
  async isFollowing(id){const u=await account();return Boolean(await unwrap(client.from('mg_follows').select('following_id').eq('follower_id',u.id).eq('following_id',id).maybeSingle()));},
  async follow(id,on){const {c,u}=await actor();await ensure(c,u);return unwrap(on?c.from('mg_follows').upsert({follower_id:u.id,following_id:id},{onConflict:'follower_id,following_id',ignoreDuplicates:true}):c.from('mg_follows').delete().eq('follower_id',u.id).eq('following_id',id));},
  async reactions(id,userId){const [likes,mine]=await Promise.all([count(client.from('mg_likes').select('user_id',{count:'exact',head:true}).eq('entry_id',id)),userId?unwrap(client.from('mg_likes').select('entry_id').eq('entry_id',id).eq('user_id',userId).maybeSingle()):null]);return {likes,liked:Boolean(mine)};},
  async like(id,on){const {c,u}=await actor();await ensure(c,u);return unwrap(on?c.from('mg_likes').upsert({user_id:u.id,entry_id:id},{onConflict:'user_id,entry_id',ignoreDuplicates:true}):c.from('mg_likes').delete().eq('user_id',u.id).eq('entry_id',id));},
  async people(query=''){const term=query.trim().slice(0,40).replace(/[\\%_]/g,'');let q=client.from('mg_profiles').select('id,name,bio').order('created_at',{ascending:false}).limit(30);if(term)q=q.ilike('name','%'+term+'%');return unwrap(q);},
  async notifications(){const u=await account();return unwrap(client.from('mg_notifications').select('*,actor:mg_profiles!mg_notifications_actor_id_fkey(name)').eq('recipient_id',u.id).order('created_at',{ascending:false}).limit(50));},
  async blocks(){const u=await account();return unwrap(client.from('mg_blocks').select('blocked_id').eq('blocker_id',u.id));},
  async block(id,on){const {c,u}=await actor();await ensure(c,u);return unwrap(on?c.from('mg_blocks').upsert({blocker_id:u.id,blocked_id:id},{onConflict:'blocker_id,blocked_id',ignoreDuplicates:true}):c.from('mg_blocks').delete().eq('blocker_id',u.id).eq('blocked_id',id));},
  async report(id,reason){const {c,u}=await actor();await ensure(c,u);return unwrap(c.from('mg_reports').upsert({reporter_id:u.id,entry_id:id,reason},{onConflict:'reporter_id,entry_id',ignoreDuplicates:true}));},
  async uploadPhoto({full,thumb}){
   const {c,u}=await actor();await ensure(c,u);const path=u.id+'/'+newId(),files=photoFiles(path),bucket=c.storage.from('maeum-photos');
   try{await unwrap(bucket.upload(files[0],full,{contentType:'image/jpeg',cacheControl:'0',upsert:false}));await unwrap(bucket.upload(files[1],thumb,{contentType:'image/jpeg',cacheControl:'0',upsert:false}));}
   catch(error){const removed=await bucket.remove(files).catch(()=>({error:true}));if(removed.error)await c.from('mg_media_gc').upsert({photo_path:path,owner_id:u.id},{onConflict:'photo_path',ignoreDuplicates:true});throw error;}
   return path;
  },
  async releasePhoto(path){if(!path)return;const {c,u}=await actor();if(!path.startsWith(u.id+'/'))return;await unwrap(c.from('mg_media_gc').upsert({photo_path:path,owner_id:u.id},{onConflict:'photo_path',ignoreDuplicates:true}));},
  async photo(path,size='thumb'){
   const file=photoFiles(path)[size==='full'?0:1];
   // Fetch a Blob through RLS, not a signed URL which can outlive publication.
   return unwrap(client.storage.from('maeum-photos').download(file));
  },
  async cleanupPhotos({includeDrafts=false}={}){
   const {c,u}=await actor();
   const rows=await unwrap(c.from('mg_media_gc').select('photo_path').eq('owner_id',u.id).lt('queued_at',new Date(Date.now()-86400000).toISOString()).limit(100));
   for(const row of rows){const refs=await unwrap(c.from('mg_entries').select('id').eq('photo_path',row.photo_path).eq('deleted',false).limit(1));if(refs.length)continue;
    if(includeDrafts){const drafts=await unwrap(c.from('mg_drafts').select('owner_id').eq('payload->>photoPath',row.photo_path).limit(1));if(drafts.length)continue;}
    await unwrap(c.storage.from('maeum-photos').remove(photoFiles(row.photo_path)));
    await unwrap(c.from('mg_media_gc').delete().eq('photo_path',row.photo_path));
   }
  },
  async deleteAccountPhotos(c,u){
   for(;;){const files=await unwrap(c.storage.from('maeum-photos').list(u.id,{limit:100,offset:0}));if(!files.length)return;
    await unwrap(c.storage.from('maeum-photos').remove(files.map(f=>u.id+'/'+f.name)));
   }
  }
 };
}
