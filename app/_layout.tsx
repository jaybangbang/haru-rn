import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  NotoSerifKR_400Regular,
  NotoSerifKR_500Medium,
} from '@expo-google-fonts/noto-serif-kr';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
} from '@expo-google-fonts/noto-sans-kr';
import { configureNotifications, requestNotificationPermissions, restoreDailyDiaryReminder } from '@/lib/notifications';
import { retryPendingClaim } from '@/lib/auth';
import { loadEntries, formatDate } from '@/lib/storage';
import { ToastHost } from '@/components/Toast';
import { initPurchases } from '@/lib/purchases';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const [loaded] = useFonts({
    'NotoSerifKR-Regular': NotoSerifKR_400Regular,
    'NotoSerifKR-Medium': NotoSerifKR_500Medium,
    'NotoSansKR-Regular': NotoSansKR_400Regular,
    'NotoSansKR-Medium': NotoSansKR_500Medium,
    'NotoSansKR-SemiBold': NotoSansKR_600SemiBold,
  });

  useEffect(() => {
    if (!loaded) return;
    initPurchases();
    (async () => {
      await SplashScreen.hideAsync();
      requestNotificationPermissions();
      restoreDailyDiaryReminder();
      retryPendingClaim(); // 실패한 마이그레이션 재시도 (비동기, 앱 시작 블로킹 안 함)
      const onboarded = await AsyncStorage.getItem('perpetual_onboarded');
      if (!onboarded) router.replace('/onboarding');
    })();
  }, [loaded]);

  // Navigate to entry when user taps a notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async response => {
      const entryId = response.notification.request.content.data?.entryId as string | undefined;
      if (entryId) {
        router.push(`/entry/${entryId}`);
        return;
      }
      // 일별 리마인더 탭 — 오늘 일기가 있으면 해당 일기로, 없으면 작성 화면으로
      try {
        const todayStr = formatDate(new Date());
        const entries = await loadEntries();
        const todayEntry = entries.find(e => e.date === todayStr);
        if (todayEntry) {
          router.push(`/entry/${todayEntry.id}`);
        } else {
          router.push('/write');
        }
      } catch {
        router.push('/write');
      }
    });
    return () => sub.remove();
  }, []);

  if (!loaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="write"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="entry/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <ToastHost />
    </View>
  );
}
