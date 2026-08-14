import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar, Card, DotBadge, EmptyState, Pill, SectionTitle } from '@/components/AppPrimitives';
import { JobCard } from '@/components/JobCard';
import { Screen } from '@/components/AppPrimitives';
import { CATEGORIES, CATEGORY_ICONS, firstNameOf, greetingForNow, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

function StatCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const colors = useColors();
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, jobs, unreadNotificationCount } = useServiceApp();

  const myJobs = useMemo(() => (user ? jobs.filter((j) => j.employerId === user.id) : []), [jobs, user]);
  const available = useMemo(
    () =>
      user
        ? jobs.filter(
            (j) => j.status === 'open' && j.employerId !== user.id && !user.blockedUserIds.includes(j.employerId),
          )
        : [],
    [jobs, user],
  );
  const matched = useMemo(() => {
    if (!user) return [];
    return [...available]
      .sort((a, b) => {
        const am = user.categories.includes(a.category) ? 1 : 0;
        const bm = user.categories.includes(b.category) ? 1 : 0;
        return bm - am || b.createdAtMs - a.createdAtMs;
      })
      .slice(0, 5);
  }, [available, user]);

  if (!user) return null;
  const isEmployer = user.role === 'employer';

  const activeMine = jobs.filter((j) => j.employeeId === user.id && (j.status === 'negotiating' || j.status === 'accepted'));
  const earned = jobs
    .filter((j) => j.employeeId === user.id && j.status === 'completed')
    .reduce((sum, j) => sum + (j.agreedPrice ?? 0), 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 130, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={6}>
            <Avatar name={user.name} uri={user.avatarUrl || undefined} size={44} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greetingForNow()}</Text>
            <Text style={[styles.name, { color: colors.foreground }]} testID="home-name">
              {firstNameOf(user.name)}
            </Text>
          </View>
          <Pressable
            testID="bell"
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            style={[styles.bell, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <View style={styles.bellBadge}>
              <DotBadge count={unreadNotificationCount} />
            </View>
          </Pressable>
        </View>

        {isEmployer ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.heroTitle}>Need something done?</Text>
                <Text style={styles.heroBody}>Post a job and get quotes from local pros.</Text>
                <Pressable
                  testID="hero-post-job"
                  onPress={() => router.push('/post-job')}
                  style={({ pressed }) => [styles.heroButton, { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[styles.heroButtonText, { color: colors.primary }]}>Post a job</Text>
                </Pressable>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons name="clipboard-outline" size={44} color="rgba(255,255,255,0.35)" />
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCard icon="folder-open-outline" label="Open" value={String(myJobs.filter((j) => j.status === 'open' || j.status === 'negotiating').length)} />
              <StatCard icon="checkmark-circle-outline" label="Confirmed" value={String(myJobs.filter((j) => j.status === 'accepted').length)} />
              <StatCard icon="ribbon-outline" label="Completed" value={String(myJobs.filter((j) => j.status === 'completed').length)} />
            </View>

            <SectionTitle title="Your recent jobs" action={myJobs.length > 0 ? 'View all' : undefined} onAction={() => router.push('/(tabs)/jobs')} />
            {myJobs.length === 0 ? (
              <EmptyState icon="clipboard-outline" title="No jobs yet" body="Post your first job and providers nearby will send you quotes." />
            ) : (
              myJobs.slice(0, 4).map((job) => <JobCard key={job.id} job={job} showSave={false} />)
            )}

            <SectionTitle title="Quick post by category" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
              {CATEGORIES.map((c) => (
                <Pill
                  key={c}
                  label={c}
                  icon={CATEGORY_ICONS[c]}
                  onPress={() => router.push({ pathname: '/post-job', params: { category: c } })}
                />
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard icon="search-outline" label="Available" value={String(available.length)} />
              <StatCard icon="hammer-outline" label="Active" value={String(activeMine.length)} />
              <StatCard icon="wallet-outline" label="Earned" value={`$${earned}`} />
            </View>

            {user.categories.length === 0 ? (
              <Card style={{ marginBottom: 18, gap: 8 }}>
                <Text style={[styles.tipTitle, { color: colors.foreground }]}>Set your skills</Text>
                <Text style={[styles.tipBody, { color: colors.mutedForeground }]}>
                  Add your service categories so the best-matching jobs show up first.
                </Text>
                <Pressable onPress={() => router.push('/profile-edit')} hitSlop={6}>
                  <Text style={[styles.tipLink, { color: colors.primary }]}>Edit profile →</Text>
                </Pressable>
              </Card>
            ) : null}

            <SectionTitle title="New jobs for you" action="Browse all" onAction={() => router.push('/(tabs)/jobs')} />
            {matched.length === 0 ? (
              <EmptyState icon="search-outline" title="No open jobs right now" body="Check back soon — new jobs are posted all the time." />
            ) : (
              matched.map((job) => <JobCard key={job.id} job={job} />)
            )}

            {user.savedJobIds.length > 0 ? (
              <>
                <SectionTitle title="Saved jobs" action="See saved" onAction={() => router.push('/(tabs)/jobs')} />
                {jobs
                  .filter((j) => user.savedJobIds.includes(j.id))
                  .slice(0, 2)
                  .map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {isEmployer ? (
        <Pressable
          testID="fab-post-job"
          onPress={() => router.push('/post-job')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, bottom: insets.bottom + 96, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={28} color={colors.primaryForeground} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerText: { flex: 1, gap: 1 },
  greeting: { fontFamily: 'Inter_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  bell: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -4, right: -4 },
  heroCard: { borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#fff' },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginBottom: 10 },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  heroButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  heroIcon: { marginLeft: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, gap: 6, alignItems: 'flex-start' },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11.5 },
  tipTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  tipBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18 },
  tipLink: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
