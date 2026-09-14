// One explicit author relationship for every public-entry query.
export const PUBLIC_ENTRY_SELECT='*,author:mg_profiles!mg_public_entries_owner_id_fkey(name)';
export function publicRecords(client,unwrap){
 return {
  comments:(id,offset=0)=>unwrap(client.from('mg_comments').select('*,author:mg_profiles(name)').eq('entry_id',id).order('created_at').order('id').range(offset,offset+49)),
  feed:(offset=0)=>unwrap(client.from('mg_public_entries').select(PUBLIC_ENTRY_SELECT).order('created_at',{ascending:false}).order('id').range(offset,offset+19)),
  entry:id=>unwrap(client.from('mg_public_entries').select(PUBLIC_ENTRY_SELECT).eq('id',id).single()),
  featured:id=>unwrap(client.from('mg_public_entries').select(PUBLIC_ENTRY_SELECT).eq('owner_id',id).eq('featured',true).order('created_at',{ascending:false}).limit(4))
 };
}
