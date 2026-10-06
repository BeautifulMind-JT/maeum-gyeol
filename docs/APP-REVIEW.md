# App Store 심사 준비 (로그인 경로·메타데이터)

마음결 로그인은 이메일 OTP뿐이라 Apple 심사자가 로그인할 수 없다. 이를 위해
**빌드에 지정한 검수용 이메일에 한해 비밀번호 로그인**을 제공한다
(`mobile/src/cloud-ui.mjs`). 비밀번호나 비밀 값은 저장소에 커밋하지 않는다.

## 동작 방식

- `MAEUM_REVIEWER_EMAIL` 환경변수가 설정된 빌드에서만 활성화된다.
  이메일만 `cloud-config.json`에 포함되고, 비밀번호는 Supabase Auth에만 있다.
- 로그인 화면에서 해당 이메일을 입력하면 OTP 대신 비밀번호 입력란이 열리고,
  `signInWithPassword`로 로그인한다. 다른 이메일은 기존 OTP 흐름 그대로다.
- 환경변수 없이 빌드하면 비밀번호 로그인 경로는 렌더링되지 않는다.

## 준태가 할 일 (체크리스트)

1. **데모 계정 생성**: Supabase 대시보드(`vmvtpolyszkyachlqlki`) → Authentication
   → Add user → 이메일(예: 본인이 관리하는 전용 주소) + 강한 비밀번호,
   *Auto Confirm User* 체크. 이 계정으로 한 번 로그인해 프로필·예시 기록
   1~2개(비공개 1, 공개 1)를 만들어 두면 심사가 수월하다.
2. **iOS 스토어 빌드 시 환경변수 추가**:

   ```sh
   MAEUM_SUPABASE_URL=... \
   MAEUM_SUPABASE_PUBLISHABLE_KEY=... \
   MAEUM_IOS_TEAM_ID=... \
   MAEUM_REVIEWER_EMAIL=<데모 계정 이메일> \
   npm --prefix mobile run build:ios
   ```

3. **운영자 정보 확정**: `config/operator.json`의 `{{...}}` 자리표시자를 실제
   값으로 바꾸고 웹을 재배포한다(`/privacy`, `/terms`, `/support`에 반영).
4. **TestFlight 업로드**: 첫 IPA는 `docs/TESTFLIGHT.md`의 GitHub Actions
   워크플로로 올린다. `MAEUM_REVIEWER_EMAIL` 시크릿이 스토어 빌드에 들어간다.
5. **App Store Connect 설정**:
   - App Privacy의 개인정보처리방침 URL: `https://maeum-gyeol.pages.dev/privacy/`
   - 지원 URL: `https://maeum-gyeol.pages.dev/support/`
   - App Review Information → Sign-in required 체크, 데모 계정 이메일/비밀번호 입력.
6. **심사 노트 붙여넣기**: 아래 텍스트에서 `<DEMO_EMAIL>`/`<DEMO_PASSWORD>`만
   바꿔 Review Notes에 입력한다.

## App Store Connect 심사 노트 (복사용)

```text
Sign-in: the app normally uses email one-time codes. For App Review, a
password sign-in is enabled for the demo account below.

1. Tap the account icon (top right) or 설정 → 로그인.
2. Check the consent checkbox "(필수) 이용약관과 개인정보처리방침에 동의해요".
3. Enter email: <DEMO_EMAIL> and tap "인증번호 받기".
4. A password field appears for this account. Enter: <DEMO_PASSWORD> and tap
   "검수 계정으로 로그인". No email access is needed.

UGC safety: every public post has 신고 (report, reviewed within 24 hours) and
every profile has 차단 (block). Terms with a zero-tolerance policy must be
accepted at sign-up: https://maeum-gyeol.pages.dev/terms/
Privacy policy: https://maeum-gyeol.pages.dev/privacy/
Support: https://maeum-gyeol.pages.dev/support/
The app is a mindfulness journal, not a medical or counseling service; a
crisis-resources notice (Korean hotlines 109, 1577-0199, 112, 119) is shown on
first launch and available under 설정 → 안전 안내.

Account deletion: 설정 → 계정 관리 → 계정 삭제 (in-app, immediate).
Practice (3-minute mindfulness) works without an account.
```

## 참고

- 데모 계정도 일반 사용자와 같은 RLS 적용을 받는 평범한 계정이다. 서버 정책,
  Auth 설정, 마이그레이션 변경은 없다.
- 심사 후 비밀번호 로그인을 끄려면 `MAEUM_REVIEWER_EMAIL` 없이 다시 빌드하거나
  Supabase에서 데모 계정 비밀번호를 제거/계정을 삭제하면 된다.
