# TestFlight 첫 업로드 (준태)

이 문서는 **박준태**가 Apple 계정·App Store Connect·GitHub 비밀 값을 준비하고,
저장소의 수동 워크플로로 IPA를 TestFlight에 올리는 순서다. 워크플로는
`workflow_dispatch`만 받는다. push/PR마다 돌지 않으므로 유료 macOS 분을
자동으로 쓰지 않는다.

관련 문서: [APP-REVIEW.md](APP-REVIEW.md) (검수 로그인),
[APP-STORE-METADATA.md](APP-STORE-METADATA.md) (스토어 문구).

비밀 키·`.p8` 파일·Team ID 실값·데모 비밀번호는 커밋하지 않는다.

## 필요한 GitHub Actions secrets

저장소 **Settings → Secrets and variables → Actions → New repository secret**.
이름은 아래와 **완전히 같아야** 한다. 하나라도 비면 워크플로가 아카이브 전에
실패한다.

| 이름 | 넣을 값 |
|---|---|
| `MAEUM_IOS_TEAM_ID` | Apple Developer 멤버십의 10자리 Team ID (영문 대문자+숫자) |
| `ASC_KEY_ID` | App Store Connect API 키의 Key ID |
| `ASC_ISSUER_ID` | App Store Connect → Users and Access → Integrations → Issuer ID (UUID) |
| `ASC_KEY_P8` | 내려받은 `.p8` 파일 **전체**. PEM 머리글·바닥글을 포함해 실제 줄바꿈을 유지한다. 이스케이프된 한 줄 문자열로 넣지 않는다. |
| `MAEUM_REVIEWER_EMAIL` | 검수용 데모 계정의 이메일. 비밀번호가 아니다. [APP-REVIEW.md](APP-REVIEW.md) |
| `MAEUM_SUPABASE_URL` | `config/production-public.json`의 `url` (`https://….supabase.co`) |
| `MAEUM_SUPABASE_PUBLISHABLE_KEY` | 같은 파일의 `publishableKey` (`sb_publishable_`로 시작) |

서비스 역할 키, SMTP 비밀번호, Auth 시크릿은 넣지 않는다. 공개 Supabase 두
값은 이미 저장소의 `production-public.json`에 있다. 스토어 빌드가 환경 변수만
읽으므로 시크릿으로 한 번 더 넣는다.

## 1. Apple Developer 등록

1. [Apple Developer](https://developer.apple.com/account)에 Apple ID로 로그인한다.
2. 개인(Individual) 또는 조직(Organization) 프로그램에 등록하고 연회비를 결제한다.
   승인까지 시간이 걸릴 수 있다. 승인 전에는 앱을 만들거나 API 키를 쓸 수 없다.
3. Membership 화면에서 **Team ID** 10자리를 복사해 `MAEUM_IOS_TEAM_ID`로 넣는다.
4. Certificates, Identifiers & Profiles → Identifiers → **App IDs**에서
   Bundle ID `app.maeumgyeol.mobile`을 등록한다. Description은 마음결.
   Capability는 기본값으로 두고, 결제를 추가하지 않는다.

이 저장소의 iOS 타깃은 유니버설(iPhone+iPad, `TARGETED_DEVICE_FAMILY = 1,2`),
기본 언어 한국어, 표시 이름 마음결이다.

## 2. App Store Connect 앱 레코드

1. [App Store Connect](https://appstoreconnect.apple.com) → My Apps → (+) → New App.
2. Platforms: **iOS**.
3. Name: `마음결` (스토어에 보이는 이름. 이미 쓰인 이름이면 뒤에 구분자).
4. Primary language: **Korean**.
5. Bundle ID: `app.maeumgyeol.mobile`.
6. SKU: `maeumgyeol` (스토어에 보이지 않는 내부 값. 한 번 정하면 바꾸기 어렵다).
7. User Access: Full Access.

앱을 연 뒤:

- **Privacy Policy URL:** `https://maeum-gyeol.pages.dev/privacy/`
- **Support URL:** `https://maeum-gyeol.pages.dev/support/`
- 카테고리·연령 등급·개인정보 설문·스크린샷은
  [APP-STORE-METADATA.md](APP-STORE-METADATA.md)를 붙여 넣는다.
- App Review Information → Sign-in required, 데모 이메일/비밀번호는
  [APP-REVIEW.md](APP-REVIEW.md).
- `config/operator.json`의 `{{...}}`를 실제 운영자 정보로 바꾸고 웹을 다시
  배포하기 전에는 개인정보/지원 페이지에 ‘확정 전’이 남을 수 있다.

## 3. App Store Connect API 키

Xcode에 Apple ID를 로그인하지 않는 GitHub Actions용이다. 자동 서명과
TestFlight 업로드에 같은 키를 쓴다.

1. App Store Connect → Users and Access → Integrations → **App Store Connect API**.
2. **Issuer ID**를 복사해 `ASC_ISSUER_ID`로 넣는다.
3. Keys → Generate API Key.
   - Name: `maeum-gyeol-testflight`
   - Access: **App Manager** (빌드 업로드·자동 서명에 필요. Admin은 과하다.)
4. 생성된 **Key ID**를 `ASC_KEY_ID`로 넣는다.
5. **Download**를 눌러 `.p8`을 받는다. **한 번만** 받을 수 있다. 키 파일을
   암호가 있는 로컬 보관함에 두고 저장소·채팅·스크린샷에 올리지 않는다.
6. 텍스트 편집기로 `.p8`을 열어 전체 내용을 `ASC_KEY_P8`에 붙인다.

키가 유출되면 App Store Connect에서 즉시 Revoke하고 새로 만든다.

## 4. GitHub 시크릿 등록

1. GitHub → `BeautifulMind-JT/maeum-gyeol` → Settings → Secrets and variables
   → Actions.
2. 위 표의 7개를 만든다. 이름 오타가 나면 워크플로가
   `Missing required secrets: …`로 바로 실패한다.
3. 값 확인은 GitHub UI에서 다시 볼 수 없다. 잘못된 것 같으면 값을 덮어 쓴다.

## 5. 워크플로 실행

1. GitHub → Actions → **iOS TestFlight** → **Run workflow**.
2. Branch는 올릴 커밋이 있는 브랜치(보통 병합된 `main`). PR만 있는 상태면
   그 PR 브랜치를 선택한다. **main에 직접 push하지 않는다.**
3. Run workflow를 누른다. `macos-26` 러너가 잠긴 의존성을 설치하고
   `npm --prefix mobile run build:ios`로 웹 자산을 만든 뒤 `cap sync ios`,
   `github.run_number`를 빌드 번호로 넣어 아카이브·ExportOptions 자동 서명·
   TestFlight 업로드까지 한다.
4. 성공하면 App Store Connect → TestFlight에 처리 중인 빌드가 보인다.
   처리에 수 분이 걸릴 수 있다. 수출 규정 질문은 메타데이터 문서와 같이
   HTTPS 면제로 답한다.
5. 실패 로그에 시크릿 **값**이 찍히면 해당 키를 폐기하고 다시 만든다.
   이름이 비어 있으면 4단계부터 고친다. 서명 오류면 Team ID, Bundle ID,
   API 키 권한, App ID 등록을 확인한다.

빌드 번호는 이 워크플로의 `github.run_number`다. 같은 번호로 다시 올릴 수
없다. 실패 후 재실행하면 번호가 올라간다. 로컬에서 `CURRENT_PROJECT_VERSION`
을 더 큰 값으로 올려 둔 빌드를 이미 올렸다면, 그 값보다 큰 run number가 나올
때까지 실행하거나 로컬 번호를 낮게 유지한다. 아직 스토어에 올린 빌드가 없다면
첫 실행의 1부터 쓰면 된다.

로컬 Mac에서만 아카이브할 때는 `mobile/README.md`의 `build:ios` 예시를 쓴다.
그때도 `MAEUM_REVIEWER_EMAIL`과 Supabase 공개 값, Team ID가 필요하다. CI
업로드는 Actions 시크릿의 API 키를 쓴다.

## 6. 내부 테스터

1. App Store Connect → TestFlight → **Internal Testing**.
2. 그룹을 만든다 (예: `마음결 내부`).
3. App Store Connect 사용자(같은 팀)를 그룹에 추가한다. 내부 테스터는
   External Review 없이 새 빌드를 받을 수 있다.
4. 처리할 빌드를 그룹에 연결한다. 준태의 Apple ID가 앱 레코드에 접근할 수
   있어야 한다.
5. iPhone/iPad에 TestFlight 앱을 설치하고 초대 메일 또는 알림으로 설치한다.
6. 로그인 검사는 데모 계정(비밀번호 경로)과 준태 본인 이메일 OTP를 나누어
   본다. OTP는 실제 메일함이 필요하다.

외부 테스터(이메일 초대, 공개 링크)는 내부 설치가 확인된 뒤에 켠다. 외부
그룹은 Apple의 TestFlight 심사가 한 번 필요할 수 있다.

## 하지 말 것

- `main`에 직접 push하거나 이 문서를 이유로 병합하지 않는다.
- `.p8`, 인증서, provisioning profile을 저장소에 넣지 않는다.
- 워크플로 트리거를 `push`/`pull_request`로 바꾸지 않는다.
- Auth/RLS, Supabase 마이그레이션, 서비스 역할 키를 이 업로드를 위해 바꾸지
  않는다.
- 데모 계정 비밀번호를 GitHub 시크릿이나 코드에 넣지 않는다. 비밀번호는
  App Store Connect 심사 노트와 준태의 보관함에만 둔다.
