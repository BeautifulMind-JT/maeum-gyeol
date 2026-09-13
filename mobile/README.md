# 마음결 모바일 · 0.7.0 소스

웹과 Android/iOS가 `src/`의 화면·마음챙김 안내·Supabase API를 공유합니다. 디자인은 선택된 1안 ‘여름의 표지’입니다. 상세 변경과 운영 반영 상태는 루트 README와 design-qa.md를 확인합니다.

새 기록·사진·초안은 로그인한 계정의 서버에만 저장합니다. 연습은 로그인 없이 가능하며, 오프라인 입력은 앱 실행 중 메모리에만 있습니다. 백업/수동 동기화 메뉴는 없습니다. 이전 버전의 기기 기록은 서버 이전이 확인된 후에만 지웁니다.

```sh
npm ci
npm run build
npm run sync
npm run android
npm run ios
```

루트에서도 `npm ci`가 필요합니다. `MAEUM_SUPABASE_URL`, `MAEUM_SUPABASE_PUBLISHABLE_KEY`를 환경 변수로 지정합니다. 두 설정 없이 빌드하면 계정 기록 기능은 준비되지 않으며 로컬 저장으로 대체하지 않습니다. SMTP 비밀번호와 서버 비밀 키는 앱에 넣지 않습니다.

Android는 JDK 21, Android SDK 36, Build Tools 35.0.0 환경에서 빌드합니다. 기존 개발 서명 키 경로를 `MAEUM_PREVIEW_KEYSTORE`에 설정하고 `npm run build:android`를 실행합니다. 패키지는 `app.maeumgyeol.mobile.preview`이며 개발 서명은 스토어 서명이 아닙니다.

iOS는 macOS/Xcode에서 자신의 Signing Team을 설정해야 합니다. 이 환경에서 iOS 컴파일과 실기기 실행은 하지 않았습니다. 버전 소스는 0.7.0/7이지만 새 APK·IPA를 생성하거나 스토어에 올리지 않았습니다.

0.7.0을 배포하기 전에 기존 Supabase에 `20260911045757_cloud_only_journal.sql`을 적용해야 합니다. 현재 Vercel/Supabase 프로젝트 접근이 거절되어 운영 반영은 대기 중입니다. 과거 설치 파일이 자동으로 갱신되지는 않습니다.
