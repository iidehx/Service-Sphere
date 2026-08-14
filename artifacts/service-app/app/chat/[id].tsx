import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, EmptyState, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ChatMessage,
  formatClock,
  PLATFORM_FEE_RATE,
  round2,
  useChatMessages,
  useServiceApp,
} from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const colors = useColors();
  if (message.kind === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={[styles.systemText, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>
          {message.text}
        </Text>
      </View>
    );
  }
  if (message.kind === 'quote') {
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.quoteBubble, { backgroundColor: colors.card, borderColor: colors.accent }]}>
          <View style={styles.quoteHeader}>
            <Ionicons name="pricetag" size={13} color={colors.accent} />
            <Text style={[styles.quoteLabel, { color: colors.accent }]}>Quote</Text>
          </View>
          <Text style={[styles.quoteText, { color: colors.foreground }]}>{message.text}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatClock(message.createdAtMs)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.bubbleText, { color: mine ? '#fff' : colors.foreground }]}>{message.text}</Text>
        <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.65)' : colors.mutedForeground }]}>
          {formatClock(message.createdAtMs)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, chats, jobs, sendMessage, markChatRead, proposeQuote, acceptQuote } = useServiceApp();
  const { messages, loading } = useChatMessages(id);

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);
  const job = useMemo(() => (chat ? jobs.find((j) => j.id === chat.jobId) : undefined), [jobs, chat]);

  const [draft, setDraft] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [labor, setLabor] = useState('');
  const [materials, setMaterials] = useState('');
  const [hours, setHours] = useState('');
  const [extra, setExtra] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [error, setError] = useState('');

  const lastMessageAt = messages.length ? messages[messages.length - 1].createdAtMs : 0;
  useEffect(() => {
    if (chat && user) markChatRead(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, lastMessageAt]);

  if (!user) return null;
  if (!chat) {
    return (
      <Screen>
        <HeaderBar title="Conversation" onBack={() => router.back()} />
        <EmptyState icon="chatbubbles-outline" title="Conversation not found" body="It may not have synced yet." />
      </Screen>
    );
  }

  const otherId = chat.participants.find((p) => p !== user.id) ?? '';
  const otherName = chat.participantNames[otherId] ?? 'User';
  const isParticipant = chat.participants.includes(user.id);
  const blockedByMe = user.blockedUserIds.includes(otherId);
  const completed = job?.status === 'completed';
  const canQuote = Boolean(job && isParticipant && job.status === 'negotiating' && !completed);
  const myAccepted = job ? (job.employerId === user.id ? job.employerQuoteAccepted : job.employeeQuoteAccepted) : false;
  const quoteTotalNum = round2(Number(labor || 0) + Number(materials || 0) + Number(extra || 0));

  const submitQuote = async () => {
    setQuoteError('');
    const l = Number(labor);
    const m = Number(materials || 0);
    const h = Number(hours || 0);
    const x = Number(extra || 0);
    if (!labor || Number.isNaN(l) || l <= 0) return setQuoteError('Enter the labor cost.');
    if ([m, h, x].some((n) => Number.isNaN(n) || n < 0)) return setQuoteError('Amounts must be zero or more.');
    if (!job) return;
    const err = await proposeQuote(job.id, { labor: l, materials: m, expectedHours: h, extraFees: x });
    if (err) return setQuoteError(err);
    setQuoteOpen(false);
    setLabor('');
    setMaterials('');
    setHours('');
    setExtra('');
  };

  const send = () => {
    const text = draft;
    setDraft('');
    if (text.trim()) sendMessage(chat.id, text);
  };

  const reversed = [...messages].reverse();
  const inputDisabled = completed || blockedByMe;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBack} testID="chat-back">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Pressable
          style={styles.headerUser}
          testID="chat-user"
          onPress={() => otherId && router.push({ pathname: '/user/[id]', params: { id: otherId } })}
        >
          <Avatar name={otherName} size={38} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>
              {otherName}
            </Text>
            <Text numberOfLines={1} style={[styles.headerJob, { color: colors.mutedForeground }]}>
              {chat.jobTitle}
            </Text>
          </View>
        </Pressable>
        {job ? (
          <Pressable
            hitSlop={10}
            testID="chat-job"
            onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
            style={[styles.jobButton, { backgroundColor: colors.primarySoft }]}
          >
            <Ionicons name="briefcase-outline" size={17} color={colors.primary} />
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={10}
          testID="chat-report"
          onPress={() => router.push({ pathname: '/report-user', params: { userId: otherId, jobId: job?.id ?? '' } })}
          style={[styles.jobButton, { backgroundColor: colors.background }]}
        >
          <Ionicons name="flag-outline" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} mine={item.senderId === user.id} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <EmptyState icon="chatbubble-ellipses-outline" title="Say hello" body="Introduce yourself and clarify the job details." />
              </View>
            )
          }
        />

        {job && job.proposedPrice && job.status === 'negotiating' && isParticipant ? (
          <View style={[styles.quoteBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.quoteBannerTitle, { color: colors.foreground }]}>Quote on the table: ${job.proposedPrice}</Text>
              <Text style={[styles.quoteBannerBody, { color: colors.mutedForeground }]} numberOfLines={1}>
                {myAccepted ? `Waiting for ${otherName} to confirm` : 'Review the breakdown and confirm to book'}
              </Text>
            </View>
            {!myAccepted ? (
              <Pressable
                testID="banner-accept"
                onPress={() => setConfirmAccept(true)}
                style={({ pressed }) => [styles.bannerButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.bannerButtonText}>Accept</Text>
              </Pressable>
            ) : (
              <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
            )}
          </View>
        ) : null}

        {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}

        {inputDisabled ? (
          <View style={[styles.disabledBar, { backgroundColor: colors.secondary, paddingBottom: insets.bottom + 12 }]}>
            <Ionicons name={completed ? 'checkmark-done-outline' : 'remove-circle-outline'} size={16} color={colors.mutedForeground} />
            <Text style={[styles.disabledText, { color: colors.mutedForeground }]}>
              {completed
                ? 'This job is completed — the conversation is closed.'
                : 'You blocked this user. Unblock them from your profile to message.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
            {canQuote ? (
              <Pressable
                testID="open-quote-composer"
                onPress={() => setQuoteOpen(true)}
                hitSlop={6}
                style={[styles.quoteButton, { backgroundColor: colors.accentSoft }]}
              >
                <Ionicons name="pricetag-outline" size={19} color={colors.accent} />
              </Pressable>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.background, color: colors.foreground }]}
              multiline
              testID="chat-input"
            />
            <Pressable
              testID="chat-send"
              onPress={send}
              disabled={!draft.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: draft.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="arrow-up" size={19} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={quoteOpen} transparent animationType="slide" onRequestClose={() => setQuoteOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Send a quote</Text>
              <Pressable onPress={() => setQuoteOpen(false)} hitSlop={10} testID="close-quote">
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={{ gap: 12 }}>
              <Field label="Labor (USD)" icon="hammer-outline" placeholder="e.g. 120" keyboardType="numeric" value={labor} onChangeText={setLabor} testID="quote-labor" />
              <Field label="Materials (USD)" icon="cube-outline" placeholder="e.g. 15" keyboardType="numeric" value={materials} onChangeText={setMaterials} testID="quote-materials" />
              <Field label="Expected hours" icon="time-outline" placeholder="e.g. 2" keyboardType="numeric" value={hours} onChangeText={setHours} testID="quote-hours" />
              <Field label="Extra fees (USD)" icon="add-circle-outline" placeholder="e.g. 10" keyboardType="numeric" value={extra} onChangeText={setExtra} testID="quote-extra" />
              <View style={[styles.totalRow, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.totalLabel, { color: colors.primary }]}>Total quote</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>${quoteTotalNum}</Text>
              </View>
              <Text style={[styles.feeNote, { color: colors.mutedForeground }]}>
                After the 5% platform fee, the provider receives ${round2(quoteTotalNum * (1 - PLATFORM_FEE_RATE))}.
              </Text>
              {quoteError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{quoteError}</Text> : null}
              <PrimaryButton label="Send quote" icon="paper-plane-outline" onPress={submitQuote} testID="send-quote" />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmAccept}
        title="Accept this quote?"
        body={
          job && job.proposedPrice
            ? `You're agreeing to "${job.title}" at $${job.proposedPrice}. After the 5% platform fee ($${round2(job.proposedPrice * PLATFORM_FEE_RATE)}), the provider receives $${round2(job.proposedPrice * (1 - PLATFORM_FEE_RATE))}. When both sides accept, the job is confirmed.`
            : ''
        }
        confirmLabel="Accept quote"
        onConfirm={async () => {
          setConfirmAccept(false);
          if (job) {
            const err = await acceptQuote(job.id);
            if (err) setError(err);
          }
        }}
        onCancel={() => setConfirmAccept(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  headerBack: { width: 32, alignItems: 'flex-start' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontFamily: 'Inter_700Bold', fontSize: 14.5 },
  headerJob: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  jobButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { marginVertical: 4, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, gap: 3 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  time: { fontFamily: 'Inter_400Regular', fontSize: 10, alignSelf: 'flex-end' },
  systemWrap: { alignItems: 'center', marginVertical: 8 },
  systemText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: '88%',
  },
  quoteBubble: { maxWidth: '80%', borderRadius: 12, borderWidth: 1.2, padding: 12, gap: 4 },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quoteLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  quoteText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  quoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  quoteBannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 13.5 },
  quoteBannerBody: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  bannerButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  bannerButtonText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  quoteButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    maxHeight: 110,
  },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  disabledBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 13, paddingHorizontal: 16 },
  disabledText: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, paddingHorizontal: 16, paddingBottom: 6 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 13 },
  totalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  totalValue: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  feeNote: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
});
