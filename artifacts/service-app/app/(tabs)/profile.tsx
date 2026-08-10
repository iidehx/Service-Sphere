import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AppLogo, GhostButton, PrimaryButton, SectionTitle } from '@/components/AppPrimitives';
import { Role, useServiceApp } from '@/context/ServiceAppContext';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, switchRole, signOut } = useServiceApp();
  const provider = currentUser.role === 'provider';
  const changeRole = async (role: Role) => { await switchRole(role); };
  const logout = () => Alert.alert('Sign out?', 'You can sign back in anytime.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/'); } }]);
  return <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}><View style={styles.heading}><Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR ACCOUNT</Text><Text style={[styles.title, { color: colors.foreground }]}>Profile</Text></View><View style={[styles.profileCard, { backgroundColor: colors.primary }]}><View style={[styles.avatar, { backgroundColor: colors.accent }]}><Text style={styles.avatarText}>{currentUser.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</Text></View><View style={styles.profileCopy}><Text style={styles.profileName}>{currentUser.name}</Text><Text style={styles.profileArea}>{currentUser.workArea} · {provider ? 'Service Provider' : 'Employer'}</Text><View style={styles.verified}><Ionicons name="checkmark-circle" size={15} color="#F8D49D" /><Text style={styles.verifiedText}>{currentUser.verified ? 'Verified profile' : 'Profile in progress'}</Text></View></View><Ionicons name="settings-outline" size={21} color="#FFFFFF" /></View><View style={styles.statsRow}><View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.statNumber, { color: colors.primary }]}>{currentUser.rating}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>rating</Text></View><View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.statNumber, { color: colors.primary }]}>{currentUser.reviews}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>reviews</Text></View><View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.statNumber, { color: colors.accent }]}>{provider ? currentUser.categories.length : '5%'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{provider ? 'services' : 'fee'}</Text></View></View><SectionTitle title="Profile details" /><Pressable style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}><Ionicons name={provider ? 'hammer-outline' : 'business-outline'} size={18} color={colors.primary} /></View><View style={styles.menuCopy}><Text style={[styles.menuTitle, { color: colors.foreground }]}>{provider ? 'Services & work area' : 'Company information'}</Text><Text style={[styles.menuBody, { color: colors.mutedForeground }]}>{provider ? currentUser.categories.join(' · ') : 'Add your business details'}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} /></Pressable><Pressable onPress={() => router.push('/help')} style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}><Ionicons name="help-circle-outline" size={18} color={colors.primary} /></View><View style={styles.menuCopy}><Text style={[styles.menuTitle, { color: colors.foreground }]}>Help & safety</Text><Text style={[styles.menuBody, { color: colors.mutedForeground }]}>Guides, fees, and staying safe</Text></View><Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} /></Pressable><SectionTitle title="Preview the other side" /><Text style={[styles.switchHint, { color: colors.mutedForeground }]}>Switch roles to experience both sides of the marketplace.</Text><View style={styles.roleButtons}><GhostButton label={provider ? 'Use Employer view' : 'Use Provider view'} onPress={() => changeRole(provider ? 'employer' : 'provider')} icon="swap-horizontal-outline" /></View><PrimaryButton label="Sign out" onPress={logout} icon="log-out-outline" style={styles.signOut} /></ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 15 },
  heading: { gap: 4, marginBottom: 4 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.5 },
  profileCard: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 18 },
  profileCopy: { flex: 1, gap: 4 },
  profileName: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 17 },
  profileArea: { color: 'rgba(255,255,255,0.68)', fontFamily: 'Inter_400Regular', fontSize: 11 },
  verified: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 2 },
  verifiedText: { color: '#F8D49D', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 11, borderWidth: 1, padding: 13, gap: 4 },
  statNumber: { fontFamily: 'Inter_700Bold', fontSize: 21 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  menuRow: { borderRadius: 12, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 3 },
  menuTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  menuBody: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  switchHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: -8 },
  roleButtons: { flexDirection: 'row' },
  signOut: { marginTop: 4, backgroundColor: '#64748B' },
});