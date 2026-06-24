import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonaKey } from './types';

const DAILY_NOTIF_ID_KEY = 'perpetual_daily_notif_id';

const PERSONA_NAMES: Record<PersonaKey, string> = {
  insighter: '김시원',
  wit: '한하경',
  coach: '유채아',
};

function getNotifContent(hour: number): { title: string; body: string } {
  if (hour >= 5 && hour < 11)  return { title: '좋은 아침이에요', body: '오늘 하루 어떻게 시작할 것 같아요?' };
  if (hour >= 11 && hour < 15) return { title: '오전은 어땠어요?', body: '잠깐 틈 내서 기록해봐요' };
  if (hour >= 15 && hour < 21) return { title: '오늘 하루 수고했어요', body: '퇴근하면서 일기 한 줄 써볼까요?' };
  return { title: '하루 마무리할 시간이에요', body: '오늘 기억하고 싶은 순간이 있나요?' };
}

// Call once at app startup
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Pre-schedule at a future time (for when app is closed)
export async function scheduleCommentNotification(
  entryId: string,
  persona: PersonaKey,
  scheduledAt: number,
  entryPreview: string,
): Promise<string | null> {
  const seconds = Math.max(1, Math.floor((scheduledAt - Date.now()) / 1000));
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 ${PERSONA_NAMES[persona]}가 댓글을 달았어요`,
        body: entryPreview.slice(0, 80),
        data: { entryId },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
    return id;
  } catch {
    return null;
  }
}

// Immediate notification with actual comment text (after generating in foreground)
export async function notifyCommentReady(
  entryId: string,
  persona: PersonaKey,
  commentText: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 ${PERSONA_NAMES[persona]}`,
        body: commentText.slice(0, 100),
        data: { entryId },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false },
    });
  } catch {}
}

export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function scheduleDailyDiaryReminder(hour: number, minute: number): Promise<void> {
  // Cancel existing before rescheduling
  await cancelDailyDiaryReminder();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        ...getNotifContent(hour),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await AsyncStorage.setItem(DAILY_NOTIF_ID_KEY, id);
  } catch {}
}

export async function cancelDailyDiaryReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(DAILY_NOTIF_ID_KEY);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(DAILY_NOTIF_ID_KEY);
  } catch {}
}

export async function restoreDailyDiaryReminder(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem('perpetual_notif_time');
    if (!saved) return;
    const [hour, minute] = saved.split(':').map(Number);
    // Only reschedule if not already active
    const existingId = await AsyncStorage.getItem(DAILY_NOTIF_ID_KEY);
    if (existingId) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (scheduled.some(n => n.identifier === existingId)) return;
    }
    await scheduleDailyDiaryReminder(hour, minute);
  } catch {}
}

export async function scheduleWeeklySummaryNotification(firstEntryTs: number): Promise<void> {
  const alreadyScheduled = await AsyncStorage.getItem('perpetual_weekly_notif_scheduled');
  if (alreadyScheduled) return;
  const fireAt = firstEntryTs + 7 * 24 * 60 * 60 * 1000;
  const seconds = Math.max(10, Math.floor((fireAt - Date.now()) / 1000));
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '이번 주 일기 요약이 준비됐어요',
        body: '친구들이 한 주를 돌아봤어요 — 확인해보세요',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    await AsyncStorage.setItem('perpetual_weekly_notif_scheduled', '1');
  } catch {}
}
