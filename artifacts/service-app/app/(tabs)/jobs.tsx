import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Pill, SectionTitle, StatusBadge } from '@/components/AppPrimitives';
import { useServiceApp, Job } from '@/context/ServiceAppContext';

const categories = ['All', 'Cleaning', 'Plumbing', 'Electrical', 'Painting', 'Landscaping', 'Moving', 'Handyman'];

function JobRow({ job, providerMode, onSave }: { job: Job; providerMode: boolean; onSave: () => void }) {
  const colors = useColors();
  return <Pressable onPress={() => router.push(`/job/${job.id}`)} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}><Ionicons name={job.category === 'Cleaning' ? 'sparkles-outline' : job.category === 'Painting' ? 'color-palette-outline' : 'construct-outline'} size={20} color={colors.primary} /></View><View style={styles.rowContent}><View style={styles.rowTitleLine}><Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{job.title}</Text>{providerMode ? <Pressable onPress={onSave} hitSlop={10}><Ionicons name={job.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={job.saved ? colors.accent : colors.mutedForeground} /></Pressable> : null}</View><Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{job.category} · {job.scheduledAt}</Text><View style={styles.rowBottom}><Text style={[styles.rowPrice, { color: colors.primary }]}>${job.agreedPrice ?? job.proposedPrice ?? job.priceOffer}</Text><StatusBadge status={job.status} /><View style={styles.flex} /><Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} /></View></View></Pressable>;
}

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, jobs, toggleSaved } = useServiceApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const isProvider = currentUser.role === 'provider';
  const visible = useMemo(() => jobs.filter((job) => {
    const roleMatch = isProvider ? job.status === 'open' || job.employeeId === currentUser.id : job.employerId === currentUser.id;
    const textMatch = `${job.title} ${job.category}`.toLowerCase().includes(search.toLowerCase());
    const catMatch = category === 'All' || job.category === category;
    return roleMatch && textMatch && catMatch && (!savedOnly || job.saved);
  }), [jobs, isProvider, currentUser.id, search, category, savedOnly]);
  return <View style={[styles.root, { backgroundColor: colors.background }]}><FlatList data={visible} keyExtractor={(item) => item.id} renderItem={({ item }) => <JobRow job={item} providerMode={isProvider} onSave={() => toggleSaved(item.id)} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]} ListHeaderComponent={<><View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{isProvider ? 'YOUR MARKETPLACE' : 'YOUR WORKSPACE'}</Text><Text style={[styles.title, { color: colors.foreground }]}>{isProvider ? 'Find your next job' : 'Your job requests'}</Text></View>{!isProvider ? <Pressable onPress={() => router.push('/post-job')} style={[styles.addButton, { backgroundColor: colors.accent }]}><Ionicons name="add" size={22} color={colors.primaryForeground} /></Pressable> : null}</View><View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card }]}><Ionicons name="search-outline" size={18} color={colors.mutedForeground} /><TextInput value={search} onChangeText={setSearch} placeholder="Search by service or area" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} /><Pressable onPress={() => setSavedOnly(!savedOnly)}><Ionicons name={savedOnly ? 'bookmark' : 'bookmark-outline'} size={19} color={savedOnly ? colors.accent : colors.mutedForeground} /></Pressable></View><View><SectionTitle title={`${visible.length} ${visible.length === 1 ? 'result' : 'results'}`} /><FlatList horizontal data={categories} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Pill label={item} active={category === item} onPress={() => setCategory(item)} />} /></View></>} ListEmptyComponent={<View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}><Ionicons name="search-outline" size={26} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs match that yet</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Try another category or clear your search.</Text></View>} showsVerticalScrollIndicator={false} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 13 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, marginTop: 4, letterSpacing: -0.5 },
  addButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 49, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 11 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, gap: 6 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14 },
  rowMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowPrice: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  flex: { flex: 1 },
  empty: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: 'center', gap: 6, marginTop: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});