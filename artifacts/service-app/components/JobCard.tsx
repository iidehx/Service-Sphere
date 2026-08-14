import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBadge } from '@/components/AppPrimitives';
import { CATEGORY_ICONS, Job, timeAgo, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

export function JobCard({ job, showSave = true }: { job: Job; showSave?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const { user, toggleSaved } = useServiceApp();
  const saved = user?.savedJobIds.includes(job.id) ?? false;
  const canSave = showSave && user?.role === 'provider' && job.employerId !== user?.id;
  const price = job.agreedPrice ?? job.proposedPrice ?? job.priceOffer;
  const priceLabel = job.agreedPrice ? 'agreed' : job.proposedPrice ? 'quoted' : 'offer';

  return (
    <Pressable
      testID={`job-card-${job.id}`}
      onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.categoryIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={CATEGORY_ICONS[job.category] ?? 'ellipsis-horizontal-circle'} size={17} color={colors.primary} />
        </View>
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
            {job.title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>
            {job.category} · {job.employerName} · {timeAgo(job.createdAtMs)}
          </Text>
        </View>
        <StatusBadge status={job.status} />
      </View>

      {job.details ? (
        <Text numberOfLines={2} style={[styles.details, { color: colors.mutedForeground }]}>
          {job.details}
        </Text>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={styles.priceWrap}>
          <Text style={[styles.price, { color: colors.foreground }]}>${price}</Text>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{priceLabel}</Text>
        </View>
        {job.scheduledAt ? (
          <View style={[styles.scheduleChip, { backgroundColor: colors.background }]}>
            <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[styles.scheduleText, { color: colors.mutedForeground }]}>
              {job.leaveTimeToEmployee ? 'Provider picks time' : job.scheduledAt}
            </Text>
          </View>
        ) : null}
        {canSave ? (
          <Pressable hitSlop={10} testID={`save-${job.id}`} onPress={() => toggleSaved(job.id)}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.accent : colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, gap: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 14.5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  details: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flex: 1 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  priceLabel: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 180,
  },
  scheduleText: { fontFamily: 'Inter_500Medium', fontSize: 11.5 },
});
