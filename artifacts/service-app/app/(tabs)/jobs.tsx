import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EmptyState, Field, GhostButton, Pill, Screen } from '@/components/AppPrimitives';
import { JobCard } from '@/components/JobCard';
import { CATEGORIES, CATEGORY_ICONS, Job, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';
import { filterJobsByFit, getProviderBrowseJobs, isUsableCoordinates } from '@/lib/jobFit';

type Segment = { key: string; label: string };

function SegmentBar({ segments, active, onChange }: { segments: Segment[]; active: string; onChange: (k: string) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
      {segments.map((s) => (
        <Pressable
          key={s.key}
          testID={`segment-${s.key}`}
          onPress={() => onChange(s.key)}
          style={[styles.segmentItem, active === s.key ? { backgroundColor: colors.card } : null]}
        >
          <Text style={[styles.segmentText, { color: active === s.key ? colors.primary : colors.mutedForeground }]}>
            {s.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function JobsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, jobs, jobFitFilters, setJobFitFilters, clearJobFitFilters } = useServiceApp();
  const isEmployer = user?.role === 'employer';

  const [segment, setSegment] = useState(isEmployer ? 'open' : 'browse');
  const [search, setSearch] = useState('');
  const activeFilterCount =
    Number(jobFitFilters.category !== null)
    + Number(jobFitFilters.maxDistanceMiles !== null)
    + Number(jobFitFilters.workTimeFit);
  const distanceReady = isUsableCoordinates(user?.areaCoordinates);

  const fitResult = useMemo(() => {
    if (!user || isEmployer || segment !== 'browse') return { jobs: [] as Job[], missingDistanceCount: 0, unknownScheduleCount: 0 };
    const roleScopedOpenJobs = getProviderBrowseJobs(jobs, user);
    return filterJobsByFit(roleScopedOpenJobs, user, jobFitFilters);
  }, [user, jobs, isEmployer, segment, jobFitFilters]);

  const data: Job[] = useMemo(() => {
    if (!user) return [];
    if (isEmployer) {
      const mine = jobs.filter((j) => j.employerId === user.id);
      if (segment === 'open') return mine.filter((j) => j.status === 'open');
      if (segment === 'active') return mine.filter((j) => j.status === 'negotiating' || j.status === 'accepted');
      return mine.filter((j) => j.status === 'completed');
    }
    if (segment === 'saved') return jobs.filter((j) => user.savedJobIds.includes(j.id));
    if (segment === 'mine') return jobs.filter((j) => j.employeeId === user.id);
    // browse
    const q = search.trim().toLowerCase();
    return fitResult.jobs.filter((j) => {
      if (q && !`${j.title} ${j.details} ${j.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [user, jobs, isEmployer, segment, search, fitResult.jobs]);

  if (!user) return null;

  const segments: Segment[] = isEmployer
    ? [
        { key: 'open', label: 'Open' },
        { key: 'active', label: 'In progress' },
        { key: 'done', label: 'Completed' },
      ]
    : [
        { key: 'browse', label: 'Browse' },
        { key: 'saved', label: 'Saved' },
        { key: 'mine', label: 'My work' },
      ];

  const emptyCopy: Record<string, { title: string; body: string }> = {
    open: { title: 'No open jobs', body: 'Jobs you post appear here until a provider accepts them.' },
    active: { title: 'Nothing in progress', body: 'Once a provider accepts a job, you can negotiate and confirm it here.' },
    done: { title: 'No completed jobs yet', body: 'Completed jobs and their reviews will appear here.' },
    browse: { title: 'No jobs match', body: activeFilterCount > 0 ? 'Clear or adjust your fit filters to see more jobs.' : 'Try a different search.' },
    saved: { title: 'No saved jobs', body: 'Tap the bookmark on any job to keep it handy here.' },
    mine: { title: 'No accepted jobs yet', body: 'Jobs you accept will show up here so you can track them.' },
  };

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(j) => j.id}
        renderItem={({ item }) => <JobCard job={item} />}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 14 }}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.foreground }]}>Jobs</Text>
              {isEmployer ? (
                <GhostButton label="Post job" icon="add" testID="jobs-post" onPress={() => router.push('/post-job')} />
              ) : null}
            </View>
            <SegmentBar segments={segments} active={segment} onChange={setSegment} />
            {!isEmployer && segment === 'browse' ? (
              <>
                <Field
                  icon="search-outline"
                  placeholder="Search jobs, categories…"
                  value={search}
                  onChangeText={setSearch}
                  testID="search-jobs"
                  autoCapitalize="none"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                  <Pill label="All categories" active={jobFitFilters.category === null} onPress={() => setJobFitFilters({ ...jobFitFilters, category: null })} />
                  {CATEGORIES.map((c) => (
                    <Pill
                      key={c}
                      label={c}
                      icon={CATEGORY_ICONS[c]}
                      active={jobFitFilters.category === c}
                      onPress={() => setJobFitFilters({ ...jobFitFilters, category: jobFitFilters.category === c ? null : c })}
                    />
                  ))}
                </ScrollView>
                <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.filterHeading}>
                    <View style={styles.filterTitleRow}>
                      <Ionicons name="options-outline" size={17} color={colors.primary} />
                      <Text style={[styles.filterTitle, { color: colors.foreground }]}>
                        Fit filters{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}
                      </Text>
                    </View>
                    {activeFilterCount > 0 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Clear all job fit filters" testID="clear-fit-filters" onPress={clearJobFitFilters}>
                        <Text style={[styles.clearText, { color: colors.primary }]}>Clear all</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pill
                      label="Fits my hours"
                      icon="time-outline"
                      active={jobFitFilters.workTimeFit}
                      onPress={() => setJobFitFilters({ ...jobFitFilters, workTimeFit: !jobFitFilters.workTimeFit })}
                    />
                    {distanceReady
                      ? [5, 10, 25].map((miles) => (
                          <Pill
                            key={miles}
                            label={`Within ${miles} mi`}
                            icon="navigate-outline"
                            active={jobFitFilters.maxDistanceMiles === miles}
                            onPress={() => setJobFitFilters({
                              ...jobFitFilters,
                              maxDistanceMiles: jobFitFilters.maxDistanceMiles === miles ? null : miles,
                            })}
                          />
                        ))
                      : (
                          <Pill label="Distance unavailable" icon="navigate-outline" disabled />
                        )}
                  </ScrollView>
                  {!distanceReady ? (
                    <Text style={[styles.filterNote, { color: colors.mutedForeground }]}>
                      Distance filters will be available after your work area has been geocoded.
                    </Text>
                  ) : null}
                  {jobFitFilters.maxDistanceMiles !== null && fitResult.missingDistanceCount > 0 ? (
                    <Text accessibilityLiveRegion="polite" style={[styles.filterNote, { color: colors.mutedForeground }]}>
                      {fitResult.missingDistanceCount} {fitResult.missingDistanceCount === 1 ? 'job is' : 'jobs are'} hidden because the job area or your work area has not been geocoded yet.
                    </Text>
                  ) : null}
                  {jobFitFilters.workTimeFit && fitResult.unknownScheduleCount > 0 ? (
                    <Text style={[styles.filterNote, { color: colors.mutedForeground }]}>
                      {fitResult.unknownScheduleCount} legacy {fitResult.unknownScheduleCount === 1 ? 'schedule is' : 'schedules are'} included because compatibility cannot be calculated precisely.
                    </Text>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={isEmployer ? 'clipboard-outline' : 'search-outline'}
            title={emptyCopy[segment]?.title ?? 'Nothing here'}
            body={emptyCopy[segment]?.body}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  segment: { flexDirection: 'row', borderRadius: 11, padding: 4 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  filterPanel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterTitle: { fontFamily: 'Inter_700Bold', fontSize: 13.5 },
  clearText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  filterNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
});
