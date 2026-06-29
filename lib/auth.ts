import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const PENDING_CLAIM_KEY = 'perpetual_pending_claim_old_id';

export async function ensureAuth(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`signInAnonymously failed: ${error.message}`);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('auth failed: no user after sign in');
  return user.id;
}

export async function signOutAndReset(): Promise<void> {
  await supabase.auth.signOut();
  // initialized 플래그 없이 getSession() 기반이라 다음 ensureAuth에서 자동 익명 생성
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

// Path C fallback: 기존 실계정과 충돌한 경우에만 호출
// new_user_id는 서버에서 auth.uid()로 도출 (클라이언트 전달 금지)
export async function claimAnonymousData(oldUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || user.id === oldUserId) return;
  const { error } = await supabase.rpc('claim_anonymous_data', { old_user_id: oldUserId });
  if (error) throw error;
}

export async function queuePendingClaim(oldId: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_CLAIM_KEY, oldId);
}

// 앱 시작 시 호출 — 실패한 마이그레이션 재시도
export async function retryPendingClaim(): Promise<void> {
  const oldId = await AsyncStorage.getItem(PENDING_CLAIM_KEY);
  if (!oldId) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return;

  try {
    await claimAnonymousData(oldId);
    await AsyncStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    // 다음 앱 시작에 재시도
  }
}

// 하위 호환: MONETIZATION_ENABLED=true 경로(paywall)에서 참조 중이므로 유지
// 신규 가입 경로(linkIdentity)에서는 호출되지 않음
export { claimAnonymousData as migrateAnonymousData };
