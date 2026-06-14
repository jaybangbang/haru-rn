import * as Notifications from 'expo-notifications';
import { PersonaKey } from './types';

const PERSONA_NAMES: Record<PersonaKey, string> = {
  insighter: '인사이터',
  wit: '유머',
  coach: '코치',
};

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
