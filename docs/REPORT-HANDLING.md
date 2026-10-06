# 신고 처리 런북 (24시간 이내 검토)

공개 기록에 접수된 신고(`mg_reports`)를 어떻게 검토하고 조치하는지 정한다.
이용약관(`/terms`)과 지원 페이지(`/support`)는 **접수 후 24시간 이내 검토**를
약속하므로, 아래 절차는 매일 1회 이상 수행해야 한다.

담당: `{{OPERATOR_NAME}}` (연락처 `{{OPERATOR_CONTACT_EMAIL}}`) — `config/operator.json`과 동일하게 확정한다.

## 1. 신고 확인 (매일, 24시간 이내)

RLS상 신고는 신고자 본인만 읽을 수 있으므로 검토는 Supabase 대시보드(프로젝트
`vmvtpolyszkyachlqlki`)의 SQL Editor에서 운영자 권한으로 수행한다.

```sql
select r.id, r.reason, r.created_at, r.entry_id,
       p.note, p.owner_id, pr.name as author_name
from public.mg_reports r
join public.mg_public_entries p on p.id = r.entry_id
left join public.mg_profiles pr on pr.id = p.owner_id
where r.created_at > now() - interval '48 hours'
order by r.created_at;
```

이메일 문의(`{{OPERATOR_CONTACT_EMAIL}}`)로 들어온 신고도 같은 기준으로 처리한다.

## 2. 판정 기준

이용약관 3조(커뮤니티 규칙)의 무관용 원칙을 적용한다. 금지: 불법 콘텐츠,
비방·괴롭힘·혐오 표현, 음란물, 폭력·자해 조장, 스팸·도배, 개인정보 노출,
지식재산권 침해. 애매하면 비공개 전환 쪽으로 판단한다.

## 3. 조치 (위반 확인 시 즉시, 접수 후 24시간 이내)

1. **콘텐츠 제거** — 공개 사본을 삭제한다. 댓글·좋아요·소식은 FK cascade로 함께
   삭제되고, 작성자의 비공개 원본은 유지된다(공개 철회와 같은 효과).

   ```sql
   delete from public.mg_public_entries where id = '<entry_id>';
   ```

   위반이 댓글이면 해당 댓글만 삭제한다: `delete from public.mg_comments where id = '<comment_id>';`
2. **작성자 조치** — 반복·중대 위반이면 Supabase 대시보드 → Authentication →
   해당 사용자 → **Ban user**로 로그인을 차단한다(퇴출). 1회성 경미한 위반이면
   콘텐츠 제거로 종결한다.
3. **기록** — 처리한 신고 id, 판정, 조치, 처리 시각을 운영 기록(비공개)에 남긴다.
   보관 기간은 `{{RETENTION_REPORT_RECORDS}}`를 따른다.

## 4. 범위와 한계

- 처리된 `mg_reports` 행은 공개 사본 삭제 시 cascade로 함께 삭제된다. 처리
  이력이 필요하므로 삭제 전에 3번의 기록을 먼저 남긴다.
- 서비스 역할 키는 대시보드 밖으로 꺼내지 않는다. 자동화(알림·관리 화면)는
  현재 없으며, 도입하려면 별도 검토가 필요하다.
- 이 절차는 운영 DB에 쓰기를 수행하므로, 신고된 대상 외의 데이터를 건드리지
  않는지 실행 전 `select`로 확인한다.
