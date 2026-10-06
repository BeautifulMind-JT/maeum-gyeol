# 마음결 모바일 · 0.7.1 소스

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

iOS는 macOS/Xcode에서 자신의 Signing Team을 설정해야 합니다. 이 환경에서 iOS 컴파일과 실기기 실행은 하지 않았습니다. 버전 소스는 0.7.1/8이지만 새 APK·IPA를 생성하거나 스토어에 올리지 않았습니다.

## iOS 릴리스 빌드 · 서명 · TestFlight

첫 TestFlight 업로드는 GitHub Actions **iOS TestFlight** 워크플로(`workflow_dispatch`만)를 사용합니다. 준태용 순서는 루트 `docs/TESTFLIGHT.md`입니다. 인증서와 `.p8`은 저장소에 두지 않습니다.

로컬 macOS + Xcode 26 이상에서만 아카이브할 때는 Team ID와 검수 이메일을 환경 변수로 주입합니다.

```sh
MAEUM_SUPABASE_URL=... \
MAEUM_SUPABASE_PUBLISHABLE_KEY=... \
MAEUM_IOS_TEAM_ID=XXXXXXXXXX \
MAEUM_REVIEWER_EMAIL=review@example.com \
npm run build:ios
```

- `MAEUM_IOS_TEAM_ID`는 [Apple Developer Membership](https://developer.apple.com/account)의 10자리 Team ID입니다. 스크립트가 `xcodebuild`의 `DEVELOPMENT_TEAM`으로 전달하고, `ios/App/ExportOptions.plist`의 `MAEUM_IOS_TEAM_ID` 자리표시자를 치환한 사본을 `ios/App/build/`(커밋 제외)에 만들어 사용합니다. 템플릿에 실제 Team ID를 커밋하지 않습니다.
- 스토어 모드(`MAEUM_BUILD_MODE=store`, 스크립트가 자동 설정)에서는 Supabase 두 변수와 `MAEUM_REVIEWER_EMAIL`이 없으면 빌드가 즉시 실패합니다. 계정 기능이 꺼진 빌드가 스토어에 올라가는 일을 막기 위함입니다. 공개 값은 `../config/production-public.json`에 있습니다. 검수 비밀번호는 넣지 않습니다.
- 서명은 자동 서명(`-allowProvisioningUpdates`)을 사용합니다. 로컬에서는 Xcode에 App Store Connect 계정이 로그인되어 있어야 하고, CI에서는 `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_PATH`를 사용합니다. 인증서·프로비저닝 프로파일은 저장소에 두지 않습니다.
- 성공하면 `ios/App/build/export/App.ipa`가 생성됩니다. Actions 워크플로가 TestFlight에 올리거나, 로컬에서는 Transporter / Xcode Organizer를 사용합니다.
- 첫 제출 전에 App Store Connect에서 앱 생성(번들 ID `app.maeumgyeol.mobile`), 기본 언어(한국어), 유니버설 iPhone+iPad, 개인정보 처리방침 URL, 심사용 데이터 수집 설문(이메일·이름·사용자 ID·사진·사용자 콘텐츠, 계정 연결, 추적 없음 — `ios/App/App/PrivacyInfo.xcprivacy`와 일치)을 준비해야 합니다. 문구 초안은 `docs/APP-STORE-METADATA.md`입니다.
- 타깃은 유니버설(`TARGETED_DEVICE_FAMILY = 1,2`)입니다. 실기기 검증은 아직 남아 있습니다.

운영 DB에는 서버 초안 마이그레이션이 적용되어 있습니다. 저장소와 운영 이력의 대응은 `../docs/migration-map.json`을 확인합니다. M1·M2 실제 이용 검증과 최신 설치본 검증은 아직 별도 단계입니다.
