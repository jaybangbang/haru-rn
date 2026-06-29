# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# 프로젝트 개요

AI 일기 앱 "Perpetual". 사용자가 일기를 쓰면 3명의 AI 페르소나(insighter/wit/coach)가 순차적으로 댓글을 달고, 유저 답글에도 딜레이 후 응답합니다.

**페르소나:** 김시원(@siwon.ai, insighter) / 한하경(@hakyung.ai, wit) / 유채아(@chaea.ai, coach)

**Bundle ID:** ing.perpetual.app  
**Apple Team:** SIG Inc. (867RGMZD7Y)  
**ASC App ID:** 6781657402

# 핵심 아키텍처

- **스토리지:** Supabase `perpetual` 스키마 — `entries`, `weekly_summaries`, `last_read` 테이블
- **인증:** Supabase Auth — 앱 시작 시 자동 익명 로그인, 나중에 Apple/Google/이메일로 업그레이드
- **AI 호출:** `haru-api` (별도 Vercel 배포) → Anthropic `claude-sonnet-4-6`
- **알림:** `lib/notifications.ts` — expo-notifications 로컬 푸시 (APNs 원격 아님)
- **댓글 폴링:** `app/entry/[id].tsx` — 30초마다 pendingComments 확인 후 생성

# 인증 흐름

1. `lib/auth.ts` — `ensureAuth()`: 세션 없으면 자동 익명 로그인 → userId 반환
2. 일기 작성 첫 완료 시 전체화면 회원가입 유도 모달 (`write.tsx`)
3. `app/auth.tsx` — Apple/Google/이메일 로그인
4. 홈 탭 우상단: 익명=PersonIcon(→auth), 로그인=이니셜(→계정 모달+로그아웃)

## 익명→실계정 마이그레이션 전략 (2026-06-29 변경)

**핵심: user_id가 바뀌지 않으면 마이그레이션 불필요**

- **Path A (신규 Apple/Google):** `linkIdentity` — 현재 익명 세션에 identity 연결, user_id 불변
- **Path B (이메일 신규):** `updateUser({ email })` — 익명 세션에 이메일 연결, user_id 불변
- **Path C (기존 계정 충돌):** `linkIdentity` "already linked" → `signInWithIdToken` fallback → `claim_anonymous_data` RPC + AsyncStorage 재시도 큐

**Supabase 설정:** Auth → Sign In/Providers → Manual Linking 활성화 필수  
**RPC:** `public.claim_anonymous_data(old_user_id uuid)` — new_user_id는 서버에서 auth.uid() 도출  
**상세:** `docs/auth-migration-strategy.md`

# 주간 요약 구조 백업

`lib/ai_weekly_v1.ts` — 원래 주간 요약 구조 (3개 인사이트 + 키워드 + 제언 카드).
현재(v2)는 페르소나 1명이 편지 쓰는 구조로 변경됨. 이전 구조 필요 시 이 파일 참조.

# AI 댓글 흐름

1. 일기 저장 → `schedulePendingComments()` 로 3개 예약 (순서 셔플, 1~10분 랜덤 딜레이)
2. Entry 화면 열릴 때마다 `checkAndGenerate()` 폴링 (30초 interval)
3. 시간 된 댓글은 이전 댓글 컨텍스트 포함해서 Claude 호출 → JSON `{replyTo, text}` 응답
4. 생성 완료 → 예약 알림 취소 + 즉시 알림 발송
5. **수정된 일기는 AI 댓글 재생성 안 함** (기존 comments/pendingComments 그대로 유지)

# 유저 답글 딜레이 (PendingUserReply)

유저가 AI 댓글에 답글 달면 즉시 응답하지 않고 딜레이 후 응답:
- wit: 1~60분
- insighter: 60~480분  
- coach: 1~480분

`PendingUserReply` 타입으로 DiaryEntry에 저장, `checkAndGenerate()` 폴링에서 처리.

# 주간 요약 v3 (현재)

- 조건: 첫 일기 createdAt 기준 7일 후 자동 생성 (`loadData`에서 처리)
- 형식: AI 리포트 — 핵심 사건 / 반복 패턴 / 미결 질문 / 제언 (페르소나 없음)
- 생성: `lib/ai_weekly_v3.ts` → `generateWeeklySummaryV3()` → `/api/comment` (maxTokens: 2000)
- 저장 키: `weekKey + '_v3'`
- 화면 순서: 스트리크 → 감정에너지 → 키워드 → 리포트 섹션
- `__DEV__` "리포트 즉시 생성" 버튼으로 7일 게이트 우회 가능

## 주간 요약 백업 코드 (롤백용)

- `lib/ai.ts` → `generateWeeklySummary()`: v2 편지형 (페르소나 1명이 DM 편지)
- `lib/ai_weekly_v1.ts` → `generateWeeklySummaryV1()`: v1 카드형 (3개 인사이트 카드)
- `app/(tabs)/weekly.tsx`에 v1/v2 컴포넌트(LetterCard, SuggestionCard, VersionToggle) 및 상태변수 보존됨

# Xcode 빌드 주의사항

- `npx expo prebuild --platform ios` 는 항상 `app.xcodeproj` / `app.xcworkspace` 생성 (EAS 표준)
- `withRenameXcodeProject` 플러그인은 **EAS managed 빌드와 호환 안 됨** — EAS가 `app.xcworkspace` 고정 탐색하므로 rename 플러그인 사용 금지
- `plugins/withModularHeaders.js` — Podfile에 `use_modular_headers!` 추가 (GoogleSignIn Swift pod 필요, rename 플러그인 없이 독립 동작)
- Google Sign-In: iOS client ID는 auth.tsx + Info.plist URL scheme 둘 다 필요

# 배포 (EAS Build)

EAS 유료 플랜 사용 가능. 빌드 + TestFlight 자동 제출:

```bash
eas build --platform ios --profile production --auto-submit --non-interactive
```

- `eas.json` production 프로파일: `autoIncrement: true` (빌드번호 EAS가 자동 관리)
- `appVersionSource: "remote"` → app.json buildNumber 수동 변경 불필요
- submit 설정: `appleId: terra586@gmail.com`, `ascAppId: 6781657402`

## Provisioning Profile 주의사항

- `app.json ios.entitlements`에 필요한 entitlement 명시 필수 (EAS가 자동 감지 안 함)
  - Sign In with Apple: `"com.apple.developer.applesignin": ["Default"]`
- 새 capability 추가 후 첫 빌드 시 provisioning profile 재생성 필요:
  1. `eas credentials --platform ios` → production → All → provisioning profile 재생성
  2. non-interactive 모드에서는 재생성 불가 (Apple Developer Portal 인증 필요)

# 환경 변수

`.env` (git 포함):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_API_URL` (Anthropic)
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat iOS SDK key)

`.env.local` (git 제외, 민감 키 메모용):
- `SUPABASE_URL`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`, `GOOGLE_IOS_CLIENT_ID`

# 실행 (USB 개발)

```bash
rm -rf ios && npx expo prebuild --platform ios
npx expo run:ios --device
```

# 실행 (시뮬레이터)

```bash
npx expo start --ios --port 8082
```

# 미완료 작업 (다음 세션에서 재개)

## Google Sign-In — iOS OAuth 클라이언트 교체 (리빌드 필요)

**현황 (2026-06-23):** Supabase Google Auth Client ID 수정 완료 → 현재 TestFlight 빌드에서 구글 로그인 작동함.  
단, iOS OAuth 클라이언트가 구 번들 ID `com.sigcrew.haru`로 등록된 상태 — 언제든 막힐 수 있음.

**해야 할 것 (리빌드 필요):**
1. Google Cloud Console → APIs & Services → Credentials → 새 iOS OAuth 클라이언트 생성
   - 애플리케이션 유형: iOS
   - 번들 ID: `ing.perpetual.app`
   - → 새 클라이언트 ID 발급
2. `.env` 업데이트: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<새 ID>.apps.googleusercontent.com`
3. `app.json` `iosUrlScheme` 업데이트: `"com.googleusercontent.apps.<새 ID 숫자부분>"`
4. `npx expo prebuild` 재실행 → 빌드

**현재 웹 클라이언트 ID:** `785797626728-m8f5megpahf74s90i7e350qa4b8pfkjk` (변경 없음)  
**현재 iOS 클라이언트 ID (구):** `785797626728-gl04q5erv10i18pbef9qtsp6coehkk8k` (교체 필요)  
**Supabase Google Auth:** `785797626728-m8f5megpahf74s90i7e350qa4b8pfkjk.apps.googleusercontent.com` 추가 완료 ✓

## 앱 심사 제출 (최우선 다음 작업)

**현황 (2026-06-29):** 빌드 #36 EAS 제출 완료, Apple 처리 중(TestFlight 미확인).
offerings null 원인: ASC 첫 구독상품은 앱 바이너리 심사 제출 1회 해야 sandbox에서도 StoreKit 인식.

**해야 할 것:**
1. TestFlight #36 설치 후 인증 흐름 테스트 (Apple/Google/이메일 로그인 + 일기 데이터 유지)
2. ASC에서 앱 버전에 구독 상품 연결
3. 스크린샷 (6.7인치 iPhone 16 Pro Max 필수) 준비
4. 한국어 앱 설명 + 키워드 작성
5. 심사 제출 → 통과 후 Sandbox Apple ID로 결제 테스트

## RevenueCat 설정 (2026-06-24 완료)

- API key: `appl_POBGfGENSoqmPwxKoLJlFRyUAYZ` (.env + EAS production 환경변수)
- Entitlement: `premium`
- Products: `ing.perpetual.app.premium.monthly` (₩6,900) / `ing.perpetual.app.premium.yearly` (₩69,000)
- Offering: `default` — Perpetual iOS 앱에 연결 완료
- P8 키: KW72X242J3 / Issuer ID: cb047421-9894-4473-b0e5-89d0388c66a4 등록 완료

**주의:** fullScreenModal(paywall.tsx)에서 Toast 미표시 → Alert.alert() 사용 중
