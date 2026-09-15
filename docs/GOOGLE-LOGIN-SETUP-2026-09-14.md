# Google 로그인 연결 및 검증

2026-09-14, 개발 브랜치 `codex/journal-recovery-20260914`, Draft PR #2.

## 현재 상태

- 웹 앱의 Google 로그인, PKCE 코드 교환, 로그인 후 계정/기록 화면 복귀를 구현했다. 기존 숫자 이메일 인증은 유지한다.
- 최초 구현 시 전용 Supabase 프로젝트의 공개 Auth settings 조회 결과는 `google=false`, `email=true`, `disable_signup=false`였다. 소유자 설정 후 다시 조회한 결과는 `google=true`, `email=true`, `disable_signup=false`이며, 실제 Preview 계정 화면에서 `Google로 계속하기` 버튼 표시도 확인했다.
- 소유자가 보낸 화면에서 아래 고정 Preview 주소의 Redirect URLs 등록을 확인했다. 같은 화면의 Site URL은 `http://localhost:3000`이어서 운영 주소로 변경하도록 안내했고, 소유자는 변경을 완료했다고 답했다. Site URL의 저장 결과와 실제 Google 계정 인증 후 앱 복귀·세션 생성은 아직 직접 검증하지 않았다.
- 이후 테스트 브라우저에서 소유자가 Google 방식을 선택했고, Google의 실제 화면에 `400 오류: redirect_uri_mismatch`가 표시되었다. 현재 사용 중인 OAuth 클라이언트의 승인된 리디렉션 URI를 아래 Supabase callback 주소와 대조해야 한다. 같은 실패를 반복하거나 다른 로그인 방식으로 임의 전환하지 않았다.
- Google 공급자가 활성화된 경우에만 웹 계정 화면에 `Google로 계속하기`가 표시된다. 설정 조회 실패와 네이티브 앱에서는 이메일 로그인을 제공한다.
- 로그인 전에 남기던 연습 결과나 개인 내용이 있으면 페이지 이동이 없는 이메일 인증을 사용한다. 해당 내용을 OAuth 복귀용 저장소에 복사하지 않는다.
- 운영 승격과 main 병합은 이 변경에 포함하지 않는다. Preview도 기존 전용 Supabase를 사용하므로 실제 인증/저장 확인은 소유자가 선택한 계정과 합성 기록으로 진행한다.

## 소유자 설정

현재 연결된 도구에는 Google OAuth 클라이언트 발급 및 Supabase Auth 공급자 설정 변경 기능이 없다. 다음 값은 각 서비스의 관리 화면에 직접 입력한다. Client Secret을 채팅, GitHub, 앱 코드나 Vercel 환경 변수에 넣지 않는다.

1. [Google Auth Platform](https://console.cloud.google.com/auth/overview)에서 마음결용 프로젝트를 선택하거나 만든다. Branding에 앱 이름 `마음결`과 소유자 연락 이메일을 설정한다. Audience는 사용할 계정 범위에 맞게 설정하고, Testing 상태라면 테스트 사용자로 본인 Google 계정을 등록한다.
2. Data Access에는 기본 로그인 권한 `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`만 설정한다. Clients에서 **Web application** OAuth 클라이언트를 만든다.
3. 아래 Google 주소를 등록하고 발급된 Client ID와 Client Secret을 Supabase의 Authentication → Sign In / Providers → Google에 입력해 활성화한다.
4. Supabase Authentication → URL Configuration에서 **Site URL**을 아래 운영 주소로 입력하고 **Save changes**를 누른다. `http://localhost:3000`은 개발용 기본값이므로 그대로 두지 않는다. Site URL은 별도 복귀 주소가 없거나 허용되지 않을 때 사용할 기본 주소다.
5. 같은 화면의 **Redirect URLs**에 아래 Preview 복귀 주소를 추가한다. 이미 같은 주소가 등록되어 있으면 다시 추가할 필요는 없다. 기존에 필요한 허용 주소는 유지한다.

| 입력 위치 | 값 |
| --- | --- |
| Google — Authorized JavaScript origins | `https://maeum-gyeol-git-codex-journal-6ae18c-beautifulmind-jts-projects.vercel.app` |
| Google — Authorized redirect URIs | `https://vmvtpolyszkyachlqlki.supabase.co/auth/v1/callback` |
| Supabase — Site URL | `https://maeum-gyeol.vercel.app/mobile/` |
| Supabase — Redirect URLs (개발 Preview) | `https://maeum-gyeol-git-codex-journal-6ae18c-beautifulmind-jts-projects.vercel.app/mobile/` |

테스트는 위 고정 브랜치 Preview 주소에서 시작한다. 일회성 배포 주소를 사용하려면 그 주소의 `/mobile/`도 Supabase에 정확히 등록해야 한다. 로그인 시작과 복귀의 origin이 달라지면 브라우저에 보관된 PKCE 검증 값을 사용할 수 없다. 실제 운영 도입 때에는 운영 origin `https://maeum-gyeol.vercel.app` 및 복귀 주소 `https://maeum-gyeol.vercel.app/mobile/`도 등록한다. Google의 리디렉션 주소는 계속 Supabase `/auth/v1/callback`이다.

## 구현과 검증 범위

### 현재 오류를 고치는 순서

1. [Google Auth Platform의 Clients](https://console.cloud.google.com/auth/clients)를 연다.
2. Supabase에 Client ID를 입력했던 **웹 애플리케이션 클라이언트**를 선택한다.
3. **승인된 리디렉션 URI / Authorized redirect URIs**에서 **URI 추가**를 누른다.
4. `https://vmvtpolyszkyachlqlki.supabase.co/auth/v1/callback`을 정확히 입력하고 **저장**한다. 이 칸에는 Vercel 주소를 넣지 않는다.
5. 수정 완료 후 마음결 계정 화면에서 새로 Google 로그인을 시작한다. 이전 오류 페이지를 새로고침하는 방식으로 재사용하지 않는다.

오류의 의미: [Google 공식 redirect_uri_mismatch 설명](https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch).

### 구현

- `oauth.mjs`: 공급자 공개 설정 조회, 같은 origin `/mobile/` 복귀 주소, 신뢰하는 Supabase authorize URL만 허용, 단일 사용·20분 만료 이동 표식. 표식에는 화면 종류·시각·SDK의 비밀이 아닌 flow ID만 보관한다.
- SDK 인증 저장소가 PKCE verifier를 보관한다. 수동 `exchangeCodeForSession`을 사용하고 자동 URL 세션 감지는 끈다. 별도 Google API 권한이나 오프라인 접근은 요청하지 않는다.
- 최초 화면/요청 전에 URL 인증 필드를 정리한다. 취소·만료·검증 실패는 자격 증명을 노출하지 않는 안내와 계정 화면으로 복귀한다. 실패 때문에 기존 세션을 로그아웃시키지 않는다.
- callback 처리 중에는 조작을 잠시 막아 세션 변경으로 새 연습이 사라지는 경우를 방지한다. Google 이동 직전에도 화면·계정·미저장 상태를 다시 확인한다.
- 서비스 워커는 query가 있는 주소를 캐시에 넣지 않는다. HTML과 Vercel 헤더는 `Referrer-Policy: no-referrer`를 사용한다.
- 오프라인 회귀 검사는 실제 UI/초기화 코드를 VM으로 실행한다. 설치된 Supabase SDK로 PKCE challenge/verifier와 세션 교환을 검사하되, 네트워크 응답은 합성 fixture로 대체한다. 실제 Google 인증 완료를 의미하지 않는다.

Google 버튼 표시는 확인했다. 남은 확인은 [고정 Preview 계정 화면](https://maeum-gyeol-git-codex-journal-6ae18c-beautifulmind-jts-projects.vercel.app/mobile/#account)에서 **Google로 계속하기** → 본인 Google 계정의 동의 → 앱 복귀/주소 정리 → 로그아웃·재로그인 → 본인이 선택한 합성 기록 저장·재조회 순서다. 이메일 전송·실제 인증과 사진 저장은 별도 실사용 검증이 필요하다. 결과는 PR #2에 기록한다.

공식 근거: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [복귀 주소와 Site URL](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [이메일 OTP와 PKCE](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
