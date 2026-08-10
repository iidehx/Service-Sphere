import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { AppLogo, SectionTitle, StatusBadge } from '@/components/AppPrimitives';
import { Job, useServiceApp } from '@/context/ServiceAppContext';

function JobPreview({ job }: { job: Job }) {
  const colors = useColors();
  return (
    <Pressable onPress={() => router.push(`/job/${job.id}`)} style={({ pressed }) => [styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.76 : 1 }]}>
      <View style={styles.jobTop}><View style={[styles.categoryIcon, { backgroundColor: colors.secondary }]}><Ionicons name={job.category === 'Cleaning' ? 'sparkles-outline' : job.category === 'Painting' ? 'color-palette-outline' : 'construct-outline'} size={20} color={colors.primary} /></View><View style={styles.jobTitleWrap}><Text style={[styles.jobTitle, { color: colors.foreground }]} numberOfLines={1}>{job.title}</Text><Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>{job.category} · {job.scheduledAt}</Text></View><StatusBadge status={job.status} /></View>
      <View style={styles.jobBottom}><Text style={[styles.price, { color: colors.primary }]}>${job.agreedPrice ?? job.proposedPrice ?? job.priceOffer}</Text><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{job.status === 'open' ? 'budget' : 'agreed price'}</Text><View style={styles.flexSpacer} /><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /></View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, jobs } = useServiceApp();
  const isEmployer = currentUser.role === 'employer';
  const ownJobs = jobs.filter((job) => job.employerId === currentUser.id);
  const providerJobs = jobs.filter((job) => job.status === 'open' || job.employeeId === currentUser.id);
  const upcoming = jobs.filter((job) => job.status === 'accepted' && (job.employerId === currentUser.id || job.employeeId === currentUser.id));
  const featured = providerJobs.filter((job) => currentUser.categories.includes(job.category)).slice(0, 2);
  const displayJobs = isEmployer ? ownJobs.slice(0, 2) : (featured.length ? featured : providerJobs).slice(0, 2);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={styles.headerText}><Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>GOOD MORNING</Text><Text style={[styles.greeting, { color: colors.foreground }]}>{currentUser.name.split(' ')[0]}<Text style={{ color: colors.primary }}>.</Text></Text></View><View style={styles.headerActions}><Pressable style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="notifications-outline" size={21} color={colors.primary} /><View style={[styles.notificationDot, { backgroundColor: colors.accent }]} /></Pressable><AppLogo size={38} /></View></View>
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}><View style={styles.heroCopy}><Text style={[styles.heroKicker, { color: '#F8D49D' }]}>{isEmployer ? 'GET IT DONE' : 'KEEP IT MOVING'}</Text><Text style={styles.heroTitle}>{isEmployer ? 'A little help goes a long way.' : 'Your next great job is nearby.'}</Text><Text style={styles.heroBody}>{isEmployer ? 'Post a request and find a trusted pro in your area.' : 'Browse local requests that match your skills and schedule.'}</Text><Pressable onPress={() => isEmployer ? router.push('/post-job') : router.push('/jobs')} style={({ pressed }) => [styles.heroButton, { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}><Text style={[styles.heroButtonText, { color: colors.primaryForeground }]}>{isEmployer ? 'Post a job' : 'Find a job'}</Text><Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} /></Pressable></View><Ionicons name={isEmployer ? 'home-outline' : 'hammer-outline'} size={92} color="rgba(255,255,255,0.12)" style={styles.heroIcon} /></View>
        {upcoming.length > 0 ? <View style={[styles.alertBanner, { backgroundColor: '#FFF4E5', borderColor: '#F6D49D' }]}><View style={[styles.alertIcon, { backgroundColor: colors.accent }]}><Ionicons name="time-outline" size={17} color="#FFFFFF" /></View><View style={styles.alertCopy}><Text style={[styles.alertTitle, { color: colors.foreground }]}>{upcoming.length} job{upcoming.length > 1 ? 's' : ''} coming up soon</Text><Text style={[styles.alertBody, { color: colors.mutedForeground }]}>Everything you need is lined up for the next 24 hours.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.accent} /></View> : null}
        <SectionTitle title={isEmployer ? 'Your activity' : 'Recommended for you'} action="View all" onAction={() => router.push('/(tabs)/jobs')} />
        {displayJobs.map((job) => <JobPreview job={job} key={job.id} />)}
        {displayJobs.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="briefcase-outline" size={26} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isEmployer ? 'Your job board is quiet' : 'No nearby matches yet'}</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{isEmployer ? 'Post your first request and we’ll help you find the right person.' : 'Try widening your categories or checking back soon.'}</Text></View> : null}
        <SectionTitle title={isEmployer ? 'Why Service App?' : 'Your Service App stats'} />
        <View style={styles.statsRow}><View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.statNumber, { color: colors.primary }]}>{isEmployer ? ownJobs.length : providerJobs.length}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{isEmployer ? 'posted jobs' : 'open matches'}</Text></View><View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.statNumber, { color: colors.accent }]}>{isEmployer ? '5%' : '$0'}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{isEmployer ? 'simple platform fee' : 'earned this month'}</Text></View></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { gap: 2 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', right: 8, top: 8 },
  heroCard: { minHeight: 194, borderRadius: 18, overflow: 'hidden', padding: 22, position: 'relative' },
  heroCopy: { maxWidth: '75%', gap: 9, zIndex: 1 },
  heroKicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  heroBody: { color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, marginTop: 3 },
  heroButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  heroIcon: { position: 'absolute', right: -3, bottom: 16 },
  alertBanner: { borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1, gap: 2 },
  alertTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  alertBody: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  jobCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 13 },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  jobTitleWrap: { flex: 1, gap: 4 },
  jobTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  jobMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  jobBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  priceLabel: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  flexSpacer: { flex: 1 },
  emptyCard: { padding: 22, borderWidth: 1, borderRadius: 12, alignItems: 'center', gap: 7 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 11 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 15, gap: 5 },
  statNumber: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});