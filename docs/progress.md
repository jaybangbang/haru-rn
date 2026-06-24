# Perpetual — 출시 준비 진행 현황

## 완료

### 앱 기반
- [x] 앱 이름 변경: 하루 → Perpetual
- [x] 번들 ID 변경: `com.sigcrew.haru` → `ing.perpetual.app`
- [x] 도메인 구매: perpetual.ing (가비아)
- [x] ASC 앱 생성 (App ID: 6781657402)
- [x] EAS 신규 Provisioning Profile 생성

### 인증
- [x] Supabase 익명 → 소셜 업그레이드 플로우
- [x] Apple 로그인
- [x] Google 로그인 — Perpetual용 OAuth 클라이언트 신규 생성 및 코드 반영
  - iOS Client: `785797626728-gl04q5erv10i18pbef9qtsp6coehkk8k`
  - Web Client: `785797626728-m8f5megpahf74s90i7e350qa4b8pfkjk`
- [x] EAS 환경변수 등록: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### 페이월
- [x] `app/paywall.tsx` 구현 (연간/월간 플랜 선택)
- [x] 가입 → 결제 순서 플로우 구현
- [x] `lib/purchases.ts` RevenueCat 래퍼 구현 (DEV bypass 포함)
- [x] ASC IAP 상품 생성
  - `ing.perpetual.app.premium.monthly` (₩6,900/월)
  - `ing.perpetual.app.premium.yearly` (₩69,000/년)

---

## 진행 중

- [ ] ASC IAP 상품 메타데이터 완성 (현지화 + 가격 — 현재 "메타데이터 누락됨" 상태)
- [ ] 유료 앱 계약 서명 (Account Holder 권한 필요 — 개발자에게 요청 예정)

---

## 할 일

### RevenueCat
- [ ] revenuecat.com 계정 생성 + 프로젝트 생성 (Bundle ID: `ing.perpetual.app`)
- [ ] iOS API Key 발급
- [ ] ASC IAP 상품 RevenueCat에 연동
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_KEY` EAS 환경변수 등록
- [ ] 결제 플로우 실제 테스트

### 앱스토어 제출 준비
- [ ] ASC 앱 이름 "Perpetual (360666)" → "Perpetual" 수정
- [ ] 개인정보처리방침 URL 준비 (앱 심사 필수)
- [ ] 스크린샷 촬영
- [ ] 앱 설명 작성
- [ ] 카테고리, 키워드 설정

### 기타
- [ ] Google Cloud Console OAuth 동의 화면 → 프로덕션으로 게시 확인
- [ ] Account Holder 이전 (장기 과제 — 개발자 → 대표)

---

## 로그

### 2026-06-18
- Google OAuth 클라이언트 Perpetual용으로 신규 생성
- EAS 환경변수 Google Client ID 교체 등록
- ASC IAP 상품 2개 생성 (monthly/yearly)
- 유료 앱 계약 서명 필요 확인 → 개발자에게 요청 예정
