import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAL } from '@/constants/palette';
import { supabase } from '@/lib/supabase';
import { claimAnonymousData, queuePendingClaim, signOutAndReset } from '@/lib/auth';
import { MONETIZATION_ENABLED } from '@/lib/purchases';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

const SOURCE_APP = 'perpetual';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'main' | 'email'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 기존 실계정 충돌 시 fallback: signInWithIdToken으로 전환 후 익명 데이터 흡수
  const handleExistingAccount = async (
    provider: 'apple' | 'google',
    idToken: string,
  ) => {
    const { data: { user: anon } } = await supabase.auth.getUser();
    const orphanId = anon?.is_anonymous ? anon.id : null;

    const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken });
    if (error) throw error;
    await supabase.auth.updateUser({ data: { source_app: SOURCE_APP } });

    if (orphanId) {
      try {
        await claimAnonymousData(orphanId);
      } catch {
        await queuePendingClaim(orphanId); // 실패 시 다음 앱 시작에 재시도
      }
    }
    router.replace('/(tabs)');
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = cred.identityToken!;

      // Path A: 현재 익명 세션에 Apple identity 연결 (user_id 불변)
      const { error } = await supabase.auth.linkIdentity({
        provider: 'apple',
        token: idToken,
      } as any);

      if (error) {
        // Path C: 이미 이 Apple 계정으로 가입한 기존 유저 → 세션 전환 + 데이터 흡수
        if (/already linked|identity_already_exists/i.test(error.message)) {
          await handleExistingAccount('apple', idToken);
          return;
        }
        throw error;
      }
      await supabase.auth.updateUser({ data: { source_app: SOURCE_APP } });
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const idToken = data!.idToken!;

      // Path A: 현재 익명 세션에 Google identity 연결 (user_id 불변)
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        token: idToken,
      } as any);

      if (error) {
        // Path C: 기존 계정 충돌
        if (/already linked|identity_already_exists/i.test(error.message)) {
          await handleExistingAccount('google', idToken);
          return;
        }
        throw error;
      }
      await supabase.auth.updateUser({ data: { source_app: SOURCE_APP } });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      setLoading(true);
      // Path B: 익명 세션에 이메일 연결 (user_id 불변, signUp 아님)
      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
        data: { source_app: SOURCE_APP },
      });
      if (error) throw error;
      // 비밀번호는 이메일 인증 완료 후 설정 — 현재 Supabase는 인증 전 비밀번호 설정 미지원
      Alert.alert('확인 이메일을 보냈어요', '이메일 인증 후 이메일로 로그인할 수 있어요.');
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      setLoading(true);
      const { data: { user: before } } = await supabase.auth.getUser();
      const orphanId = before?.is_anonymous ? before.id : null;

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (error) throw error;

      // 기존 계정 로그인 시 익명 데이터 흡수 (Path C)
      if (orphanId) {
        try {
          await claimAnonymousData(orphanId);
        } catch {
          await queuePendingClaim(orphanId);
        }
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <Text style={styles.title}>일기를 안전하게{'\n'}보관해요</Text>
      <Text style={styles.sub}>계정을 만들면 기기를 바꿔도{'\n'}일기가 사라지지 않아요.</Text>

      {mode === 'main' ? (
        <View style={styles.btnGroup}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.appleBtn}
            onPress={signInWithApple}
          />

          <Pressable style={[styles.socialBtn, { borderColor: PAL.line }]} onPress={signInWithGoogle}>
            <Text style={styles.socialBtnText}>Google로 등록</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.emailBtn} onPress={() => setMode('email')}>
            <Text style={styles.emailBtnText}>이메일로 등록</Text>
          </Pressable>

        </View>
      ) : (
        <View style={styles.btnGroup}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={PAL.faint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={PAL.faint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable style={[styles.socialBtn, { backgroundColor: PAL.indigoDeep, borderColor: PAL.indigoDeep }]} onPress={signUpWithEmail}>
            <Text style={[styles.socialBtnText, { color: PAL.bg }]}>회원가입</Text>
          </Pressable>
          <Pressable style={styles.emailBtn} onPress={signInWithEmail}>
            <Text style={styles.emailBtnText}>이미 계정이 있어요 → 로그인</Text>
          </Pressable>
          <Pressable onPress={() => setMode('main')} style={{ alignSelf: 'center' }}>
            <Text style={styles.dividerText}>← 돌아가기</Text>
          </Pressable>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PAL.indigoDeep} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAL.bg, paddingHorizontal: 24 },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  closeBtnText: { fontSize: 18, color: PAL.muted },
  title: {
    marginTop: 32,
    fontSize: 28, fontWeight: '500', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium', lineHeight: 42,
  },
  sub: {
    marginTop: 10, fontSize: 14, color: PAL.muted, lineHeight: 22,
  },
  btnGroup: { marginTop: 40, gap: 12 },
  appleBtn: { height: 52, width: '100%' },
  socialBtn: {
    height: 52, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  socialBtnText: { fontSize: 15, fontWeight: '500', color: PAL.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: PAL.line },
  dividerText: { fontSize: 12, color: PAL.faint },
  emailBtn: { alignItems: 'center', paddingVertical: 8 },
  emailBtnText: { fontSize: 14, color: PAL.muted },
  pricingNote: { fontSize: 12, color: PAL.faint, textAlign: 'center', marginTop: 16 },
  input: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: PAL.line,
    paddingHorizontal: 16, fontSize: 15, color: PAL.ink,
    backgroundColor: PAL.paper,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
});
