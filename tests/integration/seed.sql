-- Fixed fixture. Never execute this against the hosted production project.
begin;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.mg_profiles(id,name) values(auth.uid(),'M0 작성자 A');
select public.mg_commit_entry('20000000-0000-4000-8000-000000000001',0,'30000000-0000-4000-8000-000000000001','{"note":"M0 공개 기록 A","visibility":"public","featured":true,"conversation":[{"role":"you","text":"절대 공개하지 않는 A의 돌아보기"}]}');
select public.mg_commit_entry('20000000-0000-4000-8000-000000000001',1,'40000000-0000-4000-8000-000000000001','{"note":"M0 공개 기록 A","visibility":"public","featured":true,"conversation":[{"role":"you","text":"절대 공개하지 않는 A의 돌아보기"}]}');
select public.mg_commit_entry('20000000-0000-4000-8000-000000000003',0,'30000000-0000-4000-8000-000000000003','{"note":"M0 비공개 기록","visibility":"private"}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
insert into public.mg_profiles(id,name) values(auth.uid(),'M0 작성자 B');
select public.mg_commit_entry('20000000-0000-4000-8000-000000000002',0,'30000000-0000-4000-8000-000000000002','{"note":"M0 공개 기록 B","visibility":"public"}');
select public.mg_commit_entry('20000000-0000-4000-8000-000000000002',1,'40000000-0000-4000-8000-000000000002','{"note":"M0 공개 기록 B","visibility":"public"}');
insert into public.mg_likes(user_id,entry_id) values(auth.uid(),'20000000-0000-4000-8000-000000000001');
insert into public.mg_comments(id,author_id,entry_id,body) values('50000000-0000-4000-8000-000000000001',auth.uid(),'20000000-0000-4000-8000-000000000001','M0 작성자 B의 댓글');
commit;
