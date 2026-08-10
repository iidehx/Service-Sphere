import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Screen } from '@/components/AppPrimitives';

const topics = [
  ['Quotes & contracts', 'Providers can send a clear breakdown of labor, materials, hours, and extra fees. Both sides accept before a job becomes confirmed.'],
  ['Job statuses', 'Open means a request is available. Negotiating means you are chatting about the quote. Confirmed means both sides accepted. Completed closes the job.'],
  ['Ratings', 'After a completed job, both sides can leave a 1–5 star rating and an optional note. Reviews help the community choose confidently.'],
  ['Fees & payment', 'Service App adds a simple 5% platform fee to the agreed price. Payment is marked manually for now; keep all conversations in the app.'],
  ['Safety & reporting', 'Never share passwords or sensitive financial details in chat. Use the menu in a job or conversation to report spam, abuse, or payment concerns.'],
  ['Notifications', 'Turn on quote notifications to hear about offers and updates quickly. You can manage notification preferences from your profile.'],
];

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return <Screen><View style={[styles.top, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={25} color={colors.primary} /></Pressable><Text style={[styles.topTitle, { color: colors.foreground }]}>Help & safety</Text><View style={{ width: 25 }} /></View><ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}><View style={[styles.intro, { backgroundColor: colors.primary }]}><Ionicons name="shield-checkmark-outline" size={30} color={colors.accent} /><Text style={styles.introTitle}>A better way to work together</Text><Text style={styles.introBody}>Clear expectations, respectful communication, and a little care go a long way.</Text></View>{topics.map(([title, body], index) => <View key={title} style={[styles.topic, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.topicIndex, { backgroundColor: colors.secondary }]}><Text style={[styles.topicNumber, { color: colors.primary }]}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.topicCopy}><Text style={[styles.topicTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.topicBody, { color: colors.mutedForeground }]}>{body}</Text></View></View>)}</ScrollView></Screen>;
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 13, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  content: { padding: 20, gap: 11 },
  intro: { borderRadius: 15, padding: 19, gap: 8, marginBottom: 3 },
  introTitle: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 20 },
  introBody: { color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  topic: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 11 },
  topicIndex: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topicNumber: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  topicCopy: { flex: 1, gap: 5 },
  topicTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  topicBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
});