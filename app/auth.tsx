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
import { migrateAnonymousData } from '@/lib/auth';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: '211797293864-6594apko9jt9dql1tk874k0li3lc5a93.apps.googleusercontent.com',
});

const SOURCE_APP = 'haru';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'main' | 'email'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const finish = (oldId: string | null) => {
    if (oldId) {
      // 신규 가입: 결제 화면으로 (데이터 이전은 결제 후)
      router.replace({ pathname: '/paywall' as any, params: { oldId } });
    } else {
      // 기존 계정 재로그인: 바로 홈
      router.replace('/(tabs)');
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      const { data: { user: before } } = await supabase.auth.getUser();
      const oldId = before?.is_anonymous ? before.id : null;

      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: cred.identityToken!,
      });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { source_app: SOURCE_APP } });
      finish(oldId);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { data: { user: before } } = await supabase.auth.getUser();
      const oldId = before?.is_anonymous ? before.id : null;

      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: data!.idToken!,
      });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { source_app: SOURCE_APP } });
      finish(oldId);
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
      const { data: { user: before } } = await supabase.auth.getUser();
      const oldId = before?.is_anonymous ? before.id : null;

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { source_app: SOURCE_APP } },
      });
      if (error) throw error;
      Alert.alert('확인 이메일을 보냈어요', '이메일을 확인하고 인증을 완료해주세요.');
      finish(oldId);
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
      const oldId = before?.is_anonymous ? before.id : null;

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (error) throw error;
      finish(oldId);
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
            <Text style={styles.socialBtnText}>G  Google로 가입하고 결제하기</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.emailBtn} onPress={() => setMode('email')}>
            <Text style={styles.emailBtnText}>이메일로 가입하고 결제하기</Text>
          </Pressable>

          <Text style={styles.pricingNote}>가입 후 구독 플랜을 선택하게 됩니다 · 월 ₩6,900~</Text>
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
