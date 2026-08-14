import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, HeaderBar, Screen } from '@/components/AppPrimitives';
import { useColors } from '@/hooks/useColors';

const FAQS: { icon: keyof typeof Ionicons.glyphMap; q: string; a: string }[] = [
  {
    icon: 'people-outline',
    q: 'How does the app work?',
    a: 'Employers post jobs with a price offer. Service providers browse open jobs and accept the ones they want. Both sides then chat, agree on a final quote, and the job is confirmed. When the work is done, the employer marks it completed and both sides review each other.',
  },
  {
    icon: 'clipboard-outline',
    q: 'Posting a job (employers)',
    a: 'Tap "Post a job", pick a category, describe the work, and set your price offer and preferred time. Your job appears to providers right away. When a provider accepts, a conversation opens automatically.',
  },
  {
    icon: 'hammer-outline',
    q: 'Accepting jobs (providers)',
    a: "Browse open jobs on the Jobs tab and tap one to see details. Accepting a job is free and simply opens a chat with the employer — you're not committed until you both accept a quote.",
  },
  {
    icon: 'pricetag-outline',
    q: 'Quotes and agreement',
    a: 'Inside the chat, either side can send a quote with a breakdown: labor, materials, expected hours, and extra fees. A job is confirmed only when BOTH sides accept the same quote. Until then, you can send new quotes or decline.',
  },
  {
    icon: 'cash-outline',
    q: 'Payments and fees',
    a: 'Payment happens directly between you — cash or bank transfer — after the work is done. The app charges providers a 5% platform fee on the agreed price. Employers pay exactly the agreed price, nothing more. The employer marks the payment as paid in the job screen so both sides have a record.',
  },
  {
    icon: 'star-outline',
    q: 'Reviews',
    a: 'After a job is completed, both sides can rate each other from 1 to 5 stars, add detail ratings for communication, quality, and punctuality, and leave a short comment. Reviews appear on profiles and help everyone choose who to work with.',
  },
  {
    icon: 'shield-checkmark-outline',
    q: 'Staying safe',
    a: "Keep conversations in the app so there's a record. Agree on the price with a quote before work starts. If someone behaves badly, use Report on their profile or in the chat — and Block to stop them from contacting you. Blocked users' jobs are hidden from you.",
  },
  {
    icon: 'notifications-outline',
    q: 'Notifications',
    a: 'You get in-app notifications when a provider accepts your job, when a quote arrives or is accepted, when a job is completed, and when you receive a review. You can turn quote notifications off in your profile.',
  },
];

function FaqItem({ icon, q, a }: { icon: keyof typeof Ionicons.glyphMap; q: string; a: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ marginBottom: 10, gap: 0 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.faqHeader} testID={`faq-${q.slice(0, 12)}`}>
        <View style={[styles.faqIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={15} color={colors.primary} />
        </View>
        <Text style={[styles.faqQ, { color: colors.foreground }]}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open ? <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{a}</Text> : null}
    </Card>
  );
}

export default function HelpScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <Screen>
      <HeaderBar title="Help & safety" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Ionicons name="help-buoy-outline" size={26} color="rgba(255,255,255,0.85)" />
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroBody}>Answers to the most common questions about jobs, quotes, payments, and safety.</Text>
        </View>
        {FAQS.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <Text style={[styles.contactTitle, { color: colors.foreground }]}>Still stuck?</Text>
          <Text style={[styles.contactBody, { color: colors.mutedForeground }]}>
            Report a problem from any profile or conversation and our team will take a look.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: 14, padding: 20, gap: 6, marginBottom: 16 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#fff' },
  heroBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  faqIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  faqQ: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, flex: 1 },
  faqA: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 10 },
  contactTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  contactBody: { fontFamily: 'Inter_400Regular', fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
});
