# Cloudflare Pages 시험 배포

사용자 요청: 기존 Vercel을 유지하면서 Cloudflare Pages 시험 배포를 준비한다.
이 문서는 실제 Cloudflare 배포 완료를 뜻하지 않는다. Google 로그인은 기존 Vercel 후보에서 사용자 화면과 서버의 Google identity를 대조해 완료했다. 새 호스트에서는 별도 검증이 필요하다.

## Git 연결 설정

| 항목 | 값 |
|---|---|
| 저장소 | BeautifulMind-JT/maeum-gyeol |
| 시험 프로젝트 이름 | maeum-gyeol-trial (사용 가능 여부는 생성 시 확인) |
| Production branch | codex/journal-recovery-20260914 |
| Framework preset | None |
| Root directory | 저장소 루트, 빈칸 |
| Build command | npm run build:cloudflare |
| Build output directory | cloudflare-dist |
| Environment variable | NODE_VERSION = 24.19.0 |

Cloudflare의 Production branch라는 명칭은 **이 별도 시험 프로젝트의 기본 브랜치**를 뜻한다. 기존 Vercel 운영이나 GitHub main 승격이 아니다. GitHub 연결은 해당 저장소로 한정한다. 유료 서비스나 Functions는 추가하지 않는다.

빌드는 기존 production-public.json의 공개 Supabase 설정과 고정된 앱 빌드를 재사용한다. 비밀 키를 입력하거나 업로드하지 않는다. 웹 파일만 복사하며 Vercel 설정 파일은 Pages 산출물에서 제외한다. 루트·레거시 리디렉션과 SW/공개 설정 캐시 정책, 보안 헤더를 Pages 형식으로 제공한다. 시험 사이트에는 noindex를 적용하고 없는 파일은 404로 처리한다. noindex는 접근 제한이 아니다.

## 주소가 생성된 다음

1. 실제 생성된 Pages 호스트의 `/mobile/`를 열어 화면과 정적 파일을 확인한다.
2. Supabase Auth Redirect URLs에 정확한 `https://실제호스트/mobile/`를 추가한다. 기존 Site URL과 기존 허용 주소는 이번 시험 중 유지한다.
3. 기존 Google OAuth 클라이언트의 Authorized JavaScript origins에 새 `https://실제호스트`를 추가한다. Supabase 프로젝트가 같으므로 Google의 Authorized redirect URI인 `https://vmvtpolyszkyachlqlki.supabase.co/auth/v1/callback`은 그대로다.
4. 로그인 시작과 복귀는 같은 Pages 호스트에서 수행한다. Vercel 브라우저 로그인 세션이 Pages에 자동 이전되지는 않는다.
5. 테스트 계정과 합성 기록으로 Google 로그인, 비공개 저장·새로고침, 사진, 공개 철회를 확인한다. 실제 사용자 기록은 테스트 데이터로 쓰지 않는다.

## 완료 판정

2026-09-15 로컬 확인: `npm run build:cloudflare` 성공, 산출물 39개·2,633,440 bytes. 모바일 앱 파일 35개 모두 같은 빌드의 Vercel 산출물과 SHA-256 일치. Pages 출력에서 vercel.json 제외 및 404.html 존재 확인. `git diff --check` 통과. Cloudflare 연결 도구가 없어 원격 배포·헤더 응답·새 호스트 인증은 아직 미검증이다.

- 로컬 빌드 성공과 Cloudflare 실제 빌드·배포 성공은 구분한다.
- 실제 배포에서 `/` 이동, `/mobile/` 화면, 없는 파일의 404, 보안·캐시 헤더, 배포 파일 해시를 확인한다.
- Supabase는 기존 운영 데이터베이스다. 호스트가 시험 주소여도 데이터가 격리된 것은 아니다.
- 운영 전환은 별도 작업이다. 전환 전 noindex 제거, 공식 도메인·인증 URL, 복귀 방법과 실제 이용 검증을 정리한다.

공식 참고: [Git 연결](https://developers.cloudflare.com/pages/get-started/git-integration/), [빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/), [헤더](https://developers.cloudflare.com/pages/configuration/headers/), [리디렉션](https://developers.cloudflare.com/pages/configuration/redirects/).
