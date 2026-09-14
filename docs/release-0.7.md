# 0.7.0 운영 반영 체크포인트 (과거 기록)

현재 실행 지침은 release-0.7.1.md와 development-blueprint.md입니다. 아래 접근 거절과 마이그레이션 대기는 당시 상태이며 지금 다시 적용하라는 지시가 아닙니다.

작성: 2026-09-11. 현재 코드 구현/로컬 검증 완료 후 운영 연결 복구 대기.

## 기존 프로젝트

- Vercel: `prj_1AzuGFjZoKshpFpqzJT5qASWhylw`, team `team_58fJnbPnwPnndI2kkAPfyLc3`, scope `beautifulmind-jts-projects`.
- Supabase: `vmvtpolyszkyachlqlki`.
- Sites source project: `appgprj_6a9f917b9fac8191bd881cc54518598f`.

Vercel은 기존 scope 접근에 403, Supabase는 프로젝트 쿼리에 permission denied를 반환했다. 운영 DB에 새 마이그레이션을 적용하지 않았고 운영 웹을 새 버전으로 배포하지 않았다. 다른 Soulbound 프로젝트를 대체 자원으로 사용하지 않았다.

## 재개 순서

1. 마음결 프로젝트를 소유한 계정/팀으로 Vercel과 Supabase 연결을 복구한다.
2. 기존 DB 이력을 조회하여 `20260911045757_cloud_only_journal.sql`의 미적용 여부를 확인하고 적용한다. 기존 두 마이그레이션과 schema.sql 전체를 다시 실행하지 않는다.
3. `mg_drafts`의 owner SELECT 정책, 직접 쓰기 권한 회수, `mg_commit_draft`/`mg_save_entry`의 authenticated-only 권한을 확인한다.
4. 별도 테스트 계정으로 이메일 OTP, 새 초안, 다른 기기 복구, 기존 기록 수정, 사진 첨부, 비공개/공개 전환, 계정 삭제를 검증한다. Supabase security advisors도 확인한다.
5. 환경 변수의 공개 설정으로 `node scripts/build-vercel.mjs`를 실행하고 새 `vercel-dist/`를 기존 Vercel 프로젝트에 배포한다. READY 및 실제 URL 화면/저장 동작을 확인한다.
6. 동일 설정으로 Capacitor sync, Android 서명 빌드 및 macOS에서 iOS 빌드를 진행한다. 현재 0.7.0 APK/IPA는 생성되지 않았다.

## 호환성 및 제한

- 새 앱은 `mg_drafts`/새 RPC에 의존하므로 DB보다 먼저 배포하면 기록 기능이 실패한다.
- DB 변경은 기존 mg_commit_entry를 유지한다. 이미 설치된 이전 앱의 기기 저장 동작까지 원격으로 바꾸지는 못한다. 새 버전 업데이트가 필요하다.
- 새로운 오프라인 기록 저장은 지원하지 않는다. 사용자 입력은 실행 중 메모리에만 존재하며 서버 응답으로 완료 여부를 구분한다.
- 이전 계정/게스트 기록의 일회성 이전은 서버 확인 전 로컬 원본을 삭제하지 않는다. 충돌·오류 시 원본 보존과 재시도 안내가 우선한다.
- 개발 서버의 예시 계정과 오류 주입 API는 `tests/fixtures/`에만 있다. 운영 번들에 포함되지 않는다.
