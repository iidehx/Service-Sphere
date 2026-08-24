import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { CATEGORIES, CATEGORY_ICONS, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

const TIME_OPTIONS = [
  { hour: 8, label: '8:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 14, label: '2:00 PM' },
  { hour: 16, label: '4:00 PM' },
  { hour: 18, label: '6:00 PM' },
];

const atStartOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const defaultScheduleDate = () => {
  const next = atStartOfDay(new Date());
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);
  return next;
};

const formatScheduleChoice = (value: Date) => {
  const day = value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
  const [schedule, setSchedule] = useState<Date | null>(null);
  const [flexible, setFlexible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => atStartOfDay(new Date()));
  const [calendarSelection, setCalendarSelection] = useState(() => defaultScheduleDate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    const priceNum = Number(price);
    if (title.trim().length < 3) next.title = 'Give your job a short, clear title.';
    if (!category) next.category = 'Pick a category.';
    if (details.trim().length < 10) next.details = 'Describe the work in a bit more detail.';
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) next.price = 'Enter your price offer in dollars.';
    if (!flexible && !schedule) next.schedule = 'Choose a date and time, or let the provider suggest a time.';
    if (!flexible && schedule && schedule.getTime() <= Date.now()) next.schedule = 'Choose a time in the future.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const err = await addJob({
      title: title.trim(),
      category: category as string,
      details: details.trim(),
      priceOffer: Math.round(priceNum * 100) / 100,
      scheduledAt: flexible ? 'Flexible — provider suggests a time' : (schedule as Date).toISOString(),
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

  const openCalendar = () => {
    const next = schedule ?? defaultScheduleDate();
    setCalendarSelection(next);
    setCalendarMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setCalendarOpen(true);
  };

  const changeMonth = (amount: number) =>
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = atStartOfDay(new Date());
  const hasAvailableTime = (day: Date) =>
    TIME_OPTIONS.some((option) => {
      const optionTime = new Date(day);
      optionTime.setHours(option.hour, 0, 0, 0);
      return optionTime.getTime() > Date.now();
    });
  const calendarCells = Array.from({ length: leadingDays + daysInMonth }, (_, index) => {
    if (index < leadingDays) return null;
    return new Date(year, month, index - leadingDays + 1);
  });

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
              <View style={styles.scheduleField}>
                <Text style={[styles.scheduleLabel, { color: colors.mutedForeground }]}>When do you need it?</Text>
                <Pressable
                  testID="input-schedule"
                  accessibilityRole="button"
                  onPress={openCalendar}
                  style={({ pressed }) => [
                    styles.scheduleButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: errors.schedule ? colors.destructive : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.scheduleValue, { color: schedule ? colors.foreground : colors.mutedForeground }]}>
                    {schedule ? formatScheduleChoice(schedule) : 'Choose a day and time'}
                  </Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
                </Pressable>
                {errors.schedule ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.schedule}</Text> : null}
              </View>
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

      <Modal transparent animationType="fade" visible={calendarOpen} onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.calendarModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.calendarHeader}>
              <Text style={[styles.calendarTitle, { color: colors.foreground }]}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={styles.monthActions}>
                <Pressable testID="calendar-previous-month" onPress={() => changeMonth(-1)} hitSlop={10} style={styles.monthButton}>
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </Pressable>
                <Pressable testID="calendar-next-month" onPress={() => changeMonth(1)} hitSlop={10} style={styles.monthButton}>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <Text key={day} style={[styles.weekday, { color: colors.mutedForeground }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.dayGrid}>
              {calendarCells.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const disabled = day < today || !hasAvailableTime(day);
                const active = sameDay(day, calendarSelection);
                return (
                  <Pressable
                    key={day.toISOString()}
                    testID={`calendar-day-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`}
                    disabled={disabled}
                    onPress={() => {
                      const next = new Date(day);
                      const preferredHour = calendarSelection.getHours();
                      const preferredTime = new Date(day);
                      preferredTime.setHours(preferredHour, 0, 0, 0);
                      const firstAvailable = TIME_OPTIONS.find((option) => {
                        const candidate = new Date(day);
                        candidate.setHours(option.hour, 0, 0, 0);
                        return candidate.getTime() > Date.now();
                      });
                      next.setHours(
                        preferredTime.getTime() > Date.now() ? preferredHour : (firstAvailable?.hour ?? preferredHour),
                        0,
                        0,
                        0,
                      );
                      setCalendarSelection(next);
                    }}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      active ? { backgroundColor: colors.primary } : undefined,
                      disabled ? { opacity: 0.3 } : undefined,
                    ]}
                  >
                    <Text style={[styles.dayText, { color: active ? colors.primaryForeground : colors.foreground }]}>{day.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Preferred time</Text>
            <View style={styles.timeOptions}>
              {TIME_OPTIONS.map((option) => {
                const active = calendarSelection.getHours() === option.hour;
                const optionTime = new Date(calendarSelection);
                optionTime.setHours(option.hour, 0, 0, 0);
                const unavailable = optionTime.getTime() <= Date.now();
                return (
                  <Pressable
                    key={option.hour}
                    testID={`calendar-time-${option.hour}`}
                    disabled={unavailable}
                    onPress={() => {
                      const next = new Date(calendarSelection);
                      next.setHours(option.hour, 0, 0, 0);
                      setCalendarSelection(next);
                    }}
                    style={[
                      styles.timeOption,
                      { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.background },
                      unavailable ? { opacity: 0.35 } : undefined,
                    ]}
                  >
                    <Text style={[styles.timeText, { color: active ? colors.primary : colors.mutedForeground }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarFooter}>
              <Pressable testID="calendar-cancel" onPress={() => setCalendarOpen(false)} style={styles.cancelButton}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="calendar-confirm"
                disabled={calendarSelection.getTime() <= Date.now()}
                onPress={() => {
                  setSchedule(calendarSelection);
                  setErrors((current) => ({ ...current, schedule: '' }));
                  setCalendarOpen(false);
                }}
                style={[styles.confirmButton, { backgroundColor: colors.primary, opacity: calendarSelection.getTime() <= Date.now() ? 0.45 : 1 }]}
              >
                <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>Use this time</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  scheduleField: { gap: 6 },
  scheduleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  scheduleButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  scheduleValue: { fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1 },
  feeNote: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, alignItems: 'flex-start' },
  feeText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 18, flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  notAllowed: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'center', padding: 20 },
  calendarModal: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14, width: '100%', maxWidth: 440, alignSelf: 'center' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  monthActions: { flexDirection: 'row', gap: 4 },
  monthButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 18 },
  dayText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  timeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 2 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeOption: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  timeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  calendarFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  confirmButton: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10 },
  confirmText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
