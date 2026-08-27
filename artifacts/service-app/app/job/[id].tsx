import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Avatar,
  Card,
  EmptyState,
  Field,
  GhostButton,
  HeaderBar,
  KeyValueRow,
  PayBadge,
  PrimaryButton,
  Screen,
  StatusBadge,
} from '@/components/AppPrimitives';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  CATEGORY_ICONS,
  chatIdForJob,
  EMPTY_JOB_PHOTOS,
  formatScheduledAt,
  JobPhotos,
  MAX_JOB_PHOTOS,
  PLATFORM_FEE_RATE,
  round2,
  timeAgo,
  useServiceApp,
} from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

function PhotoStrip({ uris }: { uris: string[] }) {
  if (!uris.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {uris.map((uri) => (
        <Image key={uri} source={{ uri }} style={styles.photoThumb} contentFit="cover" />
      ))}
    </ScrollView>
  );
}

const STEPS = ['Posted', 'Accepted', 'Quote agreed', 'Completed'];

function Timeline({ statusIndex }: { statusIndex: number }) {
  const colors = useColors();
  return (
    <View style={styles.timeline}>
      {STEPS.map((step, i) => {
        const done = i <= statusIndex;
        const current = i === statusIndex;
        return (
          <React.Fragment key={step}>
            {i > 0 ? (
              <View style={[styles.timelineLine, { backgroundColor: i <= statusIndex ? colors.primary : colors.muted }]} />
            ) : null}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: done ? colors.primary : colors.card,
                    borderColor: done ? colors.primary : colors.input,
                  },
                  current ? { borderColor: colors.accent, borderWidth: 2 } : null,
                ]}
              >
                {done ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
              </View>
              <Text style={[styles.timelineLabel, { color: done ? colors.foreground : colors.mutedForeground }]}>{step}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function JobDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    user,
    jobs,
    chats,
    toggleSaved,
    acceptJob,
    acceptQuote,
    declineQuote,
    updatePayment,
    completeJob,
    setJobExactAddress,
    getJobExactAddress,
    getJobPhotos,
    addAfterPhotos,
  } = useServiceApp();

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id]);
  const [confirm, setConfirm] = useState<null | 'acceptQuote' | 'complete' | 'paid' | 'refund' | 'acceptJob'>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exactAddress, setExactAddress] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [addressError, setAddressError] = useState('');
  const [addressBusy, setAddressBusy] = useState(false);
  const [photos, setPhotos] = useState<JobPhotos>(EMPTY_JOB_PHOTOS);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const isEmployerOnJob = job?.employerId === user?.id;
  const isProviderOnJob = job?.employeeId === user?.id;
  const isParticipant = !!job && !!user && (isEmployerOnJob || isProviderOnJob);
  const canAddAfterPhotos = isProviderOnJob && (job?.status === 'accepted' || job?.status === 'completed');
  // The precise address is only unlocked for the provider once the employer
  // has actually accepted them (status 'accepted'/'completed') — merely
  // claiming/negotiating an open job must not reveal it. Mirrors
  // isPrivateParticipant() in firestore.rules; the employer can always see
  // and edit it regardless of status.
  const canAccessExactAddress =
    !!job && !!user && (isEmployerOnJob || (isProviderOnJob && (job.status === 'accepted' || job.status === 'completed')));

  useEffect(() => {
    // Only ever fetched for an authorized participant — see
    // getJobExactAddress / firestore.rules jobs/{jobId}/private/location.
    if (!job || !canAccessExactAddress) {
      setExactAddress(null);
      return;
    }
    let cancelled = false;
    getJobExactAddress(job.id).then((address) => {
      if (!cancelled) setExactAddress(address);
    });
    return () => {
      cancelled = true;
    };
  }, [job?.id, job?.status, canAccessExactAddress]);

  useEffect(() => {
    // Before/after photos are only ever fetched for a job participant — see
    // getJobPhotos / firestore.rules jobs/{jobId}/private/photos.
    if (!job || !isParticipant) {
      setPhotos(EMPTY_JOB_PHOTOS);
      return;
    }
    let cancelled = false;
    getJobPhotos(job.id).then((result) => {
      if (!cancelled) setPhotos(result);
    });
    return () => {
      cancelled = true;
    };
  }, [job?.id, isParticipant]);

  const pickAfterPhotos = async () => {
    if (!job) return;
    setPhotoError('');
    const room = MAX_JOB_PHOTOS - photos.afterPhotoUrls.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoBusy(true);
    const err = await addAfterPhotos(job.id, result.assets.map((a) => a.uri));
    if (err) {
      setPhotoBusy(false);
      setPhotoError(err);
      return;
    }
    const refreshed = await getJobPhotos(job.id);
    setPhotos(refreshed);
    setPhotoBusy(false);
  };

  const startEditingAddress = () => {
    setAddressDraft(exactAddress ?? '');
    setAddressError('');
    setEditingAddress(true);
  };

  const saveExactAddress = async () => {
    if (!job) return;
    setAddressBusy(true);
    setAddressError('');
    const err = await setJobExactAddress(job.id, addressDraft.trim());
    setAddressBusy(false);
    if (err) {
      setAddressError(err);
      return;
    }
    setExactAddress(addressDraft.trim() || null);
    setEditingAddress(false);
  };

  if (!user) return null;
  if (!job) {
    return (
      <Screen>
        <HeaderBar title="Job details" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Job not found" body="It may have been removed, or it hasn't synced yet." />
      </Screen>
    );
  }

  const statusIndex = job.status === 'open' ? 0 : job.status === 'negotiating' ? 1 : job.status === 'accepted' ? 2 : 3;
  const saved = user.savedJobIds.includes(job.id);
  const chatId = chatIdForJob(job.id);
  const hasChat = chats.some((c) => c.id === chatId);
  const fee = job.proposedPrice ? round2(job.proposedPrice * PLATFORM_FEE_RATE) : 0;
  const myAccepted = isEmployerOnJob ? job.employerQuoteAccepted : job.employeeQuoteAccepted;
  const otherAccepted = isEmployerOnJob ? job.employeeQuoteAccepted : job.employerQuoteAccepted;
  const otherName = isEmployerOnJob ? job.employeeName ?? 'the provider' : job.employerName;
  const canReview = job.status === 'completed' && isParticipant && !!job.employeeId && !job.reviewedBy.includes(user.id);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError('');
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  const doAcceptJob = async () => {
    setBusy(true);
    setError('');
    const res = await acceptJob(job.id);
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.chatId) router.push({ pathname: '/chat/[id]', params: { id: res.chatId } });
  };

  return (
    <Screen>
      <HeaderBar
        title="Job details"
        onBack={() => router.back()}
        right={
          user.role === 'provider' && !isEmployerOnJob ? (
            <Pressable hitSlop={10} testID="detail-save" onPress={() => toggleSaved(job.id)}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.accent : colors.primary} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: 12 }}>
          <Timeline statusIndex={statusIndex} />
        </Card>

        <Card style={{ gap: 12, marginTop: 12 }}>
          <View style={styles.titleRow}>
            <View style={[styles.categoryIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={CATEGORY_ICONS[job.category] ?? 'ellipsis-horizontal-circle'} size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, { color: colors.foreground }]} testID="job-title">
                {job.title}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {job.category} · Posted {timeAgo(job.createdAtMs)}
              </Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <StatusBadge status={job.status} />
            {job.status === 'accepted' || job.status === 'completed' ? <PayBadge status={job.paymentStatus} /> : null}
          </View>
          <View style={[styles.infoStrip, { backgroundColor: colors.background }]}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                {job.agreedPrice ? 'Agreed price' : job.proposedPrice ? 'Latest quote' : 'Price offer'}
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                ${job.agreedPrice ?? job.proposedPrice ?? job.priceOffer}
              </Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.infoItem, { flex: 1.6 }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Schedule</Text>
              <Text style={[styles.infoValue, { color: colors.foreground, fontSize: 13.5 }]} numberOfLines={2}>
                {job.leaveTimeToEmployee ? 'Provider suggests a time' : formatScheduledAt(job.scheduledAt) || 'Not set'}
              </Text>
            </View>
          </View>
          {job.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]} testID="job-location">
                {job.location}
              </Text>
            </View>
          ) : null}
          {canAccessExactAddress && exactAddress && !editingAddress ? (
            <View style={styles.locationRow}>
              <Ionicons name="pin-outline" size={15} color={colors.foreground} />
              <Text style={[styles.locationText, { color: colors.foreground }]} testID="job-exact-address">
                {exactAddress}
              </Text>
            </View>
          ) : null}
          {isEmployerOnJob && !editingAddress ? (
            <Pressable testID="edit-exact-address" onPress={startEditingAddress} style={styles.locationRow}>
              <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.primary }]}>
                {exactAddress ? 'Edit exact address' : 'Add exact address (private, optional)'}
              </Text>
            </Pressable>
          ) : null}
          {isEmployerOnJob && editingAddress ? (
            <View style={{ gap: 4 }}>
              <Field
                icon="pin-outline"
                placeholder="e.g. 1200 Elm St, Austin, TX"
                value={addressDraft}
                onChangeText={setAddressDraft}
                error={addressError}
                testID="input-edit-exact-address"
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Only shared with you and the accepted provider — never shown on the public listing.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <GhostButton
                  testID="cancel-exact-address"
                  label="Cancel"
                  onPress={() => {
                    setEditingAddress(false);
                    setAddressError('');
                  }}
                />
                <PrimaryButton testID="save-exact-address" label="Save" onPress={saveExactAddress} loading={addressBusy} />
              </View>
            </View>
          ) : null}
          <Text style={[styles.details, { color: colors.mutedForeground }]}>{job.details}</Text>
        </Card>

        {isParticipant && (photos.beforePhotoUrls.length || photos.afterPhotoUrls.length || canAddAfterPhotos) ? (
          <Card style={{ gap: 12, marginTop: 12 }}>
            {photos.beforePhotoUrls.length ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Before</Text>
                <PhotoStrip uris={photos.beforePhotoUrls} />
              </View>
            ) : null}
            {photos.afterPhotoUrls.length || canAddAfterPhotos ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>After</Text>
                <PhotoStrip uris={photos.afterPhotoUrls} />
                {canAddAfterPhotos && photos.afterPhotoUrls.length < MAX_JOB_PHOTOS ? (
                  <Pressable testID="pick-after-photos" onPress={pickAfterPhotos} style={styles.addAfterPhotoRow} disabled={photoBusy}>
                    {photoBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="camera-outline" size={16} color={colors.primary} />
                    )}
                    <Text style={[styles.locationText, { color: colors.primary }]}>Add completion photos</Text>
                  </Pressable>
                ) : null}
                {photoError ? <Text style={[styles.error, { color: colors.destructive, marginTop: 0 }]}>{photoError}</Text> : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: 4, marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>People</Text>
          <Pressable
            testID="person-employer"
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: job.employerId } })}
            style={({ pressed }) => [styles.personRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar name={job.employerName} size={40} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.personName, { color: colors.foreground }]}>{job.employerName}</Text>
              <Text style={[styles.personRole, { color: colors.mutedForeground }]}>Employer</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
          {job.employeeId && job.employeeName ? (
            <Pressable
              testID="person-provider"
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: job.employeeId as string } })}
              style={({ pressed }) => [styles.personRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Avatar name={job.employeeName} size={40} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[styles.personName, { color: colors.foreground }]}>{job.employeeName}</Text>
                <Text style={[styles.personRole, { color: colors.mutedForeground }]}>Service provider</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <View style={styles.personRow}>
              <View style={[styles.pendingIcon, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
              </View>
              <Text style={[styles.personRole, { color: colors.mutedForeground, flex: 1 }]}>
                Waiting for a provider to accept
              </Text>
            </View>
          )}
        </Card>

        {job.proposedPrice && job.quoteBreakdown ? (
          <Card style={{ gap: 6, marginTop: 12 }}>
            <View style={styles.quoteHeader}>
              <Ionicons name="pricetag-outline" size={16} color={colors.accent} />
              <Text style={[styles.sectionLabelStrong, { color: colors.foreground }]}>Quote</Text>
              <Text style={[styles.quoteBy, { color: colors.mutedForeground }]}>
                by {job.quoteBy === job.employerId ? job.employerName : job.employeeName ?? 'provider'}
              </Text>
            </View>
            <KeyValueRow label="Labor" value={`$${job.quoteBreakdown.labor}`} />
            <KeyValueRow label="Materials" value={`$${job.quoteBreakdown.materials}`} />
            <KeyValueRow label="Expected hours" value={`${job.quoteBreakdown.expectedHours} h`} />
            <KeyValueRow label="Extra fees" value={`$${job.quoteBreakdown.extraFees}`} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <KeyValueRow label="Total" value={`$${job.proposedPrice}`} strong />
            {job.status === 'negotiating' && isParticipant ? (
              <View style={{ gap: 10, marginTop: 6 }}>
                <View style={styles.acceptRow}>
                  <Ionicons
                    name={myAccepted ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={myAccepted ? colors.success : colors.mutedForeground}
                  />
                  <Text style={[styles.acceptText, { color: colors.mutedForeground }]}>
                    You {myAccepted ? 'accepted' : "haven't accepted yet"}
                  </Text>
                  <Ionicons
                    name={otherAccepted ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={otherAccepted ? colors.success : colors.mutedForeground}
                  />
                  <Text style={[styles.acceptText, { color: colors.mutedForeground }]}>
                    {otherName} {otherAccepted ? 'accepted' : 'pending'}
                  </Text>
                </View>
                {!myAccepted ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <PrimaryButton
                      label={`Accept quote ($${job.proposedPrice})`}
                      testID="accept-quote"
                      onPress={() => setConfirm('acceptQuote')}
                      style={{ flex: 1 }}
                      loading={busy}
                    />
                    {job.quoteBy !== user.id ? (
                      <GhostButton label="Decline" tone="destructive" testID="decline-quote" onPress={() => run(() => declineQuote(job.id))} />
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.waiting, { color: colors.mutedForeground }]}>
                    Waiting for {otherName} to confirm the quote.
                  </Text>
                )}
              </View>
            ) : null}
          </Card>
        ) : null}

        {job.agreedPrice ? (
          <Card style={{ gap: 6, marginTop: 12 }}>
            <Text style={[styles.sectionLabelStrong, { color: colors.foreground }]}>Payment</Text>
            <KeyValueRow label="Agreed price" value={`$${job.agreedPrice}`} strong />
            <KeyValueRow label="Platform fee (5%, provider)" value={`−$${job.platformFee ?? round2(job.agreedPrice * PLATFORM_FEE_RATE)}`} />
            <KeyValueRow
              label="Provider receives"
              value={`$${round2(job.agreedPrice - (job.platformFee ?? round2(job.agreedPrice * PLATFORM_FEE_RATE)))}`}
            />
            <View style={styles.badgeRow}>
              <PayBadge status={job.paymentStatus} />
              <Text style={[styles.payNote, { color: colors.mutedForeground }]}>
                Payment happens outside the app (cash or transfer).
              </Text>
            </View>
            {isEmployerOnJob ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                {job.paymentStatus === 'pending' ? (
                  <GhostButton label="Mark as paid" icon="cash-outline" testID="mark-paid" onPress={() => setConfirm('paid')} style={{ flex: 1 }} />
                ) : null}
                {job.paymentStatus === 'paid' ? (
                  <GhostButton label="Mark refunded" tone="destructive" testID="mark-refunded" onPress={() => setConfirm('refund')} style={{ flex: 1 }} />
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        <View style={{ gap: 10, marginTop: 16 }}>
          {user.role === 'provider' && job.status === 'open' && !isEmployerOnJob ? (
            <>
              <PrimaryButton label="Accept job & start chat" icon="chatbubbles-outline" testID="accept-job" onPress={() => setConfirm('acceptJob')} loading={busy} />
              <Text style={[styles.feeHint, { color: colors.mutedForeground }]}>
                Free to accept. A 5% platform fee applies only to the final agreed price.
              </Text>
            </>
          ) : null}
          {hasChat && isParticipant ? (
            <GhostButton
              label="Open conversation"
              icon="chatbubble-ellipses-outline"
              testID="open-chat"
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chatId } })}
            />
          ) : null}
          {isEmployerOnJob && job.status === 'accepted' ? (
            <PrimaryButton label="Mark job as completed" icon="checkmark-done-outline" testID="complete-job" onPress={() => setConfirm('complete')} loading={busy} />
          ) : null}
          {canReview ? (
            <PrimaryButton
              label={`Rate ${isEmployerOnJob ? job.employeeName : job.employerName}`}
              icon="star-outline"
              testID="leave-review"
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: job.id } })}
            />
          ) : null}
          {job.status === 'completed' && isParticipant && job.reviewedBy.includes(user.id) ? (
            <Text style={[styles.waiting, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Thanks — you already left a review for this job.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirm === 'acceptJob'}
        title="Accept this job?"
        body={`You'll start a conversation with ${job.employerName} to agree on the details and price.`}
        confirmLabel="Accept job"
        onConfirm={() => {
          setConfirm(null);
          doAcceptJob();
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'acceptQuote'}
        title="Accept this quote?"
        body={`You're agreeing to "${job.title}" at $${job.proposedPrice}. After the 5% platform fee ($${fee}), the provider receives $${round2((job.proposedPrice ?? 0) - fee)}. When both sides accept, the job is confirmed.`}
        confirmLabel="Accept quote"
        onConfirm={() => {
          setConfirm(null);
          run(() => acceptQuote(job.id));
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'complete'}
        title="Mark as completed?"
        body="Confirm the work is done. Both sides will then be able to leave a review."
        confirmLabel="Mark completed"
        onConfirm={() => {
          setConfirm(null);
          run(() => completeJob(job.id));
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'paid'}
        title="Mark payment as paid?"
        body={`Confirm you've paid $${job.agreedPrice} to ${job.employeeName ?? 'the provider'} outside the app.`}
        confirmLabel="Mark paid"
        onConfirm={() => {
          setConfirm(null);
          run(() => updatePayment(job.id, 'paid'));
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'refund'}
        title="Mark as refunded?"
        body="Use this only if the payment was returned to you."
        confirmLabel="Mark refunded"
        destructive
        onConfirm={() => {
          setConfirm(null);
          run(() => updatePayment(job.id, 'refunded'));
        }}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  timeline: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineStep: { alignItems: 'center', gap: 5, width: 74 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, height: 2, marginTop: 10, marginHorizontal: -14 },
  timelineLabel: { fontFamily: 'Inter_500Medium', fontSize: 10.5, textAlign: 'center' },
  titleRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  categoryIcon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 23 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  infoStrip: { flexDirection: 'row', borderRadius: 10, padding: 12, gap: 12, alignItems: 'center' },
  infoItem: { flex: 1, gap: 3 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  infoValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  infoDivider: { width: 1, alignSelf: 'stretch' },
  details: { fontFamily: 'Inter_400Regular', fontSize: 13.5, lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  sectionLabelStrong: { fontFamily: 'Inter_700Bold', fontSize: 14.5 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  personName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  personRole: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  pendingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quoteBy: { fontFamily: 'Inter_400Regular', fontSize: 12, marginLeft: 'auto' },
  divider: { height: 1, marginVertical: 4 },
  acceptRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  acceptText: { fontFamily: 'Inter_500Medium', fontSize: 12, marginRight: 8 },
  waiting: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  payNote: { fontFamily: 'Inter_400Regular', fontSize: 11.5, flex: 1 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 12 },
  feeHint: { fontFamily: 'Inter_400Regular', fontSize: 11.5, textAlign: 'center' },
  photoThumb: { width: 84, height: 84, borderRadius: 10 },
  addAfterPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
});
