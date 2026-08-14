import React, { useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ServiceAppContext, ServiceAppProvider } from '@/context/ServiceAppContext';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// expo-notifications push support was removed from Expo Go in SDK 53.
// Guard every Notifications call so the app works in Expo Go for development.
const isExpoGo = Constants.appOwnership === 'expo';

// Configure how notifications are presented when the app is in the foreground.
// Skip in Expo Go — setNotificationHandler throws in the Expo Go runtime.
if (!isExpoGo) {
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

const queryClient = new QueryClient();

/**
 * Registers the device for push notifications and persists the Expo push token
 * to the API server (stored in Postgres — never exposed to other app users).
 *
 * Requires a native development or production build; returns immediately on
 * web or simulator where FCM tokens are not available.
 *
 * To enable push notifications:
 *   1. Run `eas init` in artifacts/service-app to get an EAS project ID.
 *   2. Set the EXPO_PUBLIC_EAS_PROJECT_ID environment variable to that UUID.
 *   3. Build a development or production binary with `eas build`.
 */
function PushRegistrar() {
  const ctx = useContext(ServiceAppContext);
  const userId: string | null = ctx?.user?.id ?? null;
  const registered = useRef<string | null>(null);

  useEffect(() => {
    // Only run in a real build — Expo Go dropped push support in SDK 53.
    if (isExpoGo || !isFirebaseConfigured || !userId || Platform.OS === 'web') return;

    // Avoid re-registering with the same token for the same session.
    if (registered.current === userId) return;

    async function register() {
      try {
        // Android 8+ requires a notification channel to exist before the OS
        // will show a permission prompt (Android 13+) or deliver notifications.
        // Create a default channel first so the prompt appears correctly.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Service App Notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2563EB',
            showBadge: true,
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        // EAS project ID — required for Expo managed workflow push tokens.
        // Set EXPO_PUBLIC_EAS_PROJECT_ID after running `eas init`.
        const easProjectId: string | undefined =
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
          (Constants.easConfig as { projectId?: string } | null)?.projectId ??
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

        const tokenOptions = easProjectId ? { projectId: easProjectId } : undefined;
        const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
        const token = tokenData.data;

        // Send the token to the API server (stored in Postgres, never in Firestore).
        const { auth } = getFirebase();
        const idToken = await auth.currentUser?.getIdToken();
        const domain = process.env.EXPO_PUBLIC_DOMAIN;

        if (idToken && domain) {
          const response = await fetch(`https://${domain}/api/notifications/register-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ token }),
          });
          // Only mark as registered if the server confirmed persistence.
          // A 503 (DB unavailable) means the token wasn't stored — don't
          // suppress a future retry.
          if (response.ok) {
            const body = await response.json() as { ok?: boolean };
            if (body.ok && userId) registered.current = userId;
          }
        }
      } catch {
        // Push registration is best-effort; never crash the app.
      }
    }

    register();
  }, [userId]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post-job" options={{ presentation: 'modal' }} />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="review/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="report-user" options={{ presentation: 'modal' }} />
      <Stack.Screen name="help" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ServiceAppProvider>
            {/* PushRegistrar sits inside ServiceAppProvider to read the signed-in user. */}
            <PushRegistrar />
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </ServiceAppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
