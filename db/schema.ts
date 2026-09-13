import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
 id:text('id').primaryKey(),
 subject:text('subject').notNull().unique(),
 name:text('name').notNull().default('마음에 머무는 사람'),
 bio:text('bio').notNull().default(''),
 createdAt:text('created_at').notNull(),
});
export const entries = sqliteTable('entries', {
 id:text('id').primaryKey(),
 ownerId:text('owner_id').notNull().references(()=>profiles.id),
 scene:text('scene').notNull().default('wine'),
 note:text('note').notNull(),
 context:text('context').notNull().default(''),
 wineName:text('wine_name').notNull().default(''),
 vintage:text('vintage').notNull().default(''),
 stage:text('stage').notNull().default('finish'),
 conversation:text('conversation').notNull().default('[]'),
 seconds:integer('seconds').notNull().default(0),
 visibility:text('visibility',{enum:['private','public']}).notNull().default('private'),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
}, t=>[index('idx_entries_owner_created').on(t.ownerId,t.createdAt),index('idx_entries_visibility_created').on(t.visibility,t.createdAt)]);
export const comments = sqliteTable('comments', {
 id:text('id').primaryKey(),
 entryId:text('entry_id').notNull().references(()=>entries.id,{onDelete:'cascade'}),
 authorId:text('author_id').notNull().references(()=>profiles.id),
 body:text('body').notNull(),
 createdAt:text('created_at').notNull(),
},t=>[index('idx_comments_entry_created').on(t.entryId,t.createdAt),index('idx_comments_author_created').on(t.authorId,t.createdAt)]);
