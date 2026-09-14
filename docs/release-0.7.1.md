# 0.7.1 · 발견 조회 수정과 M0 재현

이 릴리스의 범위는 M0다. 실제 이메일 인증·사진 바이너리 저장·재접속의 M1, 공유·실패 복구의 M2는 별도 검증이며 완료로 보고하지 않는다.

변경 내용:
- public-records.mjs에서 작성자 외래 키를 명시하고 기본 피드·상세·대표 기록·소셜 RPC에 적용한다. 댓글 관계는 변경하지 않는다.
- 공통 모듈을 정적 자산 캐시에 포함한다. 디자인·개인 기록 보관 방침은 기존 기준을 따른다.
- Node 24.19.0, PostgreSQL 17.6, PostgREST 16.3으로 GitHub CI를 구성한다. 신규 DB에 저장소 SQL을 적용하고 운영 카탈로그 266개 항목과 대조한다.
- 같은 스키마·고정 데이터에서 기존 조회 실패 네 건과 수정 후 실제 클라이언트 조회·비공개 접근 등 일곱 건을 검사한다.
- 운영 공개 설정과 전체 배포 파일 목록·크기·SHA-256을 남겨 새 체크아웃 빌드 및 배포 비교를 가능하게 한다.
- 단계 명칭은 M0-IMPLEMENTATION.md의 M0–M5로 통일한다.

## 확인된 운영 DB 근거

2026-09-14 읽기 전용 조회에서 세 마이그레이션의 저장소 바이트와 운영 이력 SQL의 SHA-256이 모두 같았다. migration-map.json에 대응 번호와 체크섬을 기록했다. 번호를 바꾸거나 운영 SQL을 재실행하지 않았다. 카탈로그 스냅샷은 개인 기록·사용자 데이터 없이 구조·권한만 포함한다.

## 재현 명령

루트와 mobile에서 각각 npm ci를 수행한다. GitHub Actions m0.yml은 매번 새 체크아웃과 DB로 실행한다. 로컬에서 실제 API 검사를 하려면 같은 PostgreSQL 및 PostgREST를 별도로 실행하고 prerequisites.sql, migrations, seed.sql 순서로 적용한다. 이 fixture는 운영에서 실행하지 않는다.

```sh
npm test
npm --prefix mobile test
MAEUM_TEST_REST_URL=http://127.0.0.1:54323 npm run test:api
npm run build:production
npm run release:manifest
```

build:production은 공개 설정 파일을 사용하며 서버 비밀 키는 필요하지 않다. 기본 build:vercel은 환경 변수로 다른 허용된 Supabase 프로젝트를 지정할 수 있다. 현재 공개 설정 변경은 별도 코드 변경으로 검토한다.

## 검증 근거와 한계

이 문서는 검사 명세다. 해당 GitHub 커밋의 CI 실행 결과와 m0-커밋SHA artifact가 실제 실행 근거다. artifact에는 vercel-dist, release-manifest.json, recreated-schema.json이 들어간다. CI가 성공하지 않은 커밋을 M0 완료로 표시하지 않는다.

배포 보고는 업로드 목록의 누락·추가, 파일별 HTTP 바이트 일치, 배포 제어 파일의 설정 일치를 구분한다. 플랫폼 원격 전체 파일 목록을 얻지 못했다면 ‘예상 목록의 파일 모두 확인’과 ‘추가 파일 없음’을 구분하여 후자를 미확인으로 남긴다.

현재 M1·M2까지 검증한 복귀 배포는 미확보다. M0 통과는 전체 제품 안정성의 증명이 아니다. 과거 배포를 단지 더 오래됐다는 이유로 복귀 안정판으로 지정하지 않는다.
