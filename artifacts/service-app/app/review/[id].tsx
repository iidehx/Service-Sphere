import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Field, Pill, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { useServiceApp } from '@/context/ServiceAppContext';

export default function ReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, jobs, leaveReview } = useServiceApp();
  const job = jobs.find((item) => item.id === id);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [tag, setTag] = useState('Great communication');
  if (!job) return null;
  const other = currentUser.role === 'employer' ? job.employeeName ?? 'your service provider' : job.employerName;
  const submit = () => { leaveReview(job.id, rating, comment); router.back(); };
  return <Screen><View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()}><Ionicons name="close" size={24} color={colors.primary} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Leave a review</Text><View style={{ width: 24 }} /></View><View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}><View style={[styles.hero, { backgroundColor: colors.secondary }]}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><Ionicons name={currentUser.role === 'employer' ? 'hammer-outline' : 'person-outline'} size={25} color="#FFFFFF" /></View><Text style={[styles.kicker, { color: colors.mutedForeground }]}>HOW DID IT GO?</Text><Text style={[styles.title, { color: colors.foreground }]}>Rate {other}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>Your feedback helps make Service App safer and better for everyone.</Text></View><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => setRating(value)} hitSlop={4}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={34} color={value <= rating ? colors.accent : colors.border} /></Pressable>)}</View><Text style={[styles.ratingText, { color: colors.foreground }]}>{rating === 5 ? 'Excellent' : rating === 4 ? 'Really good' : rating === 3 ? 'It was okay' : 'Could be better'}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>What stood out?</Text><View style={styles.tags}>{['Great communication', 'Quality work', 'On time', 'Fair price'].map((item) => <Pill label={item} active={tag === item} onPress={() => setTag(item)} key={item} />)}</View><Field label="Add a note (optional)" placeholder="Share a little more..." multiline numberOfLines={5} value={comment} onChangeText={setComment} style={styles.textarea} /><PrimaryButton label="Publish review" onPress={submit} icon="checkmark" /></View></Screen>;
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  content: { flex: 1, padding: 20, gap: 17 },
  hero: { borderRadius: 15, padding: 20, alignItems: 'center', gap: 8 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  kicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'center' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 4 },
  ratingText: { fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center', marginTop: -8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginTop: -8 },
  textarea: { minHeight: 108, alignItems: 'flex-start' },
});