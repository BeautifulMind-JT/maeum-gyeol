# 웹 호스팅 기준

마음결의 웹 배포 대상은 **Cloudflare Pages**이며 기준 소스는 GitHub의 `main`이다. 정적 프론트엔드를 배포하며 인증·기록·사진은 기존 Supabase 프로젝트를 사용한다.

| 설정 | 값 |
|---|---|
| 공개 앱 | `https://maeum-gyeol.pages.dev/mobile/` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` (`build:cloudflare`도 동일) |
| Build output directory | `cloudflare-dist` |
| Root directory | 저장소 루트 |
| Node | `.node-version`의 `24.19.0` |

이 표는 운영 기준이다. 저장소 변경만으로 Cloudflare 대시보드의 Production branch나 Git 연결이 수정되지는 않는다.

## 빌드와 배포 식별

`npm ci && npm run build && npm run release:manifest`로 Pages 산출물과 파일별 SHA-256 목록을 만든다. 공개 Supabase 설정은 `config/production-public.json`에서 읽으며 서비스 역할 키를 사용하지 않는다.

배포 후 `/version.json`의 `commit`을 GitHub 배포 커밋과 대조한다. Pages는 `CF_PAGES_COMMIT_SHA`, CI는 `GITHUB_SHA`, 로컬은 Git HEAD를 사용한다. 이 파일은 캐시하지 않는다. UI가 예전처럼 보이면 먼저 커밋·Production branch·빌드 출력 폴더를 확인하고, 그 뒤 브라우저 캐시를 검사한다.

`/`는 `/mobile/`로 이동한다. 없는 자산은 실제 404를 반환한다. 서비스 워커는 최신 정적 자산을 먼저 받고, 계정 설정과 API 응답을 캐시하지 않는다. `release-manifest.json`은 Pages 헤더·리디렉션·404와 앱 자산까지 포함한다. 테스트용 예시 계정과 데이터는 운영 산출물에 포함되지 않는다.

## 중복 호스팅 정리

1. Pages의 Production branch를 `main`으로 설정하고 해당 커밋을 Production으로 배포한다.
2. 공개 주소의 `/version.json`, 홈·발견·로그인·개인 기록을 확인한다. OAuth 복귀 주소는 동일한 Pages origin의 `/mobile/`여야 한다.
3. 동일 이름의 **Workers** 프로젝트에 연결된 자동 빌드를 해제한다. Pages 프로젝트는 유지한다. Worker의 `workers.dev`가 비활성이라는 사실만으로 자동 빌드가 중지된 것은 아니다.
4. `vercel.json`의 `git.deploymentEnabled: false`는 이 설정이 포함된 소스의 Vercel Git 자동 배포를 끈다. 이전 브랜치까지 일괄 해제하려면 Vercel의 Git 연결도 해제한다. 기존 호스트에서만 남은 기록이나 아직 승인하지 않은 이전 작업이 없는지 확인한 후 오래된 주소를 정리한다. ([Vercel 공식 설정](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments))
5. Pages가 복구 브랜치를 더 이상 참조하지 않는 것을 확인한 후 병합된 복구 브랜치를 삭제한다.

Provider 접근과 실제 확인 없이 위 단계의 완료를 선언하지 않는다. 프로젝트·데이터베이스·Storage·인증 계정은 호스팅 정리 대상으로 삭제하지 않는다.

## 보존된 경로

- `npm run build:legacy`: 이전 Sites/D1 앱 빌드. `dist/`에는 원본 모델·마음챙김 안내·정적 자산이 있으므로 폴더 전체를 삭제하지 않는다.
- `/legacy/`: 기존 Sites의 이전 기록 화면으로 연결한다.
- `npm run build:production`: 기존 Vercel 형식의 수동 복구 빌드. Pages 빌드는 이 공통 앱 산출물에서 필요한 파일만 가져온다.
- `npm run build:vercel`: 별도 공개 환경 설정을 전달하는 Vercel 형식 빌드.

작업 브랜치는 병합 여부, 열린 PR의 head/base 의존성, 배포 연결 여부를 확인한 뒤 정리한다. 병합되지 않은 작업을 정리 목적으로 강제 삭제하거나 main에 임의로 합치지 않는다.
