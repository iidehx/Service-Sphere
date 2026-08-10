import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Field, GhostButton, Pill, PrimaryButton, Screen, StatusBadge } from '@/components/AppPrimitives';
import { useServiceApp } from '@/context/ServiceAppContext';

export default function JobDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, jobs, chats, acceptJob, acceptQuote, proposeQuote, updatePayment, completeJob } = useServiceApp();
  const job = jobs.find((item) => item.id === id);
  const [showContract, setShowContract] = useState(false);
  const [quote, setQuote] = useState(String(job?.proposedPrice ?? job?.priceOffer ?? ''));
  const [labor, setLabor] = useState(String(job?.quoteBreakdown?.labor ?? job?.priceOffer ?? ''));
  const [materials, setMaterials] = useState(String(job?.quoteBreakdown?.materials ?? 0));
  const [hours, setHours] = useState(String(job?.quoteBreakdown?.expectedHours ?? 2));
  if (!job) return <Screen><View style={styles.missing}><Ionicons name="alert-circle-outline" size={30} color={colors.mutedForeground} /><Text style={[styles.missingTitle, { color: colors.foreground }]}>Job not found</Text><GhostButton label="Go back" onPress={() => router.back()} /></View></Screen>;
  const isEmployer = currentUser.id === job.employerId;
  const isProvider = currentUser.id === job.employeeId || currentUser.role === 'provider';
  const chat = chats.find((item) => item.jobId === job.id);
  const finalPrice = job.agreedPrice ?? job.proposedPrice ?? job.priceOffer;
  const openChat = () => router.push(`/chat/${chat?.id ?? `chat-${job.id}`}`);
  const submitQuote = () => {
    const proposedPrice = Number(quote) || job.priceOffer;
    proposeQuote(job.id, proposedPrice, { labor: Number(labor) || 0, materials: Number(materials) || 0, expectedHours: Number(hours) || 0, extraFees: Math.max(0, proposedPrice - (Number(labor) || 0) - (Number(materials) || 0)) });
    Alert.alert('Quote sent', 'The employer can now review and accept your quote.');
  };
  const report = () => Alert.alert('Report user', 'What would you like to report?', [{ text: 'Spam' }, { text: 'Safety concern', style: 'destructive' }, { text: 'Cancel', style: 'cancel' }]);
  return <Screen><View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={25} color={colors.primary} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Job details</Text><Pressable onPress={report} hitSlop={10}><Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} /></Pressable></View><ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}><View style={styles.headingLine}><View style={[styles.categoryIcon, { backgroundColor: colors.secondary }]}><Ionicons name={job.category === 'Cleaning' ? 'sparkles-outline' : job.category === 'Painting' ? 'color-palette-outline' : 'construct-outline'} size={24} color={colors.primary} /></View><View style={styles.headingCopy}><Text style={[styles.category, { color: colors.mutedForeground }]}>{job.category}</Text><Text style={[styles.title, { color: colors.foreground }]}>{job.title}</Text></View><StatusBadge status={job.status} /></View><View style={styles.metaRow}><View style={styles.metaItem}><Ionicons name="calendar-outline" size={17} color={colors.accent} /><Text style={[styles.metaText, { color: colors.foreground }]}>{job.scheduledAt}</Text></View><View style={styles.metaItem}><Ionicons name="location-outline" size={17} color={colors.accent} /><Text style={[styles.metaText, { color: colors.foreground }]}>{isEmployer ? 'Your request' : 'Austin, TX'}</Text></View></View><View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>About this job</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{job.details}</Text></View><View style={[styles.priceCard, { backgroundColor: colors.secondary }]}><View><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{job.agreedPrice ? 'Agreed price' : 'Employer budget'}</Text><Text style={[styles.price, { color: colors.primary }]}>${finalPrice}</Text></View>{job.platformFee ? <View style={styles.fee}><Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Platform fee</Text><Text style={[styles.feeText, { color: colors.foreground }]}>${job.platformFee.toFixed(2)} · 5%</Text></View> : null}</View>{job.status === 'negotiating' && job.proposedPrice ? <View style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.accent }]}><View style={styles.quoteHeader}><View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Quote ready to review</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>${job.proposedPrice} total · {job.quoteBreakdown?.expectedHours ?? 0} expected hours</Text></View><Ionicons name="document-text-outline" size={23} color={colors.accent} /></View><View style={styles.breakdown}><Text style={[styles.breakdownText, { color: colors.mutedForeground }]}>Labor <Text style={{ color: colors.foreground }}>${job.quoteBreakdown?.labor ?? 0}</Text></Text><Text style={[styles.breakdownText, { color: colors.mutedForeground }]}>Materials <Text style={{ color: colors.foreground }}>${job.quoteBreakdown?.materials ?? 0}</Text></Text><Text style={[styles.breakdownText, { color: colors.mutedForeground }]}>Extra fees <Text style={{ color: colors.foreground }}>${job.quoteBreakdown?.extraFees ?? 0}</Text></Text></View><View style={styles.acceptLine}><Text style={[styles.acceptState, { color: colors.mutedForeground }]}>{isEmployer ? job.employerQuoteAccepted ? 'You accepted this quote' : 'Your acceptance is needed' : job.employeeQuoteAccepted ? 'You accepted this quote' : 'Your acceptance is needed'}</Text><PrimaryButton label={isEmployer ? (job.employerQuoteAccepted ? 'Accepted' : 'Accept quote') : (job.employeeQuoteAccepted ? 'Accepted' : 'Accept quote')} onPress={() => acceptQuote(job.id)} disabled={isEmployer ? !!job.employerQuoteAccepted : !!job.employeeQuoteAccepted} icon="checkmark" /></View></View> : null}{currentUser.role === 'provider' && job.status === 'negotiating' ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Make a clear offer</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>A simple breakdown helps both sides feel confident before work begins.</Text><View style={styles.twoCol}><Field label="Total" keyboardType="decimal-pad" value={quote} onChangeText={setQuote} /><Field label="Labor" keyboardType="decimal-pad" value={labor} onChangeText={setLabor} /></View><View style={styles.twoCol}><Field label="Materials" keyboardType="decimal-pad" value={materials} onChangeText={setMaterials} /><Field label="Hours" keyboardType="decimal-pad" value={hours} onChangeText={setHours} /></View><PrimaryButton label="Send updated quote" onPress={submitQuote} icon="paper-plane-outline" /></View> : null}<View style={styles.actions}>{job.status === 'open' && currentUser.role === 'provider' ? <PrimaryButton label="Accept and start chat" onPress={() => { acceptJob(job.id); router.push(`/chat/chat-${job.id}`); }} icon="chatbubble-ellipses-outline" /> : null}{job.status === 'negotiating' || job.status === 'accepted' ? <GhostButton label="Open conversation" onPress={openChat} icon="chatbubble-ellipses-outline" /> : null}{job.status === 'accepted' && isEmployer ? <><GhostButton label={job.paymentStatus === 'paid' ? 'Payment marked paid' : 'Mark payment paid'} onPress={() => updatePayment(job.id, 'paid')} icon="checkmark-circle-outline" /><GhostButton label="View contract" onPress={() => setShowContract(true)} icon="document-text-outline" /><PrimaryButton label="Mark work complete" onPress={() => completeJob(job.id)} icon="flag-outline" /></> : null}{job.status === 'completed' ? <><View style={[styles.completeNote, { backgroundColor: '#E8F2EC' }]}><Ionicons name="checkmark-circle" size={18} color="#2E6A43" /><Text style={styles.completeText}>This job is complete. Thank you for using Service App.</Text></View><PrimaryButton label="Leave a review" onPress={() => router.push(`/review/${job.id}`)} icon="star-outline" /></> : null}</View></ScrollView><Modal visible={showContract} transparent animationType="slide" onRequestClose={() => setShowContract(false)}><View style={styles.modalBackdrop}><View style={[styles.contract, { backgroundColor: colors.card }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Service contract</Text><Pressable onPress={() => setShowContract(false)}><Ionicons name="close" size={23} color={colors.primary} /></Pressable></View><Text style={[styles.body, { color: colors.mutedForeground }]}>Both parties accepted the quote for this job. Keep this summary handy in chat.</Text><View style={[styles.contractLine, { borderBottomColor: colors.border }]}><Text style={[styles.body, { color: colors.mutedForeground }]}>Agreed price</Text><Text style={[styles.contractValue, { color: colors.primary }]}>${finalPrice}</Text></View><View style={[styles.contractLine, { borderBottomColor: colors.border }]}><Text style={[styles.body, { color: colors.mutedForeground }]}>Platform fee (5%)</Text><Text style={[styles.contractValue, { color: colors.foreground }]}>${job.platformFee?.toFixed(2) ?? '0.00'}</Text></View><View style={[styles.contractLine, { borderBottomColor: colors.border }]}><Text style={[styles.body, { color: colors.mutedForeground }]}>Payment</Text><Text style={[styles.contractValue, { color: colors.foreground }]}>{job.paymentStatus}</Text></View><PrimaryButton label="Done" onPress={() => setShowContract(false)} /></View></View></Modal></Screen>;
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 20, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  content: { padding: 20, gap: 16 },
  headingLine: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, gap: 4 },
  category: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 25 },
  metaRow: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 15, gap: 10 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  priceCard: { padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  priceLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 26, marginTop: 2 },
  fee: { flex: 1, alignItems: 'flex-end', gap: 3 },
  feeText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  quoteCard: { borderWidth: 1.5, borderRadius: 12, padding: 15, gap: 13 },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdown: { flexDirection: 'row', gap: 13, flexWrap: 'wrap' },
  breakdownText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  acceptLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  acceptState: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11 },
  twoCol: { flexDirection: 'row', gap: 10 },
  actions: { gap: 10 },
  completeNote: { borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  completeText: { flex: 1, color: '#2E6A43', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'flex-end' },
  contract: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  contractLine: { paddingVertical: 12, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contractValue: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  missingTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
});