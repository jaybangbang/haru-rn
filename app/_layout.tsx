import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import {
  NotoSerifKR_400Regular,
  NotoSerifKR_500Medium,
} from '@expo-google-fonts/noto-serif-kr';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
} from '@expo-google-fonts/noto-sans-kr';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'NotoSerifKR-Regular': NotoSerifKR_400Regular,
    'NotoSerifKR-Medium': NotoSerifKR_500Medium,
    'NotoSansKR-Regular': NotoSansKR_400Regular,
    'NotoSansKR-Medium': NotoSansKR_500Medium,
    'NotoSansKR-SemiBold': NotoSansKR_600SemiBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
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
      </Stack>
    </>
  );
}
