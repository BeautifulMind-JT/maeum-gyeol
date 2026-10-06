# App Store 메타데이터 초안 (첫 TestFlight / 심사 제출)

한국어가 기본 언어다. 영어는 현지화 초안이다. 아래 값은 저장소의 실제 화면·수집
항목·`Info.plist` / `PrivacyInfo.xcprivacy`를 기준으로 적은 초안이며, App Store
Connect에 붙여 넣은 뒤 준태가 최종 확인한다. 비밀 값·데모 비밀번호는 이 문서에
넣지 않는다. 심사 로그인 절차는 [APP-REVIEW.md](APP-REVIEW.md)를 쓴다.

글자 수 제한은 App Store Connect 기준이다. 아래 `Keywords` 줄은 쉼표만 쓰고
공백을 넣지 않았다.

## 한국어 (기본)

- **App name:** 마음결
- **Subtitle:** 알아차린 순간을 기록해요
- **Promotional text:** 와인이 없어도 괜찮아요. 3분 연습으로 감각에 머물고, 사진과 글로 그 순간을 남기며, 나누고 싶은 기록만 공개해 다른 사람의 경험을 발견해요.
- **Keywords:** 마음챙김,일기,명상,와인,기록,저널,감각,알아차림,테이스팅,마음
- **Description:**

```text
마음결은 일상의 감각에 주의를 기울이고, 알아차린 순간을 기록하며 서로의 경험을 나누는 마음챙김 앱입니다.

3분 연습은 계정 없이 시작할 수 있습니다. 알아차림, 허용하기, 돌아오기, 머무르기의 짧은 안내를 따라 지금 이 순간에 머물러 보세요. 와인은 첫 연습의 한 가지 맥락일 뿐이며, 와인 없이도 일상의 어떤 감각에서든 사용할 수 있습니다.

로그인하면 사진과 글, 선택적인 와인 이름·빈티지·상황, 개인적인 돌아보기를 내 계정에 남길 수 있습니다. 새 기록과 사진은 기기에 두지 않고 로그인한 계정의 서버에 보관합니다. 공개는 내가 선택한 기록에만 적용되며, 개인 돌아보기 대화는 공개되지 않습니다.

공개한 기록은 발견 탭에서 다른 사람의 경험과 이어집니다. 프로필, 대표 기록, 좋아요, 댓글, 팔로우를 사용할 수 있습니다. 공개 글에는 커뮤니티 규칙(무관용)이 적용됩니다. 모든 공개 글에서 신고할 수 있고, 프로필에서 차단할 수 있습니다. 신고는 24시간 이내에 검토합니다.

마음결은 의료·심리상담 서비스가 아니며 진단이나 치료를 대신하지 않습니다. 첫 실행과 설정에서 위기 상담 연락처를 안내합니다.

계정 삭제는 설정 → 계정 관리에서 바로 할 수 있습니다. 이용약관과 개인정보처리방침은 로그인 전에 동의해야 하며, 설정에서도 다시 열 수 있습니다.
```

## English (localization draft)

- **App name:** Maeum Gyeol
- **Subtitle:** Notice a moment. Keep it.
- **Promotional text:** Wine is optional. Take a 3-minute pause, keep the moment in photos and words, and share only what you choose so you can discover how others noticed theirs.
- **Keywords:** mindfulness,journal,meditation,wine,diary,tasting,moments
- **Description:**

```text
Maeum Gyeol is a mindfulness journal for noticing everyday senses, keeping those moments, and discovering other people’s experiences.

The 3-minute practice works without an account. Follow four short steps — notice, allow, return, stay. Wine tasting is the first practice context, not a requirement. Any everyday sense is enough.

Sign in to save photos, a short note, optional wine name and vintage, the situation, and a private reflection on your account. New entries and photos are stored on the signed-in account, not as a local library on the device. Publishing is optional. Private reflection answers are never copied to the public feed.

Public entries appear in Discover, with profiles, featured entries, likes, comments, and follows. Public posts follow a zero-tolerance community rule. Every public post can be reported, and every profile can be blocked. Reports are reviewed within 24 hours.

Maeum Gyeol is not a medical or counseling service and does not diagnose or treat anyone. A crisis-resources notice is shown on first launch and remains in Settings.

You can delete your account in Settings → Account. Terms and the privacy policy must be accepted before sign-in and remain available in Settings.
```

## 카테고리 제안

- **Primary:** Health & Fitness (마음챙김 연습·기록)
- **Secondary:** Lifestyle (일기·선택적 공유·발견)

의료 앱으로 제출하지 않는다. 앱은 진단·치료·상담을 하지 않는다고 명시한다.
Health & Fitness 대신 Lifestyle을 1순위로 둘지는 준태가 정한다.

## 연령 등급 설문 (앱 내용 기준)

Made for Kids: **No**.

아래는 App Store Connect 연령 등급 질문에 대한 초안 답이다. 와인은 선택
필드와 예시 이미지에만 등장하고, 판매·게임·음주 유도는 없다. 공개 글·댓글·
프로필은 사용자 생성 콘텐츠다. 인앱 브라우저는 고정된 약관·개인정보·지원
주소와 웹 커뮤니티 안내만 연다. 기록 본문은 이스케이프된 텍스트로 보여 주며
사용자가 임의의 URL을 여는 웹 브라우저가 아니다. 네이티브 앱에서 구글
로그인은 꺼져 있다.

| 질문 | 답 | 근거 |
|---|---|---|
| Cartoon or Fantasy Violence | None | 폭력 콘텐츠 없음 |
| Realistic Violence | None | 없음 |
| Prolonged Graphic or Sadistic Realistic Violence | None | 없음 |
| Profanity or Crude Humor | None | 앱 문구에 없음. 공개 글은 신고·차단으로 관리 |
| Mature/Suggestive Themes | None | 없음 |
| Horror/Fear Themes | None | 없음 |
| Medical/Treatment Information | None | 위기 연락처 안내는 안전 고지. 의료 정보·치료 기능 없음 |
| Alcohol, Tobacco, or Drug Use or References | Infrequent/Mild | 선택 필드 ‘함께한 와인’, 빈 서재 예시 사진. 필수 아님, 판매 없음 |
| Simulated Gambling | None | 없음 |
| Sexual Content or Nudity | None | 없음 |
| Graphic Sexual Content and Nudity | None | 없음 |
| Unrestricted Web Access | No | `Browser.open`은 정책/지원 URL과 pages.dev 안내만 |
| Gambling and Contests | None | 없음 |
| User-Generated Content | Yes | 공개 기록·사진·댓글·프로필. 신고 24시간 검토, 차단, 가입 시 무관용 약관 |

예상 등급: **12+** (가벼운 주류 언급 + UGC). 4+로 내리려면 와인 언급과
공개 피드를 다시 검토해야 하므로 지금은 12+를 권한다.

## App Privacy (영양 성분 라벨)

추적 없음 (`NSPrivacyTracking` = false). 광고 네트워크·분석 SDK·크래시
리포터를 넣지 않았다. Supabase는 앱 기능을 위한 처리 대행이며, 광고 목적의
제3자 공유로 표시하지 않는다. 사진은 업로드 전에 EXIF를 제거한다.

Connect 설문과 `mobile/ios/App/App/PrivacyInfo.xcprivacy`를 맞춘다.

| 수집 항목 | 연결 | 추적 | 목적 | 코드에서 실제로 받는 것 |
|---|---|---|---|---|
| Email Address | Yes | No | App Functionality | 이메일 OTP, 계정 식별 |
| Name | Yes | No | App Functionality | 프로필 닉네임 (`mg_profiles.name`) |
| User ID | Yes | No | App Functionality | Auth 사용자 id |
| Photos or Videos | Yes | No | App Functionality | 기록에 붙인 사진 (카메라 또는 보관함) |
| Other User Content | Yes | No | App Functionality | 마음 기록, 상황, 와인 이름·빈티지, 돌아보기, 소개, 댓글, 신고 사유 |

수집하지 않는 것: 위치(정밀/대략), 연락처, 건강, 결제, 검색 기록, 사용
분석, 광고 데이터, 크래시 진단, 기기 광고 식별자. 보관함 검색은 기기 안에서만
이뤄진다.

제품 개선을 위한 별도 분석 이벤트는 없다. 세션은 기기에 남을 수 있다.

## 수출 규정 (암호화)

`Info.plist`의 `ITSAppUsesNonExemptEncryption` = **false**.

App Store Connect 암호화 질문:

1. 앱이 암호화를 사용하는가 → HTTPS(TLS)만 사용한다.
2. 면제에 해당하는가 → **Yes**. 표준 HTTPS만 사용하고 자체 암호 알고리즘을
   추가하지 않는다.
3. ERN(암호화 등록 번호)은 제출하지 않는다.

이 답을 바꾸려면 먼저 `Info.plist`를 바꿔야 한다. 둘을 어긋나게 두지 않는다.

## 스크린샷 계획

첫 제출에 필요한 크기만 찍는다. 기기는 실제 단말 또는 시뮬레이터. 상태 바에
테스트용 이메일·내부 URL·디버그 버튼을 보이지 않게 한다. 공개 예시 기록은
데모 계정에 미리 만들어 둔다 ([APP-REVIEW.md](APP-REVIEW.md)).

| 크기 | 픽셀 (세로) | 대상 |
|---|---|---|
| iPhone 6.9" | 1320 × 2868 (1290 × 2796도 허용) | iPhone 16/17 Pro Max 급 |
| iPad 13" | 2064 × 2752 | iPad Pro 13-inch |

각 크기마다 아래 5장을 같은 순서로 올린다. iPad는 멀티태스킹·큰 화면
레이아웃이 보이도록 찍는다.

1. **오늘** — 코발트 여름 표지, ‘시작’ 버튼, 최근 순간.
2. **연습** — 알아차림→허용하기 안내와 3분 타이머.
3. **기록 작성** — 짧은 글, 선택 사진, 선택 와인 필드. 와인이 필수가 아님을
   보여 주는 빈 필드가 좋다.
4. **내 기록** — 서재/날짜 보기, 나만 보기와 공개가 구분되는 카드.
5. **발견** — 공개 피드와 작성자 이름. 데모 계정의 공개 기록 1개 이상.

선택 6장: 기록 상세(흰 바탕·본문) 또는 설정(안전 안내·약관 링크).

저장소에 미리 만들어 둔 파일은 `store/screenshots/iphone-6.9/`와
`store/screenshots/ipad-13/`이다. 운영 Supabase나 실제 사용자 데이터는 쓰지
않고, `npm run screenshots`가 개발 미리보기(`/preview/`)와 예시 기록으로
다시 찍음. 산출물은 RGB PNG이며 기기 프레임은 넣지 않는다.

앱 미리보기 영상은 첫 제출에 넣지 않아도 된다.

## 스토어 텍스트에 넣지 말 것

- 의료·치료·상담 효과 주장
- GitHub, Supabase, 배포 ID 같은 개발 정보
- 데모 계정 비밀번호
- 아직 없는 결제·추천·유료 가이드
