# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# 프로젝트 개요

AI 일기 앱 "하루". 사용자가 일기를 쓰면 3명의 AI 페르소나(insighter/wit/coach)가 순차적으로 댓글을 달고, 유저 답글에도 딜레이 후 응답합니다.

**페르소나:** 김시원(@siwon.ai, insighter) / 한하경(@hakyung.ai, wit) / 유채아(@chaea.ai, coach)

**Bundle ID:** com.sigcrew.haru  
**Apple Team:** SIG Inc. (867RGMZD7Y)  
**ASC App ID:** 6780211212

# 핵심 아키텍처

- **스토리지:** Supabase `haru` 스키마 — `entries`, `weekly_summaries`, `last_read` 테이블
- **인증:** Supabase Auth — 앱 시작 시 자동 익명 로그인, 나중에 Apple/Google/이메일로 업그레이드
- **AI 호출:** `haru-api` (별도 Vercel 배포) → Anthropic `claude-sonnet-4-6`
- **알림:** `lib/notifications.ts` — expo-notifications 로컬 푸시 (APNs 원격 아님)
- **댓글 폴링:** `app/entry/[id].tsx` — 30초마다 pendingComments 확인 후 생성

# 인증 흐름

1. `lib/auth.ts` — `ensureAuth()`: 세션 없으면 자동 익명 로그인 → userId 반환
2. 일기 작성 첫 완료 시 전체화면 회원가입 유도 모달 (`write.tsx`)
3. `app/auth.tsx` — Apple/Google/이메일 로그인. 가입 후 `migrate_user_data` RPC로 익명 데이터 이전
4. 홈 탭 우상단: 익명=PersonIcon(→auth), 로그인=이니셜(→계정 모달+로그아웃)

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

# 주간 요약 v2

- 조건: 첫 일기 createdAt 기준 7일 후
- 형식: 3명 중 1명 선택 → 편지 형식 (`letterPersona`, `letter` 필드)
- `lib/ai_weekly_v1.ts`: 이전 3카드 구조 백업 (필요 시 참고)
- `__DEV__` QA 버튼으로 7일 게이트 우회 가능

# Xcode 빌드 주의사항

- `npx expo prebuild --platform ios` 는 항상 `app.xcodeproj` 를 생성함
- `plugins/withRenameXcodeProject.js` 플러그인이 prebuild 시 자동으로 Haru.xcodeproj로 rename
- `use_modular_headers!` 도 플러그인이 Podfile에 자동 추가 (GoogleSignIn Swift pod 필요)
- Google Sign-In: iOS client ID는 auth.tsx + Info.plist URL scheme 둘 다 필요
- EAS 7월 1일까지 사용 불가 → 로컬 Xcode 아카이브로 IPA 뽑기

# 로컬 IPA 뽑는 법 (EAS 대신)

```bash
# 1. prebuild
rm -rf ios && npx expo prebuild --platform ios

# 2. archive
xcodebuild -workspace ios/Haru.xcworkspace \
  -scheme Haru -configuration Release \
  -destination generic/platform=iOS \
  -archivePath /tmp/Haru.xcarchive \
  archive -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=867RGMZD7Y

# 3. IPA export
xcodebuild -exportArchive \
  -archivePath /tmp/Haru.xcarchive \
  -exportPath /tmp/HaruExport \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -allowProvisioningUpdates

# ExportOptions.plist: method=app-store-connect, teamID=867RGMZD7Y
# IPA 경로: /tmp/HaruExport/app.ipa → Transporter로 업로드
```

# 환경 변수

`.env` (git 포함):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_API_URL` (Anthropic)

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
