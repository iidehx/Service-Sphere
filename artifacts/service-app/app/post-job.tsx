import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Field, Pill, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useServiceApp } from '@/context/ServiceAppContext';

const categories = ['Cleaning', 'Plumbing', 'Electrical', 'Painting', 'Landscaping', 'Moving', 'Pest Control', 'Handyman', 'Carpentry', 'Other'];

export default function PostJobScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addJob } = useServiceApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Cleaning');
  const [details, setDetails] = useState('');
  const [price, setPrice] = useState('');
  const [time, setTime] = useState('');
  const [leaveTime, setLeaveTime] = useState(false);
  const submit = () => { if (!title.trim() || !details.trim() || !price.trim()) { Alert.alert('Almost there', 'Add a title, a few details, and your budget to post this job.'); return; } addJob({ title: title.trim(), category, details: details.trim(), priceOffer: Number(price) || 0, scheduledAt: time.trim() || 'Flexible timing', leaveTimeToEmployee: leaveTime }); router.back(); };
  return <Screen><View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="close" size={25} color={colors.primary} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Post a new job</Text><View style={{ width: 25 }} /></View><KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}><Text style={[styles.intro, { color: colors.mutedForeground }]}>Give local pros enough context to send you a thoughtful quote.</Text><Field label="What do you need help with?" placeholder="e.g. Deep clean my apartment" value={title} onChangeText={setTitle} /><View style={styles.block}><Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text><View style={styles.pillWrap}>{categories.map((item) => <Pill key={item} label={item} active={item === category} onPress={() => setCategory(item)} />)}</View></View><Field label="Describe the job" placeholder="What should the provider know?" multiline numberOfLines={5} value={details} onChangeText={setDetails} style={styles.textarea} /><View style={styles.twoCol}><View style={{ flex: 1 }}><Field label="Budget ($)" placeholder="150" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View><View style={{ flex: 1 }}><Field label="When?" placeholder="Sat · 10:00 AM" value={time} onChangeText={setTime} /></View></View><Pressable onPress={() => setLeaveTime(!leaveTime)} style={styles.checkRow}><View style={[styles.checkbox, { borderColor: leaveTime ? colors.primary : colors.border, backgroundColor: leaveTime ? colors.primary : colors.card }]}>{leaveTime ? <Ionicons name="checkmark" size={15} color={colors.primaryForeground} /> : null}</View><View style={styles.checkCopy}><Text style={[styles.checkTitle, { color: colors.foreground }]}>I can leave access details for the provider</Text><Text style={[styles.checkBody, { color: colors.mutedForeground }]}>You can coordinate exact access in chat.</Text></View></Pressable><View style={[styles.note, { backgroundColor: colors.secondary }]}><Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} /><Text style={[styles.noteText, { color: colors.mutedForeground }]}>Your contact details stay private until you choose to share them.</Text></View><PrimaryButton label="Post job request" onPress={submit} icon="arrow-forward" /></KeyboardAwareScrollViewCompat></Screen>;
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  content: { padding: 20, gap: 18 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 2 },
  block: { gap: 9 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  textarea: { minHeight: 122, alignItems: 'flex-start' },
  twoCol: { flexDirection: 'row', gap: 11 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkCopy: { flex: 1, gap: 3 },
  checkTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  checkBody: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  note: { borderRadius: 10, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center' },
  noteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
});