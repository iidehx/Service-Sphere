import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { CATEGORIES, CATEGORY_ICONS, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

export default function PostJobScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { addJob, user } = useServiceApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(
    params.category && (CATEGORIES as readonly string[]).includes(params.category) ? params.category : null,
  );
  const [details, setDetails] = useState('');
  const [price, setPrice] = useState('');
  const [schedule, setSchedule] = useState('');
  const [flexible, setFlexible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    const priceNum = Number(price);
    if (title.trim().length < 3) next.title = 'Give your job a short, clear title.';
    if (!category) next.category = 'Pick a category.';
    if (details.trim().length < 10) next.details = 'Describe the work in a bit more detail.';
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) next.price = 'Enter your price offer in dollars.';
    if (!flexible && schedule.trim().length < 3) next.schedule = 'Say when you need this done, or let the provider suggest a time.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const err = await addJob({
      title: title.trim(),
      category: category as string,
      details: details.trim(),
      priceOffer: Math.round(priceNum * 100) / 100,
      scheduledAt: flexible ? 'Flexible — provider suggests a time' : schedule.trim(),
      leaveTimeToEmployee: flexible,
    });
    setBusy(false);
    if (err) {
      setErrors({ form: err });
      return;
    }
    router.back();
  };

  if (user?.role !== 'employer') {
    return (
      <Screen>
        <HeaderBar title="Post a job" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={[styles.notAllowed, { color: colors.mutedForeground }]}>Only employer accounts can post jobs.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <HeaderBar title="Post a job" subtitle="Describe the work and set your offer" onBack={() => router.back()} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                testID={`category-${c}`}
                onPress={() => setCategory(c)}
                style={[
                  styles.gridItem,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons name={CATEGORY_ICONS[c]} size={17} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.gridText, { color: active ? colors.primary : colors.mutedForeground }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.category ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.category}</Text> : null}

        <View style={{ gap: 14, marginTop: 18 }}>
          <Field
            label="Job title"
            icon="create-outline"
            placeholder="e.g. Deep clean a 2-bedroom apartment"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            testID="input-title"
          />
          <Field
            label="Details"
            icon="document-text-outline"
            placeholder="What exactly needs to be done? Any materials, sizes, or constraints?"
            value={details}
            onChangeText={setDetails}
            error={errors.details}
            multiline
            testID="input-details"
          />
          <Field
            label="Price offer (USD)"
            icon="cash-outline"
            placeholder="e.g. 180"
            value={price}
            onChangeText={setPrice}
            error={errors.price}
            keyboardType="numeric"
            testID="input-price"
          />

          <Card style={{ gap: 12 }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.switchTitle, { color: colors.foreground }]}>Let the provider suggest a time</Text>
                <Text style={[styles.switchBody, { color: colors.mutedForeground }]}>
                  Turn this on if your schedule is flexible.
                </Text>
              </View>
              <Switch
                value={flexible}
                onValueChange={setFlexible}
                trackColor={{ true: colors.primary, false: colors.muted }}
                thumbColor="#fff"
                testID="switch-flexible"
              />
            </View>
            {!flexible ? (
              <Field
                label="When do you need it?"
                icon="calendar-outline"
                placeholder="e.g. Sat, Aug 15 · 10:00 AM"
                value={schedule}
                onChangeText={setSchedule}
                error={errors.schedule}
                testID="input-schedule"
              />
            ) : null}
          </Card>

          <View style={[styles.feeNote, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.feeText, { color: colors.primary }]}>
              You pay the price you agree in chat — nothing more. Providers pay a 5% platform fee.
            </Text>
          </View>

          {errors.form ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.form}</Text> : null}
          <PrimaryButton label="Post job" icon="paper-plane-outline" onPress={submit} loading={busy} testID="submit-job" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  gridText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12.5, marginTop: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  switchBody: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  feeNote: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, alignItems: 'flex-start' },
  feeText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 18, flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  notAllowed: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
