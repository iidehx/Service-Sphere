import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Redirect } from 'expo-router';
import { AppLogo, Card, Field, GhostButton, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GoogleIntent, isValidEmail, Role, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';
import { googleWebClientId } from '@/lib/firebase';

WebBrowser.maybeCompleteAuthSession();

type FormMode = 'login' | 'register' | 'reset';

function RoleSelector({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const colors = useColors();
  const options: { role: Role; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
    { role: 'employer', icon: 'briefcase', title: 'Employer', body: 'I want to hire for jobs' },
    { role: 'provider', icon: 'construct', title: 'Service Provider', body: 'I want to find work' },
  ];
  return (
    <View style={styles.roleRow}>
      {options.map((o) => {
        const active = value === o.role;
        return (
          <Pressable
            key={o.role}
            testID={`role-${o.role}`}
            onPress={() => onChange(o.role)}
            style={[
              styles.roleCard,
              {
                backgroundColor: active ? colors.primarySoft : colors.card,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={[styles.roleIcon, { backgroundColor: active ? colors.primary : colors.secondary }]}>
              <Ionicons name={o.icon} size={17} color={active ? colors.primaryForeground : colors.primary} />
            </View>
            <Text style={[styles.roleTitle, { color: colors.foreground }]}>{o.title}</Text>
            <Text style={[styles.roleBody, { color: colors.mutedForeground }]}>{o.body}</Text>
            {active ? (
              <View style={styles.roleCheck}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    mode,
    ready,
    user,
    needsRole,
    authBusy,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogleIdToken,
    loginWithGooglePopup,
    completeRoleSelection,
    resetPassword,
    demoSignIn,
  } = useServiceApp();

  const [formMode, setFormMode] = useState<FormMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('employer');
  const [googleRole, setGoogleRole] = useState<Role>('employer');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const intentRef = useRef<GoogleIntent>('login');

  // Native only: expo-auth-session Google flow.
  // On web we use Firebase signInWithPopup instead (no redirect URI config needed).
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleWebClientId || 'unconfigured.apps.googleusercontent.com',
    androidClientId: '1054709707950-dihmdngomvrjio20dma50q2b1kc23p8o.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = (response.params as Record<string, string>)?.id_token;
      if (idToken) {
        loginWithGoogleIdToken(idToken, intentRef.current).then((err) => {
          if (err) setErrors({ form: err });
        });
      } else {
        setErrors({ form: 'Google did not return a sign-in token. Check the OAuth client setup.' });
      }
    } else if (response.type === 'error') {
      setErrors({ form: 'Google sign-in failed or was cancelled.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  if (!ready) {
    return (
      <Screen style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (user && !needsRole) {
    return <Redirect href="/(tabs)" />;
  }

  const startGoogle = async (intent: GoogleIntent) => {
    setErrors({});
    setInfo('');
    if (mode === 'demo') {
      setErrors({ form: 'Google sign-in becomes available once Firebase is connected. Use email or a demo account for now.' });
      return;
    }
    if (!googleWebClientId) {
      setErrors({ form: 'Google sign-in is not configured yet (missing web client ID).' });
      return;
    }
    intentRef.current = intent;
    // On web use Firebase signInWithPopup — it handles the redirect URI
    // internally so no Google Console redirect URI config is needed.
    if (Platform.OS === 'web') {
      const err = await loginWithGooglePopup(intent);
      if (err) setErrors({ form: err });
      return;
    }
    // On native use expo-auth-session.
    try {
      await promptAsync();
    } catch {
      setErrors({ form: 'Could not open Google sign-in here. It works in the web preview or a development build.' });
    }
  };

  const submit = async () => {
    setErrors({});
    setInfo('');
    const next: Record<string, string> = {};

    if (formMode === 'reset') {
      if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
      if (Object.keys(next).length) return setErrors(next);
      setBusy(true);
      const err = await resetPassword(email);
      setBusy(false);
      if (err) setErrors({ form: err });
      else setInfo('Password reset email sent. Check your inbox.');
      return;
    }

    if (formMode === 'register' && name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (Object.keys(next).length) return setErrors(next);

    setBusy(true);
    const err =
      formMode === 'register'
        ? await registerWithEmail(name, email, password, role)
        : await loginWithEmail(email, password);
    setBusy(false);
    if (err) setErrors({ form: err });
  };

  // --- Google first-signup role selection panel ---------------------------------
  if (needsRole) {
    return (
      <Screen>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}
        >
          <View style={styles.hero}>
            <AppLogo size={54} />
            <Text style={[styles.title, { color: colors.foreground }]}>One last step</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              How will you use Service App? You can hire pros or offer your services.
            </Text>
          </View>
          <RoleSelector value={googleRole} onChange={setGoogleRole} />
          {errors.form ? <Text style={[styles.formError, { color: colors.destructive }]}>{errors.form}</Text> : null}
          <PrimaryButton
            label="Continue"
            icon="arrow-forward"
            testID="continue-role"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const err = await completeRoleSelection(googleRole);
              setBusy(false);
              if (err) setErrors({ form: err });
            }}
            style={{ marginTop: 18 }}
          />
        </KeyboardAwareScrollViewCompat>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 30 }]}
      >
        <View style={styles.hero}>
          <AppLogo size={54} />
          <Text style={[styles.title, { color: colors.foreground }]}>Service App</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Hire trusted local pros, or find work that fits your skills.
          </Text>
        </View>

        {formMode !== 'reset' ? (
          <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
            {(['login', 'register'] as FormMode[]).map((m) => (
              <Pressable
                key={m}
                testID={`tab-${m}`}
                onPress={() => {
                  setFormMode(m);
                  setErrors({});
                  setInfo('');
                }}
                style={[styles.segmentItem, formMode === m ? { backgroundColor: colors.card } : null]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: formMode === m ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {m === 'login' ? 'Log in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.resetTitle, { color: colors.foreground }]}>Reset your password</Text>
        )}

        <View style={styles.form}>
          {formMode === 'register' ? (
            <Field
              label="Full name"
              icon="person-outline"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChangeText={setName}
              error={errors.name}
              testID="input-name"
              autoCapitalize="words"
            />
          ) : null}
          <Field
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            testID="input-email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {formMode !== 'reset' ? (
            <View>
              <Field
                label="Password"
                icon="lock-closed-outline"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                testID="input-password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.eye} hitSlop={10} onPress={() => setShowPassword((s) => !s)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : null}

          {formMode === 'register' ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Account type</Text>
              <RoleSelector value={role} onChange={setRole} />
            </View>
          ) : null}

          {errors.form ? <Text style={[styles.formError, { color: colors.destructive }]}>{errors.form}</Text> : null}
          {info ? <Text style={[styles.formInfo, { color: colors.success }]}>{info}</Text> : null}

          <PrimaryButton
            label={formMode === 'login' ? 'Log in' : formMode === 'register' ? 'Create account' : 'Send reset email'}
            testID="submit-auth"
            loading={busy || authBusy}
            onPress={submit}
          />

          {formMode === 'login' ? (
            <Pressable onPress={() => { setFormMode('reset'); setErrors({}); setInfo(''); }} hitSlop={8}>
              <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          ) : null}
          {formMode === 'reset' ? (
            <Pressable onPress={() => { setFormMode('login'); setErrors({}); setInfo(''); }} hitSlop={8}>
              <Text style={[styles.link, { color: colors.primary }]}>Back to log in</Text>
            </Pressable>
          ) : null}
        </View>

        {formMode !== 'reset' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or continue with</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>
            <Pressable
              testID="google-signin"
              disabled={authBusy || (mode === 'firebase' && !request && Boolean(googleWebClientId))}
              onPress={() => startGoogle(formMode === 'register' ? 'register' : 'login')}
              style={({ pressed }) => [
                styles.googleButton,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="logo-google" size={18} color="#DB4437" />
              <Text style={[styles.googleText, { color: colors.foreground }]}>Continue with Google</Text>
            </Pressable>
          </>
        ) : null}

        {mode === 'demo' ? (
          <Card style={{ marginTop: 22, gap: 10 }}>
            <View style={styles.demoHeader}>
              <Ionicons name="flask-outline" size={16} color={colors.accent} />
              <Text style={[styles.demoTitle, { color: colors.foreground }]}>Preview mode</Text>
            </View>
            <Text style={[styles.demoBody, { color: colors.mutedForeground }]}>
              Firebase isn't connected yet, so accounts stay on this device. Explore instantly with a demo account:
            </Text>
            <View style={styles.demoRow}>
              <GhostButton label="Demo employer" icon="briefcase-outline" testID="demo-employer" onPress={() => demoSignIn('employer')} style={{ flex: 1 }} />
              <GhostButton label="Demo provider" icon="construct-outline" testID="demo-provider" onPress={() => demoSignIn('provider')} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 22, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10, marginBottom: 26 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, marginTop: 4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  segment: { flexDirection: 'row', borderRadius: 11, padding: 4, marginBottom: 20 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  resetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 16, textAlign: 'center' },
  form: { gap: 14 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  eye: { position: 'absolute', right: 14, top: 40 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleCard: { flex: 1, borderWidth: 1.5, borderRadius: 12, padding: 13, gap: 6 },
  roleIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  roleBody: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16 },
  roleCheck: { position: 'absolute', top: 9, right: 9 },
  formError: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  formInfo: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  googleButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  googleText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  demoTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  demoBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18 },
  demoRow: { flexDirection: 'row', gap: 10 },
});
