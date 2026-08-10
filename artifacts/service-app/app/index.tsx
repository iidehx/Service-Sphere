import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AppLogo, Field, Pill, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { Role, useServiceApp } from '@/context/ServiceAppContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useServiceApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('employer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const continueToApp = async () => {
    await signIn(role, name, email);
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}><AppLogo size={48} /><Text style={[styles.brandName, { color: colors.primary }]}>service app</Text></View>
          <View style={styles.hero}>
            <Text style={[styles.kicker, { color: colors.accent }]}>LOCAL WORK. BETTER MATCHED.</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{mode === 'login' ? 'Get the right help, right when you need it.' : 'Make your next job a great one.'}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A trusted place to connect with skilled people in your neighborhood.</Text>
          </View>
          <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modeToggle, { backgroundColor: colors.secondary }]}><Pressable onPress={() => setMode('login')} style={[styles.modeItem, mode === 'login' && { backgroundColor: colors.card }]}><Text style={[styles.modeText, { color: mode === 'login' ? colors.primary : colors.mutedForeground }]}>Sign in</Text></Pressable><Pressable onPress={() => setMode('register')} style={[styles.modeItem, mode === 'register' && { backgroundColor: colors.card }]}><Text style={[styles.modeText, { color: mode === 'register' ? colors.primary : colors.mutedForeground }]}>Create account</Text></Pressable></View>
            {mode === 'register' ? <Field label="Full name" icon="person-outline" placeholder="Your name" value={name} onChangeText={setName} /> : null}
            <Field label="Email" icon="mail-outline" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Field label="Password" icon="lock-closed-outline" placeholder="At least 6 characters" secureTextEntry value={password} onChangeText={setPassword} />
            {mode === 'register' ? <View style={styles.roleBlock}><Text style={[styles.fieldHeading, { color: colors.foreground }]}>I’m here to</Text><View style={styles.pillRow}><Pill label="Post a job" active={role === 'employer'} onPress={() => setRole('employer')} icon="briefcase-outline" /><Pill label="Find work" active={role === 'provider'} onPress={() => setRole('provider')} icon="hammer-outline" /></View></View> : null}
            <PrimaryButton label={mode === 'login' ? 'Sign in securely' : 'Create my account'} onPress={continueToApp} icon="arrow-forward" />
            <View style={styles.orRow}><View style={[styles.line, { backgroundColor: colors.border }]} /><Text style={[styles.orText, { color: colors.mutedForeground }]}>or</Text><View style={[styles.line, { backgroundColor: colors.border }]} /></View>
            <Pressable onPress={continueToApp} style={({ pressed }) => [styles.googleButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><View style={[styles.googleIcon, { backgroundColor: colors.secondary }]}><Text style={[styles.googleG, { color: colors.primary }]}>G</Text></View><Text style={[styles.googleText, { color: colors.foreground }]}>Continue with Google</Text></Pressable>
            <Text style={[styles.terms, { color: colors.mutedForeground }]}>By continuing, you agree to our Terms and Safety Guidelines.</Text>
          </View>
          <View style={styles.trustRow}><Ionicons name="shield-checkmark-outline" size={17} color={colors.accent} /><Text style={[styles.trustText, { color: colors.mutedForeground }]}>Verified profiles · Secure conversations · Local support</Text></View>
        </KeyboardAwareScrollViewCompat>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.4 },
  hero: { gap: 10, paddingTop: 8 },
  kicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, maxWidth: 330 },
  authCard: { borderWidth: 1, borderRadius: 16, padding: 17, gap: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  modeToggle: { flexDirection: 'row', padding: 4, borderRadius: 9 },
  modeItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 7 },
  modeText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  roleBlock: { gap: 9 },
  fieldHeading: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pillRow: { flexDirection: 'row' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { height: 1, flex: 1 },
  orText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  googleButton: { minHeight: 48, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleIcon: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  googleG: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  googleText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  terms: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  trustText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});