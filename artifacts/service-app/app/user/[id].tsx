import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Card, EmptyState, GhostButton, HeaderBar, PrimaryButton, Screen, SectionTitle, Stars } from '@/components/AppPrimitives';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatMonthYear, PublicProfile, Review, timeAgo, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

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
      {review.comment ? <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text> : null}
      <Text style={[styles.reviewJob, { color: colors.mutedForeground }]}>Job: {review.jobTitle}</Text>
    </Card>
  );
}

export default function UserProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, chats, getUserProfile, blockUser, unblockUser } = useServiceApp();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    let live = true;
    if (id) {
      setLoading(true);
      getUserProfile(id).then((p) => {
        if (live) {
          setProfile(p);
          setLoading(false);
        }
      });
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!user) return null;

  const isSelf = id === user.id;
  const blocked = id ? user.blockedUserIds.includes(id) : false;
  const sharedChat = chats.find((c) => c.participants.includes(user.id) && id && c.participants.includes(id));

  return (
    <Screen>
      <HeaderBar title="Profile" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !profile ? (
        <EmptyState icon="person-outline" title="Profile not found" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={{ alignItems: 'center', gap: 8 }}>
            <Avatar name={profile.name} uri={profile.avatarUrl || undefined} size={72} />
            <Text style={[styles.name, { color: colors.foreground }]} testID="public-name">
              {profile.name}
            </Text>
            <View style={styles.chipRow}>
              <View style={[styles.roleChip, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={profile.role === 'employer' ? 'briefcase' : 'construct'} size={12} color={colors.primary} />
                <Text style={[styles.roleChipText, { color: colors.primary }]}>
                  {profile.role === 'employer' ? 'Employer' : 'Service Provider'}
                </Text>
              </View>
              {profile.verified ? (
                <View style={[styles.roleChip, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                  <Text style={[styles.roleChipText, { color: colors.success }]}>Verified</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.ratingRow}>
              <Stars value={profile.ratingAvg} size={15} />
              <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
                {profile.ratingCount > 0
                  ? `${profile.ratingAvg.toFixed(1)} · ${profile.ratingCount} reviews`
                  : 'No reviews yet'}
              </Text>
            </View>
            {profile.workArea ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.location, { color: colors.mutedForeground }]}>{profile.workArea}</Text>
              </View>
            ) : null}
            {profile.createdAtMs ? (
              <Text style={[styles.member, { color: colors.mutedForeground }]}>
                Member since {formatMonthYear(profile.createdAtMs)}
              </Text>
            ) : null}
            {profile.bio ? <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text> : null}
            {profile.role === 'provider' && profile.categories.length > 0 ? (
              <View style={styles.tagRow}>
                {profile.categories.map((c) => (
                  <View key={c} style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {profile.role === 'provider' && profile.priceRange ? (
              <Text style={[styles.priceRange, { color: colors.foreground }]}>Typical rate: {profile.priceRange}</Text>
            ) : null}
            {profile.role === 'employer' && profile.companyInfo ? (
              <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.companyInfo}</Text>
            ) : null}
          </Card>

          {!isSelf ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              {sharedChat ? (
                <PrimaryButton
                  label="Message"
                  icon="chatbubble-ellipses-outline"
                  testID="profile-message"
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: sharedChat.id } })}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <GhostButton
                  label="Report"
                  icon="flag-outline"
                  testID="profile-report"
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/report-user', params: { userId: profile.id } })}
                />
                {blocked ? (
                  <GhostButton
                    label="Unblock"
                    icon="lock-open-outline"
                    testID="profile-unblock"
                    style={{ flex: 1 }}
                    onPress={() => unblockUser(profile.id)}
                  />
                ) : (
                  <GhostButton
                    label="Block"
                    icon="remove-circle-outline"
                    tone="destructive"
                    testID="profile-block"
                    style={{ flex: 1 }}
                    onPress={() => setConfirmBlock(true)}
                  />
                )}
              </View>
            </View>
          ) : null}

          {profile.recentReviews.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <SectionTitle title="Recent reviews" />
              {profile.recentReviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <ConfirmDialog
        visible={confirmBlock}
        title={`Block ${profile?.name ?? 'this user'}?`}
        body="They won't be able to message you, and you won't see their jobs. You can unblock them anytime from your profile."
        confirmLabel="Block"
        destructive
        onConfirm={() => {
          setConfirmBlock(false);
          if (profile) blockUser(profile.id);
        }}
        onCancel={() => setConfirmBlock(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Inter_700Bold', fontSize: 19 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  roleChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontFamily: 'Inter_400Regular', fontSize: 12.5 },
  member: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  bio: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  priceRange: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontFamily: 'Inter_700Bold', fontSize: 13.5 },
  reviewTime: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  reviewComment: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  reviewJob: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
});
