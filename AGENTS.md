# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# 프로젝트 개요

AI 일기 앱 "하루". 사용자가 일기를 쓰면 3명의 AI 페르소나(insighter/wit/coach)가 순차적으로 댓글을 답니다.

**Bundle ID:** com.sigcrew.haru  
**Apple Team:** SIG Inc. (867RGMZD7Y)  
**ASC App ID:** 6780211212

# 핵심 아키텍처

- **스토리지:** expo-file-system/legacy → `haru_entries.json`, `haru_weekly/`, `haru_last_read.json`
- **AI 호출:** `lib/ai.ts` — fetch로 `api.anthropic.com/v1/messages` 직접 호출 (claude-haiku-4-5-20251001)
- **알림:** `lib/notifications.ts` — expo-notifications 로컬 푸시 (APNs 원격 아님)
- **댓글 폴링:** `app/entry/[id].tsx` — 30초마다 pendingComments 확인 후 생성

# AI 댓글 흐름

1. 일기 저장 → `schedulePendingComments()` 로 3개 예약 (순서 셔플, 1~10분 랜덤 딜레이)
2. Entry 화면 열릴 때마다 `checkAndGenerate()` 폴링 (30초 interval)
3. 시간 된 댓글은 이전 댓글 컨텍스트 포함해서 Claude 호출 → JSON `{replyTo, text}` 응답
4. 생성 완료 → 예약 알림 취소 + 즉시 알림 발송

# EAS 빌드 주의사항

- `.env.local`은 EAS 빌드에 포함 안 됨 → `eas env:create`로 등록
- Push Notifications entitlement가 있는 프로파일 필요 (H5C372QB47)
- `eas.json`에 `promptToConfigurePushNotifications: false` 설정됨 (자동화)
- `npm install` 시 `.npmrc`의 `legacy-peer-deps=true` 필수

# 실행

```bash
npx expo start --ios --port 8082
```

# 배포

```bash
# 빌드 (자동으로 buildNumber 증가)
eas build --platform ios --profile production

# TestFlight 제출
eas submit --platform ios --latest
```
