import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, EmptyState, Field, HeaderBar, PrimaryButton, Screen, Stars } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { REVIEW_TAGS, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function SubRating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.subRow}>
      <Text style={[styles.subLabel, { color: colors.foreground }]}>{label}</Text>
      <Stars value={value} size={20} onChange={onChange} />
    </View>
  );
}

export default function ReviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, jobs, submitReview } = useServiceApp();

  const job = jobs.find((j) => j.id === id);
  const [rating, setRating] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [quality, setQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  if (!job || job.status !== 'completed' || (job.employerId !== user.id && job.employeeId !== user.id)) {
    return (
      <Screen>
        <HeaderBar title="Leave a review" onBack={() => router.back()} />
        <EmptyState icon="star-outline" title="Nothing to review" body="Reviews open once a job is completed." />
      </Screen>
    );
  }
  if (job.reviewedBy.includes(user.id)) {
    return (
      <Screen>
        <HeaderBar title="Leave a review" onBack={() => router.back()} />
        <EmptyState icon="checkmark-circle-outline" title="Already reviewed" body="You've already reviewed this job. Thanks!" />
      </Screen>
    );
  }

  const isEmployerOnJob = job.employerId === user.id;
  const targetName = isEmployerOnJob ? job.employeeName ?? 'the provider' : job.employerName;

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 5 ? [...prev, t] : prev));

  const submit = async () => {
    if (rating < 1) {
      setError('Tap the stars to give an overall rating.');
      return;
    }
    setBusy(true);
    setError('');
    const err = await submitReview(job.id, {
      rating,
      communication: communication || undefined,
      quality: quality || undefined,
      punctuality: punctuality || undefined,
      tags,
      comment: comment.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <HeaderBar title={`Rate ${targetName}`} subtitle={job.title} onBack={() => router.back()} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Text style={[styles.bigLabel, { color: colors.foreground }]}>How was your experience?</Text>
          <Stars value={rating} size={36} onChange={setRating} />
          <Text style={[styles.ratingWord, { color: rating ? colors.accent : colors.mutedForeground }]}>
            {rating ? RATING_WORDS[rating] : 'Tap a star'}
          </Text>
        </Card>

        <Card style={{ gap: 4, marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Details (optional)</Text>
          <SubRating label="Communication" value={communication} onChange={setCommunication} />
          <SubRating label="Quality of work" value={quality} onChange={setQuality} />
          <SubRating label="Punctuality" value={punctuality} onChange={setPunctuality} />
        </Card>

        <Card style={{ gap: 10, marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>What stood out?</Text>
          <View style={styles.tagWrap}>
            {REVIEW_TAGS.map((t) => {
              const active = tags.includes(t);
              return (
                <Pressable
                  key={t}
                  testID={`tag-${t}`}
                  onPress={() => toggleTag(t)}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: active ? '#fff' : colors.mutedForeground }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Field
            label="Comment (optional)"
            icon="chatbox-ellipses-outline"
            placeholder={`Share a few words about working with ${targetName}…`}
            value={comment}
            onChangeText={setComment}
            multiline
            testID="review-comment"
          />
        </View>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label="Submit review" icon="star" onPress={submit} loading={busy} testID="submit-review" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  bigLabel: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  ratingWord: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  subLabel: { fontFamily: 'Inter_500Medium', fontSize: 13.5 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 12 },
});
