import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar, Card, GhostButton, Screen, SectionTitle, Stars } from '@/components/AppPrimitives';
import { Review, timeAgo, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  tone = 'default',
  right,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'destructive';
  right?: React.ReactNode;
  testID?: string;
}) {
  const colors = useColors();
  const tint = tone === 'destructive' ? colors.destructive : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.settingsRow, { opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <View style={[styles.settingsIcon, { backgroundColor: tone === 'destructive' ? colors.destructiveSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={[styles.settingsLabel, { color: tone === 'destructive' ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <View style={styles.settingsRight}>
        {value ? <Text style={[styles.settingsValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /> : null)}
      </View>
    </Pressable>
  );
}

function BlockedRow({ userId }: { userId: string }) {
  const colors = useColors();
  const { getUserProfile, unblockUser } = useServiceApp();
  const [name, setName] = useState('User');
  useEffect(() => {
    getUserProfile(userId).then((p) => p && setName(p.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  return (
    <View style={styles.blockedRow}>
      <Avatar name={name} size={32} />
      <Text style={[styles.blockedName, { color: colors.foreground }]}>{name}</Text>
      <Pressable onPress={() => unblockUser(userId)} hitSlop={8}>
        <Text style={[styles.unblock, { color: colors.primary }]}>Unblock</Text>
      </Pressable>
    </View>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const colors = useColors();
  return (
    <Card style={{ gap: 7, marginBottom: 10 }}>
      <View style={styles.reviewTop}>
        <Text style={[styles.reviewName, { color: colors.foreground }]}>{review.reviewerName}</Text>
        <Text style={[styles.reviewTime, { color: colors.mutedForeground }]}>{timeAgo(review.createdAtMs)}</Text>
      </View>
      <Stars value={review.rating} size={13} />
      {review.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {review.tags.map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {review.comment ? (
        <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
      ) : null}
      <Text style={[styles.reviewJob, { color: colors.mutedForeground }]}>Job: {review.jobTitle}</Text>
    </Card>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, user, updateProfile, signOutUser, demoSignIn } = useServiceApp();
  const [showBlocked, setShowBlocked] = useState(false);

  if (!user) return null;
  const isEmployer = user.role === 'employer';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Avatar name={user.name} uri={user.avatarUrl || undefined} size={72} />
          <Text style={[styles.name, { color: colors.foreground }]} testID="profile-name">
            {user.name}
          </Text>
          <View style={styles.chipRow}>
            <View style={[styles.roleChip, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={isEmployer ? 'briefcase' : 'construct'} size={12} color={colors.primary} />
              <Text style={[styles.roleChipText, { color: colors.primary }]}>
                {isEmployer ? 'Employer' : 'Service Provider'}
              </Text>
            </View>
            {user.verified ? (
              <View style={[styles.roleChip, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                <Text style={[styles.roleChipText, { color: colors.success }]}>Verified</Text>
              </View>
            ) : null}
            {mode === 'demo' ? (
              <View style={[styles.roleChip, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="flask" size={12} color={colors.accent} />
                <Text style={[styles.roleChipText, { color: colors.accent }]}>Preview</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <Stars value={user.ratingAvg} size={15} />
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {user.ratingCount > 0 ? `${user.ratingAvg.toFixed(1)} · ${user.ratingCount} reviews` : 'No reviews yet'}
            </Text>
          </View>
          {user.workArea ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.location, { color: colors.mutedForeground }]}>{user.workArea}</Text>
            </View>
          ) : null}
          {user.bio ? <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio}</Text> : null}
          {!isEmployer && user.categories.length > 0 ? (
            <View style={styles.tagRow}>
              {user.categories.map((c) => (
                <View key={c} style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {!isEmployer && user.priceRange ? (
            <Text style={[styles.priceRange, { color: colors.foreground }]}>Typical rate: {user.priceRange}</Text>
          ) : null}
          {isEmployer && user.companyInfo ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.companyInfo}</Text>
          ) : null}
          <GhostButton label="Edit profile" icon="create-outline" testID="edit-profile" onPress={() => router.push('/profile-edit')} />
        </Card>

        <Card style={{ paddingVertical: 6, marginBottom: 16 }}>
          <SettingsRow
            icon="notifications-outline"
            label="Quote notifications"
            right={
              <Switch
                value={user.notifyQuotes}
                onValueChange={(v) => {
                  void updateProfile({ notifyQuotes: v });
                }}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
                testID="switch-notify-quotes"
              />
            }
          />
          <SettingsRow
            icon="remove-circle-outline"
            label="Blocked users"
            value={String(user.blockedUserIds.length)}
            onPress={() => setShowBlocked((s) => !s)}
            testID="row-blocked"
          />
          {showBlocked ? (
            user.blockedUserIds.length === 0 ? (
              <Text style={[styles.noBlocked, { color: colors.mutedForeground }]}>You haven't blocked anyone.</Text>
            ) : (
              user.blockedUserIds.map((id) => <BlockedRow key={id} userId={id} />)
            )
          ) : null}
          <SettingsRow icon="help-buoy-outline" label="Help & safety" onPress={() => router.push('/help')} testID="row-help" />
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            tone="destructive"
            testID="row-signout"
            onPress={async () => {
              await signOutUser();
              router.replace('/');
            }}
          />
        </Card>

        {mode === 'demo' ? (
          <Card style={{ gap: 10, marginBottom: 16 }}>
            <Text style={[styles.demoTitle, { color: colors.foreground }]}>Demo controls</Text>
            <Text style={[styles.demoBody, { color: colors.mutedForeground }]}>
              Switch between the two demo accounts to see both sides of a job.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GhostButton
                label="Employer view"
                icon="briefcase-outline"
                testID="switch-employer"
                onPress={() => demoSignIn('employer')}
                style={{ flex: 1 }}
              />
              <GhostButton
                label="Provider view"
                icon="construct-outline"
                testID="switch-provider"
                onPress={() => demoSignIn('provider')}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {user.recentReviews.length > 0 ? (
          <>
            <SectionTitle title="Recent reviews" />
            {user.recentReviews.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  roleChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontFamily: 'Inter_400Regular', fontSize: 12.5 },
  bio: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  priceRange: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  settingsIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, flex: 1 },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsValue: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingLeft: 42 },
  blockedName: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  unblock: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  noBlocked: { fontFamily: 'Inter_400Regular', fontSize: 12.5, paddingLeft: 42, paddingBottom: 8 },
  demoTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  demoBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontFamily: 'Inter_700Bold', fontSize: 13.5 },
  reviewTime: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  reviewComment: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  reviewJob: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
});
