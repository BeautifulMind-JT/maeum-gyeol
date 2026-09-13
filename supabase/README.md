# 마음결 계정 저장소 연결

## 현재 상태

2026-09-10: 사용자에게 소유 조직을 확인받고 비용 확인 도구의 월 $0 결과에 따라 마음결 전용 Supabase 프로젝트를 생성했습니다. `maeum-gyeol`은 서울 리전에서 정상 동작 중이며, 기록·프로필·공개 글·댓글 스키마와 접근 권한을 실제 PostgreSQL 17에 적용했습니다. 기존 `test`, `soulbound` 프로젝트는 변경하지 않았습니다.

실제 서버에서 역할별 권한·공개 철회·삭제·동기화 RPC 검증을 통과했습니다. 공개 글과 댓글의 PostgREST 관계 조회는 HTTP 200, 비로그인 비공개 기록 조회는 HTTP 401/권한 거부로 확인했습니다. SQL 권한 검증에 사용한 테스트 사용자와 기록은 하나의 트랜잭션에서 검증 후 모두 롤백했습니다.

추가 검증: 사용자가 Gmail SMTP와 인증번호 템플릿 설정을 완료했습니다. 실제 인증메일 요청 HTTP 200, 받은편지함 도착, 8자리 인증번호로 Supabase 세션 발급, 해당 세션으로 비공개 임시 기록 저장·조회·삭제 표시까지 모두 통과했습니다. 검증 후 그 테스트 세션만 로그아웃했습니다. 임시 기록의 본문은 비웠고 동기화용 삭제 표시는 남습니다. 일반 이용자의 실제 브라우저·기기 동작 전체를 검증했다는 뜻은 아닙니다.

서버 연결본 웹 배포가 성공했습니다: [마음결](https://maeum-gyeol.justice-parkit.chatgpt.site). 이전 웹 기록은 `/legacy/`에 남습니다. Android 0.2.0 미리보기 APK를 빌드하고 포함된 서버 연결 설정·번들·패키지 이름·서명을 검증했습니다. iOS 소스와 연결 설정도 갱신했으며, 실제 휴대폰 실행 및 iOS 컴파일은 남아 있습니다.

## 연결할 구성

- 전용 프로젝트: `maeum-gyeol`, 서울 `ap-northeast-2`
- 프로젝트 ID: `vmvtpolyszkyachlqlki`
- [Supabase 프로젝트 대시보드](https://supabase.com/dashboard/project/vmvtpolyszkyachlqlki)
- API URL: `https://vmvtpolyszkyachlqlki.supabase.co`
- PostgreSQL: `mg_profiles`, `mg_entries`, `mg_public_entries`, `mg_comments`
- Supabase Auth: 이메일 인증번호 로그인. 모바일과 웹에서 동일 계정을 사용합니다.
- 웹 호스팅: Vercel이 현재 앱을 제공하며 기존 Sites는 이전 기록 접근용으로 유지합니다.
- 0.6.0: 비공개 Storage 사진, 팔로우·좋아요·신고·차단·소식 테이블을 추가했습니다. 사진을 포함한 현재 동작과 한계는 루트 README를 참고합니다.

조직: `justice.parkit@gmail.com's Org` (`cxyhtdilycvfwrasgwur`). 월 $0은 생성 도구가 안내한 현재 프로젝트 비용이며, 향후 유료 전환·초과 사용·외부 메일 발송 서비스 비용을 포함한 영구 무료 보장이 아닙니다.

## 데이터와 권한

`mg_entries`에는 비공개 원본과 돌아보기 대화가 들어갑니다. RLS가 본인만 읽고 쓸 수 있게 제한합니다. 공개할 때에는 트리거가 허용된 필드만 `mg_public_entries`에 복사합니다. 클라이언트에는 공개 테이블을 직접 쓸 권한을 부여하지 않습니다. 돌아보기 답변은 공개 테이블의 열로 존재하지 않습니다.

공개를 철회하면 공개 사본과 달린 댓글을 제거합니다. 개인 원본은 유지합니다. 기록 삭제는 내용을 비우고 ID·버전·삭제 상태를 남겨, 오래 오프라인이었던 기기가 삭제한 글을 되살리지 못하게 합니다. 계정 삭제 시에는 Auth 사용자와 모든 관련 데이터가 삭제됩니다.

원격 저장은 버전과 요청별 UUID로 처리합니다. 응답을 잃고 재시도해도 같은 변경을 중복 적용하지 않습니다. 두 기기의 수정이 충돌하면 기존 서버 내용을 유지하면서 오프라인 수정본을 별도 비공개 기록으로 보관합니다. 계정별 로컬 파일은 프로젝트와 사용자 ID를 함께 사용합니다. 전송할 때 사용자 토큰을 고정해 도중에 다른 계정으로 바뀌어도 이전 기록이 다음 계정으로 전송되지 않게 했습니다.

## 기존 기록

- 이전 APK의 기기 기록은 이전 앱에서 JSON 백업한 뒤 새 ‘마음결 미리보기’ 앱의 설정 → 가져오기로 복원합니다. 로그인 후 ‘이 기기의 이전 기록 가져오기’에서 확인하고 계정에 옮깁니다. 서버 저장이 끝나기 전에는 원본을 지우지 않습니다.
- 이전 웹의 D1 기록과 댓글은 기존 데이터베이스에 보존합니다. `/legacy/`에서 접근할 수 있습니다.
- 모바일 웹 계정 화면의 ‘이전 웹 기록 가져오기’는 기존 ChatGPT 로그인으로 본인 기록을 확인한 뒤 새 계정에 비공개로 가져옵니다. 이메일 주소 일치만으로 계정을 자동 연결하지 않습니다.
- 이전 웹의 댓글과 작성자 관계는 자동 변환하지 않습니다. 이전 보관함에 남습니다. 새 Supabase 공개 공간의 글·댓글은 앱과 웹이 공유합니다.
- 가져오기와 JSON 복원은 같은 ID의 기존 기록을 덮어쓰지 않습니다. JSON 백업의 댓글은 열람용 아카이브이며 댓글 재게시 기능은 제공하지 않습니다.

## 메일 설정과 남은 출시 작업

1. 현재 테스트용 [SMTP 설정](https://supabase.com/dashboard/project/vmvtpolyszkyachlqlki/auth/smtp): `smtp.gmail.com`, 포트 `587`, 발신자 `마음결`. 사용자가 앱 비밀번호를 직접 등록했으며 비밀번호는 앱이나 소스에 포함하지 않았습니다. 정식 출시 전에는 서비스 전용 메일 발송 구성을 준비합니다.
2. [이메일 템플릿](https://supabase.com/dashboard/project/vmvtpolyszkyachlqlki/auth/templates)의 Magic Link와 Confirm signup에 `{{ .Token }}`을 포함하도록 사용자가 설정했습니다. 실제 받은 메일의 제목은 `마음결 로그인 인증번호`이며 숫자 인증번호를 포함했습니다. 이메일 확인은 활성화 상태를 유지합니다. 재설정용 본문은 `auth/email-otp.html`을 참고합니다.
3. 실제 Auth 세션과 서버 저장은 검증했습니다. 추가로 서로 다른 실제 기기에서 로그인·오프라인 편집·재접속 경험을 확인합니다. 브라우저 조작이나 휴대폰 실기기 검증은 아직 수행하지 않았습니다.
4. Android 미리보기 빌드는 완료했습니다. iOS는 Mac에서 서명·빌드하고, 양쪽 스토어용 서명·심사 준비를 진행합니다. `maeum_internal`은 Data API 노출 스키마에 추가하지 않습니다.

프로젝트 URL과 활성 `sb_publishable_` 키만 빌드에 제공합니다. 두 공개 설정은 사이트 환경변수에도 등록했습니다. 이 앱은 **빌드 시점**에 설정을 포함하므로, 사이트 런타임 환경변수 등록만으로 기존 배포본이 바뀌지는 않습니다. 재빌드할 때도 해당 값을 빌드 프로세스에 제공해야 합니다. 서버 비밀 키나 `service_role` 키는 앱에 넣지 않습니다. 실제 설정 값은 소스에 커밋하지 않습니다.

```sh
npm ci
npm test
npm run build
cd mobile
npm ci
npm run sync
```

빌드는 `MAEUM_SUPABASE_URL`, `MAEUM_SUPABASE_PUBLISHABLE_KEY` 환경변수를 읽습니다. 둘 다 비어 있으면 기존 기기 저장 모드가 유지됩니다. 하나만 있거나 비밀 키 형식이면 빌드를 실패시킵니다. Supabase 설정이 포함된 웹 버전은 루트에서 `/mobile/`로 연결하고, 이전 웹 보관함은 `/legacy/`로 유지합니다.

기존 APK는 자동으로 서버 저장 기능을 얻지 않습니다. 최초 debug 서명 키가 남아 있지 않아 새 Android 미리보기는 `app.maeumgyeol.mobile.preview` 패키지로 분리했습니다. 기존 앱을 지우지 않고 함께 설치할 수 있습니다. 새 개발용 서명 키를 별도로 보관하고 이후 미리보기 업데이트에서도 같은 키를 사용합니다. 빌드 및 기록 이전 절차는 `../mobile/README.md`를 참고하세요.

## 검증 범위

`tests/cloud.test.mjs`는 PGlite의 PostgreSQL 18 엔진에서 실제 SQL·RLS·트리거를 실행하고 두 기기의 동기화를 검증합니다. 테스트 항목은 계정 분리, 공개 필드 제한, 댓글·공개 철회, 응답 유실 재시도, 수정 충돌, 삭제 후 복원 방지, 계정 삭제 이후 JWT 접근, 전송 중 추가 편집입니다.

추가로 `verify-hosted.sql`을 실제 Supabase PostgreSQL 17.6에 실행해 본인만 원본 조회, 공개 필드 제한, 댓글·공개 철회, 중복 요청·수정 충돌, 삭제 표시, 계정 삭제 후 접근 차단을 확인했습니다. SQL은 테스트 데이터가 남지 않도록 롤백합니다. 공개 글·댓글의 실제 PostgREST 관계 조회도 확인했습니다.

Security Advisor 지적은 0건입니다. Performance Advisor는 새 프로젝트에서 아직 사용되지 않은 인덱스 5개를 정보 수준으로 표시했습니다. 조회와 외래키에 필요한 인덱스이므로 유지했습니다. [Unused index 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

실제 Auth 서비스의 인증메일 수신·로그인·저장·조회·삭제·로그아웃은 API로 확인했습니다. 실제 기기 간 동작, 더 넓은 수신자 도메인에 대한 메일 전달률, 스토어 배포 검증은 남아 있습니다. 정식 출시 전에는 선택한 요금제의 백업 보존·복구 설정도 확인해야 합니다.

## 참고한 공식 문서

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
