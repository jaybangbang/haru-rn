# 익명→실계정 마이그레이션 전략

마지막 업데이트: 2026-06-29

## 배경

앱 시작 시 자동 익명 로그인 후 일기를 작성하다가 명시적으로 가입하는 구조.
기존 구현(migrate_user_data RPC로 user_id를 UPDATE)에서 데이터 손실 리스크 발견 후 전략 변경.

## 핵심 원칙

**"데이터를 옮기지 않는다" — user_id가 바뀌지 않으면 마이그레이션이 필요 없다.**

## 가입 경로별 전략

### Path A: Apple / Google 신규 가입
`signInWithIdToken` 대신 `linkIdentity` 사용.
현재 익명 세션에 OAuth identity를 연결 → user_id 불변 → 데이터 이전 불필요.

### Path B: 이메일 신규 가입
`signUp()` 대신 `updateUser({ email })` 사용.
익명 세션에 이메일을 붙이는 방식 → user_id 불변 → 이메일 인증 타이밍 문제 없음.
비밀번호는 이메일 인증 완료(USER_UPDATED 이벤트) 후 updateUser({ password })로 추가.

### Path C: 기존 계정 재로그인 (충돌 케이스)
linkIdentity가 "already linked" 에러 → signInWithIdToken으로 fallback → user_id 변경.
이 경우에만 claim_anonymous_data RPC 호출.
실패 시 AsyncStorage(PENDING_CLAIM_KEY)에 적재 → 앱 재시작마다 재시도.

## 기존 구현 대비 개선된 점

| 항목 | 기존 | 개선 |
|------|------|------|
| 신규 Apple/Google | signInWithIdToken → user_id 변경 | linkIdentity → user_id 불변 |
| 이메일 가입 | signUp → 인증 전 마이그레이션 누락 | updateUser → user_id 불변 |
| 실패 처리 | catch {} 무음 | AsyncStorage 재시도 큐 |
| RPC 보안 | new_user_id 클라이언트 전달 (탈취 가능) | auth.uid() 서버 도출 |
| initialized 플래그 | signOut 후 세션 파괴 | getSession() 매번 확인 |

## Supabase 대시보드 필수 설정

- Auth → Settings → **Manual Linking 활성화** (linkIdentity 동작 전제)

## RPC 구조 (claim_anonymous_data)

- `new_user_id`를 클라이언트 인자로 받지 않음 — 내부에서 `auth.uid()` 도출
- `SECURITY DEFINER` + `search_path` 고정
- old 계정이 익명 + identity 없음인지 검증 후 실행
- entries / weekly_summaries / last_read 세 테이블 원자적 처리
- 충돌 시 caller(실계정) 데이터를 정본으로 유지

## 롤백 방법

```bash
git revert HEAD  # 또는
git reset --hard 86a68eb  # 마이그레이션 작업 직전 커밋
```

기존 migrate_user_data RPC는 Supabase 대시보드에 보존되어 있음.
