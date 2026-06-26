# Perpetual 앱스토어 출시 체크리스트

마지막 업데이트: 2026-06-26

---

## 🔴 기능 개발 (Apple 필수 요구사항)

- [x] **계정 탈퇴 기능** — Apple 2022년 6월부터 계정 생성 앱은 필수
  - Supabase RPC `perpetual.delete_user_account` 생성 (수동 실행 필요)
  - `lib/auth.ts` `deleteAccount()` 추가
  - 계정 모달에 탈퇴 버튼 + 확인 Alert 추가
- [x] **설정 화면에 개인정보처리방침 링크** — `PRIVACY_POLICY_URL` 상수 교체 필요
- [x] **AI 생성 콘텐츠 고지** — 설정 섹션 하단에 추가

---

## 🟡 ASC 메타데이터 준비

- [ ] **개인정보처리방침 페이지** URL 준비 (노션 공개 페이지로 대체 가능)
- [ ] **지원 URL** 준비 (이메일 또는 페이지)
- [ ] 한국어 **앱 이름**: Perpetual · 퍼페추얼
- [ ] 한국어 **앱 설명** (4000자 이내) + **키워드** (100자 이내)
- [ ] **스크린샷** — 6.7인치(iPhone 16 Pro Max) 필수, 5.5인치 선택
- [ ] ASC 앱 버전에 **구독 상품 연결** (구독 올릴 경우)

---

## 🟢 빌드 & 제출

- [ ] 빌드 #35 EAS 업로드 (`eas build --platform ios --profile production --auto-submit`)
- [ ] TestFlight에서 온보딩 spinner UX 최종 확인
- [ ] ASC 앱 버전 생성 → 빌드 선택 → 심사 제출

---

## 🔵 제출 후 (심사 통과 기준)

- [ ] 심사 통과 확인
- [ ] Sandbox Apple ID로 구독 결제 테스트 (구독 올릴 경우)
- [ ] 출시 후 Google Sign-In iOS 클라이언트 교체 (비긴급 — 현재 작동 중)

---

## ✅ 완료

- [x] RevenueCat ASC 연동 — `appl_POBGfGENSoqmPwxKoLJlFRyUAYZ` (2026-06-24)
- [x] RevenueCat Entitlement `premium` + Products + Offering `default` 연결 (2026-06-24)
- [x] 온보딩 v3 알림 시간 spinner UX (2026-06-25)
- [x] 번들 ID `ing.perpetual.app` + ASC App ID `6781657402` 연결
- [x] Supabase `perpetual` 스키마 마이그레이션

---

## 구독 유료화 전환 시 추가 작업

> 현재 구독 없이 출시. 나중에 `lib/purchases.ts`의 `MONETIZATION_ENABLED = true`로 전환.

- [ ] `lib/purchases.ts` `MONETIZATION_ENABLED = true`로 변경 (1줄)
- [ ] `app/auth.tsx` pricingNote 문구 복원 ("가입 후 구독 플랜을 선택하게 됩니다 · 월 ₩6,900~")
- [ ] `app/(tabs)/weekly.tsx` 배너를 `isAnonymous &&` 조건부 Pressable로 복원 (`router.push('/auth')`)
- [ ] `app/(tabs)/index.tsx` 웹 CTA "열기" 버튼 복원 (`Linking.openURL('https://haru-web-ten.vercel.app')`)
- [ ] `app/paywall.tsx` 동작 재확인 (handleClose signOut + Toast)
- [ ] 기존 유저 grandfather 정책 결정 (가입일 기준 무료 유지 여부)
- [ ] 이용약관 페이지 추가 (구독 갱신/해지 정책 명시 — Apple 요구사항)
- [ ] Sandbox Apple ID 결제 테스트
