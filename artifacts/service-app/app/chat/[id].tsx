import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Field, GhostButton, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { useServiceApp } from '@/context/ServiceAppContext';

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, chats, jobs, sendMessage } = useServiceApp();
  const chat = chats.find((item) => item.id === id);
  const job = jobs.find((item) => item.id === chat?.jobId || `chat-${item.id}` === id);
  const [message, setMessage] = useState('');
  if (!chat || !job) return <Screen><View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Conversation not found</Text><GhostButton label="Go back" onPress={() => router.back()} /></View></Screen>;
  const disabled = job.status === 'completed';
  const blocked = false;
  const onSend = () => { sendMessage(chat.id, message); setMessage(''); };
  const report = () => Alert.alert('Safety first', 'Report or block this person from the conversation.', [{ text: 'Report user', style: 'destructive' }, { text: 'Block user' }, { text: 'Cancel', style: 'cancel' }]);
  return <Screen><View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={25} color={colors.primary} /></Pressable><Pressable onPress={() => router.push(`/job/${job.id}`)} style={styles.titleWrap}><Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>{job.title}</Text><Text style={[styles.topMeta, { color: colors.mutedForeground }]}>{job.employeeName ?? 'Service App conversation'}</Text></Pressable><Pressable onPress={report} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} /></Pressable></View><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}><FlatList inverted data={[...chat.messages].reverse()} keyExtractor={(item) => item.id} contentContainerStyle={[styles.messages, { paddingBottom: 12 }]} renderItem={({ item }) => { const mine = item.senderId === currentUser.id; return <View style={[styles.messageRow, mine && styles.mineRow]}><View style={[styles.bubble, { backgroundColor: mine ? colors.primary : colors.card, borderColor: colors.border }]}><Text style={[styles.messageText, { color: mine ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text><Text style={[styles.messageTime, { color: mine ? 'rgba(255,255,255,0.62)' : colors.mutedForeground }]}>{item.createdAt}</Text></View></View>; }} ListHeaderComponent={<View style={styles.chatFooter}><View style={[styles.infoCard, { backgroundColor: colors.secondary }]}><Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} /><Text style={[styles.infoText, { color: colors.mutedForeground }]}>Keep payment and personal details protected by staying in Service App chat.</Text></View><Pressable onPress={() => router.push(`/job/${job.id}`)} style={[styles.jobLink, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.flex}><Text style={[styles.jobLinkTitle, { color: colors.foreground }]}>View job & quote</Text><Text style={[styles.jobLinkBody, { color: colors.mutedForeground }]}>${job.agreedPrice ?? job.proposedPrice ?? job.priceOffer} · {job.status}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.primary} /></Pressable></View>} showsVerticalScrollIndicator={false} /><View style={[styles.composer, { paddingBottom: insets.bottom + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}>{disabled || blocked ? <Text style={[styles.disabledText, { color: colors.mutedForeground }]}>{disabled ? 'This conversation is closed because the job is complete.' : 'Messaging is unavailable for this conversation.'}</Text> : <><View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.card }]}><Field placeholder="Write a message..." value={message} onChangeText={setMessage} editable={!disabled} style={styles.input} /><Pressable onPress={onSend} disabled={!message.trim()} style={[styles.send, { backgroundColor: message.trim() ? colors.accent : colors.muted }]}><Ionicons name="arrow-up" size={18} color={colors.primaryForeground} /></Pressable></View>{currentUser.role === 'provider' && job.status === 'negotiating' ? <Pressable onPress={() => router.push(`/job/${job.id}`)} style={styles.quoteLink}><Ionicons name="pricetag-outline" size={14} color={colors.primary} /><Text style={[styles.quoteLinkText, { color: colors.primary }]}>Send a quote from job details</Text></Pressable> : null}</>}</View></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 11, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  titleWrap: { flex: 1, gap: 3 },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  topMeta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  messages: { padding: 18, gap: 9 },
  messageRow: { alignItems: 'flex-start' },
  mineRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', paddingHorizontal: 13, paddingTop: 10, paddingBottom: 8, borderRadius: 14, borderWidth: 1, gap: 5 },
  messageText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  messageTime: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  chatFooter: { gap: 10, transform: [{ scaleY: -1 }], marginBottom: 16 },
  infoCard: { borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  infoText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  jobLink: { borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center' },
  jobLinkTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  jobLinkBody: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  composer: { paddingHorizontal: 14, paddingTop: 9, borderTopWidth: 1, gap: 7 },
  inputShell: { borderWidth: 1, borderRadius: 12, paddingLeft: 3, paddingRight: 5, minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 0, flex: 1, minHeight: 46 },
  send: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quoteLink: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingBottom: 2 },
  quoteLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  disabledText: { textAlign: 'center', padding: 12, fontFamily: 'Inter_500Medium', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});