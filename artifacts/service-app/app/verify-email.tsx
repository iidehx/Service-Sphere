import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLogo, Card, GhostButton, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

export default function VerifyEmailScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    emailVerified,
    user,
    authBusy,
    sendVerificationEmail,
    refreshEmailVerification,
    signOutUser,
  } = useServiceApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (emailVerified) router.replace('/(tabs)');
  }, [emailVerified, router]);

  if (emailVerified) {
    return (
      <Screen style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const resend = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const nextError = await sendVerificationEmail();
    setBusy(false);
    if (nextError) setError(nextError);
    else setMessage('Verification email sent. Check your inbox and spam folder.');
  };

  const checkAgain = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    const nextError = await refreshEmailVerification();
    setBusy(false);
    if (nextError) {
      setError(nextError);
    } else if (!emailVerified) {
      setMessage('Your email is not verified yet. Open the link in the email, then check again.');
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <AppLogo size={58} />
        <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We sent a verification link to:
        </Text>
        <Text style={[styles.email, { color: colors.foreground }]}>{user?.email || 'your email address'}</Text>

        <Card style={styles.card}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Verify your email before you post jobs, find work, or message other members.
          </Text>
          {error ? <Text style={[styles.feedback, { color: colors.destructive }]}>{error}</Text> : null}
          {message ? <Text style={[styles.feedback, { color: colors.success }]}>{message}</Text> : null}
          <PrimaryButton label="I've verified my email" loading={busy || authBusy} onPress={checkAgain} />
          <GhostButton label="Resend verification email" onPress={resend} testID="resend-verification" />
        </Card>

        <GhostButton
          label="Sign out"
          icon="log-out-outline"
          onPress={async () => {
            await signOutUser();
            router.replace('/login');
          }}
          testID="verify-signout"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, gap: 12 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 25, marginTop: 6 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', marginTop: 6 },
  email: { fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  card: { width: '100%', maxWidth: 480, gap: 14, marginTop: 8 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  feedback: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});