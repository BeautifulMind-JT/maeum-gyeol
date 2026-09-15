# Cloudflare 운영 인계

사용자는 Cloudflare 이전 완료를 보고한 뒤 main 통합과 기존 배포 정리를 요청했다. 이번 요청은 기존 시험 배포 범위를 확장하는 운영 인계 승인이다.

## 확인된 근거

- Cloudflare Pages 프로젝트: `maeum-gyeol`, 주소: https://maeum-gyeol.pages.dev/mobile/
- 커밋 `a3e4d0be721bc6a215692c02d928453594259c7a`의 GitHub Cloudflare Pages check가 success다. 배포 ID: `18e8a67f-d78a-4f81-bdda-0f72acd4685e`.
- 같은 코드의 M0 CI run `34937600192` 성공. 이는 실제 사용자 데이터 저장 전체의 검증이 아니다.
- 사용자가 새 Redirect URL 추가 완료를 보고하고 로그인된 계정 화면을 제공했다. 화면에 주소창이 없어 Pages origin까지 독립 대조한 것은 아니다.
- 에이전트의 공개 URL 조회는 접근 제한으로 실패했다. 실제 HTTP 헤더·원격 파일 전체 해시 검증은 미완료다.

## 이번 변경

- 기본 Pages 호스트의 noindex 제거. `*.maeum-gyeol.pages.dev` 미리보기에는 noindex 유지.
- 기존 CI에서 Cloudflare 빌드까지 실행하고 Cloudflare와 Vercel 산출물을 함께 보관한다. 앱 코드를 별도로 바꾸지 않는다.
- PR #2를 자동 검사 후 main에 통합한다. 통합 상태와 정확한 SHA는 GitHub PR 및 Checks를 기준으로 확인한다.

## 대시보드에서 남은 설정

1. PR #2가 main에 통합된 후 Cloudflare 프로젝트의 Production branch를 `main`으로 변경한다. Build command는 `npm run build:cloudflare`, output은 `cloudflare-dist`, NODE_VERSION은 `24.19.0`이다.
2. main의 최신 커밋을 배포하고 Pages 배포 성공과 실제 앱 접속을 확인한다. 기본 브랜치 변경만으로 새 빌드가 실행되지 않으면 main 배포를 시작한다.
3. 운영 기준 주소를 Pages로 확정할 때 Supabase Site URL을 `https://maeum-gyeol.pages.dev/mobile/`로 변경한다. Redirect URLs의 같은 주소와 기존 Vercel 허용 주소는 복귀 검증 동안 유지한다.
4. 기존 Vercel Git 연결은 Pages main 배포 확인 뒤 해제해 중복 자동 배포를 멈춘다. 현재 Vercel 프로젝트와 마지막 정상 배포는 복귀용으로 보존한다. 프로젝트 삭제나 요금제 변경은 수행하지 않는다.
5. 잘못 생성했던 Cloudflare Worker는 Pages와 별개다. 사용 여부를 확인하지 않고 삭제하지 않는다.

현재 연결 도구에는 Cloudflare 프로젝트 설정 및 Supabase Auth 설정 수정 기능이 없다. 위 설정을 코드만으로 변경했다고 주장하지 않는다. main 푸시는 기존 Vercel 연결이 유지되는 동안 Vercel 운영 배포도 유발할 수 있다.

## 남은 제품 검증

테스트 계정·합성 기록으로 비공개 저장/새로고침, 사진 재조회, 공개 철회, 계정 분리 등을 확인한다. 로그인된 스크린샷을 저장·사진·공개 철회의 완료 증거로 취급하지 않는다. M0/M1/M2 전체 완료 상태를 자동으로 올리지 않는다.
