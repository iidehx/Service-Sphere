import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Avatar,
  Card,
  EmptyState,
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
  PLATFORM_FEE_RATE,
  round2,
  timeAgo,
  useServiceApp,
} from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

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
  } = useServiceApp();

  const job = useMemo(() => jobs.find((j) => j.id === id), [jobs, id]);
  const [confirm, setConfirm] = useState<null | 'acceptQuote' | 'complete' | 'paid' | 'refund' | 'acceptJob'>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  if (!job) {
    return (
      <Screen>
        <HeaderBar title="Job details" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Job not found" body="It may have been removed, or it hasn't synced yet." />
      </Screen>
    );
  }

  const isEmployerOnJob = job.employerId === user.id;
  const isProviderOnJob = job.employeeId === user.id;
  const isParticipant = isEmployerOnJob || isProviderOnJob;
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
                {job.leaveTimeToEmployee ? 'Provider suggests a time' : job.scheduledAt || 'Not set'}
              </Text>
            </View>
          </View>
          <Text style={[styles.details, { color: colors.mutedForeground }]}>{job.details}</Text>
        </Card>

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
});
