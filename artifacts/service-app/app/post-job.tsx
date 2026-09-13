import React, { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { CATEGORIES, CATEGORY_ICONS, isValidCoarseLocation, MAX_JOB_PHOTOS, MAX_SPECIAL_REQUIREMENTS_LENGTH, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';
import { AreaCoordinates } from '@/context/types';
import { captureCoarseAreaLocation } from '@/lib/coarseAreaLocation';

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
  const { addJob, setJobExactAddress, addBeforePhotos, requestEmergencyMatch, user } = useServiceApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(
    params.category && (CATEGORIES as readonly string[]).includes(params.category) ? params.category : null,
  );
  const [details, setDetails] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [location, setLocation] = useState('');
  const [areaCoordinates, setAreaCoordinates] = useState<AreaCoordinates | undefined>();
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationNeedsSettings, setLocationNeedsSettings] = useState(false);
  const [exactAddress, setExactAddress] = useState('');
  const [price, setPrice] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [schedule, setSchedule] = useState<Date | null>(null);
  const [flexible, setFlexible] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => atStartOfDay(new Date()));
  const [calendarSelection, setCalendarSelection] = useState(() => defaultScheduleDate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Set once the job document itself is successfully created. If the
  // follow-up private-address write then fails, the form stays open so the
  // employer can retry — but retrying must only re-attempt the address
  // write, never call addJob again and create a second job.
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  // Mirrors createdJobId: once the before photos upload succeeds, retrying
  // Submit (e.g. after an address-save failure) must not re-upload them.
  const [photosSaved, setPhotosSaved] = useState(false);

  const pickBeforePhotos = async () => {
    const room = MAX_JOB_PHOTOS - beforePhotos.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setBeforePhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_JOB_PHOTOS));
  };

  const removeBeforePhoto = (uri: string) => setBeforePhotos((prev) => prev.filter((u) => u !== uri));

  const setCurrentJobArea = async () => {
    setLocationBusy(true);
    setErrors((current) => ({ ...current, areaCoordinates: '' }));
    try {
      const result = await captureCoarseAreaLocation();
      if ('error' in result) {
        setErrors((current) => ({ ...current, areaCoordinates: result.error }));
        setLocationNeedsSettings(result.needsSettings);
      } else {
        setAreaCoordinates(result.coordinates);
        setLocationNeedsSettings(false);
      }
    } catch {
      setErrors((current) => ({ ...current, areaCoordinates: 'Your current area could not be read. Check location access and try again.' }));
    } finally {
      setLocationBusy(false);
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    const priceNum = Number(price);
    const trimmedLocation = location.trim();
    if (!createdJobId) {
      // The job itself is already saved — only the location/other fields
      // below still apply the first time through, before addJob succeeds.
      if (title.trim().length < 3) next.title = 'Give your job a short, clear title.';
      if (!category) next.category = 'Pick a category.';
      if (details.trim().length < 10) next.details = 'Describe the work in a bit more detail.';
      if (specialRequirements.trim().length > MAX_SPECIAL_REQUIREMENTS_LENGTH) {
        next.specialRequirements = `Keep special requirements under ${MAX_SPECIAL_REQUIREMENTS_LENGTH} characters.`;
      }
      if (trimmedLocation.length < 3) next.location = 'Add a ZIP code or a neighborhood/area name.';
      else if (trimmedLocation.length > 40) next.location = 'Keep the area name under 40 characters.';
      else if (!isValidCoarseLocation(trimmedLocation)) {
        next.location = 'Use a ZIP code (e.g. 78704) or a plain area name (e.g. North Austin) — no street address.';
      }
      if (!price || Number.isNaN(priceNum) || priceNum <= 0) next.price = 'Enter your price offer in dollars.';
      if (!flexible && !schedule) next.schedule = 'Choose a date and time, or let the provider suggest a time.';
      if (!flexible && schedule && schedule.getTime() <= Date.now()) next.schedule = 'Choose a time in the future.';
      if (emergency && !areaCoordinates) next.areaCoordinates = 'Emergency matching needs your rounded current area.';
    }
    if (exactAddress.trim().length > 200) next.exactAddress = 'Keep the exact address under 200 characters.';
    else if (exactAddress.trim() && exactAddress.trim().length < 3) next.exactAddress = 'Add a full address, or leave this blank.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    let jobId = createdJobId;
    if (!jobId) {
      const res = await addJob({
        title: title.trim(),
        category: category as string,
        details: details.trim(),
        specialRequirements: specialRequirements.trim(),
        priceOffer: Math.round(priceNum * 100) / 100,
        scheduledAt: flexible ? 'Flexible — provider suggests a time' : (schedule as Date).toISOString(),
        location: trimmedLocation,
        ...(areaCoordinates ? { areaCoordinates } : {}),
        leaveTimeToEmployee: flexible,
        emergency,
      });
      if (res.error || !res.jobId) {
        setBusy(false);
        setErrors({ form: res.error ?? 'Something went wrong. Please try again.' });
        return;
      }
      jobId = res.jobId;
      setCreatedJobId(jobId);
    }
    if (exactAddress.trim()) {
      const addressError = await setJobExactAddress(jobId, exactAddress.trim());
      if (addressError) {
        // The job is already posted (and won't be re-created on retry —
        // see createdJobId above). Surface this clearly and keep the value
        // in place so pressing Submit again only retries this write.
        setBusy(false);
        setErrors({
          exactAddress: `Job posted, but the exact address could not be saved (${addressError}). Press Submit to retry, or add it later from the job's details screen.`,
        });
        return;
      }
    }
    if (beforePhotos.length && !photosSaved) {
      const photosError = await addBeforePhotos(jobId, beforePhotos);
      if (photosError) {
        setBusy(false);
        setErrors({ form: `Job posted, but the photos could not be uploaded (${photosError}). Press Submit to retry.` });
        return;
      }
      setPhotosSaved(true);
    }
    if (emergency) {
      const matchError = await requestEmergencyMatch(jobId);
      if (matchError) {
        setBusy(false);
        setErrors({ form: matchError });
        return;
      }
    }
    setBusy(false);
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
        <Card style={{ gap: 10, marginBottom: 16 }}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>Emergency request</Text>
              <Text style={[styles.switchBody, { color: colors.mutedForeground }]}>
                Sends one nearby opted-in provider a timed request. It is not for medical, fire, police, or other public-safety emergencies.
              </Text>
            </View>
            <Switch
              testID="switch-emergency"
              value={emergency}
              onValueChange={(value) => {
                setEmergency(value);
                if (value) setFlexible(false);
              }}
              trackColor={{ true: colors.destructive, false: colors.muted }}
              thumbColor="#fff"
            />
          </View>
        </Card>
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
            label="Permits & access requirements (optional)"
            icon="shield-checkmark-outline"
            placeholder="e.g. Parking restrictions, building check-in, required certification, or permit details"
            value={specialRequirements}
            onChangeText={setSpecialRequirements}
            error={errors.specialRequirements}
            multiline
            testID="input-special-requirements"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Providers can see this before accepting. Do not include entry codes or other private credentials.
          </Text>
          <Field
            label="Location"
            icon="location-outline"
            placeholder="e.g. 'North Austin' or '78704'"
            value={location}
            onChangeText={(value) => {
              setLocation(value);
              setAreaCoordinates(undefined);
            }}
            error={errors.location}
            testID="input-location"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            A ZIP code or a plain neighborhood/area name only — no house number or street. This is shown to every provider
            browsing open jobs, so it can never be a full address.
          </Text>
          <Pressable
            testID="set-current-job-area"
            accessibilityRole="button"
            accessibilityLabel="Use current area for provider distance matching"
            disabled={locationBusy}
            onPress={locationNeedsSettings && Platform.OS !== 'web' ? () => Linking.openSettings() : setCurrentJobArea}
            style={[styles.areaButton, { borderColor: areaCoordinates ? colors.success : colors.border, backgroundColor: colors.card }]}
          >
            {locationBusy
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name={locationNeedsSettings ? 'settings-outline' : areaCoordinates ? 'checkmark-circle-outline' : 'locate-outline'} size={18} color={areaCoordinates ? colors.success : colors.primary} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                {locationNeedsSettings ? 'Open location settings' : areaCoordinates ? 'Distance matching enabled' : 'Use current area for distance matching'}
              </Text>
              <Text style={[styles.switchBody, { color: colors.mutedForeground }]}>Only a rounded area is stored publicly.</Text>
            </View>
          </Pressable>
          {errors.areaCoordinates ? <Text style={[styles.error, { color: colors.destructive }]}>{errors.areaCoordinates}</Text> : null}
          <Field
            label="Exact address (optional)"
            icon="pin-outline"
            placeholder="e.g. 1200 Elm St, Austin, TX"
            value={exactAddress}
            onChangeText={setExactAddress}
            error={errors.exactAddress}
            testID="input-exact-address"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Only shared with the provider you accept once the job is underway — never shown on the public listing.
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: colors.mutedForeground, marginBottom: 0 }]}>Before photos (optional)</Text>
            <View style={styles.photoRow}>
              {beforePhotos.map((uri) => (
                <View key={uri} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                  <Pressable
                    testID={`remove-before-photo-${uri}`}
                    onPress={() => removeBeforePhoto(uri)}
                    hitSlop={8}
                    style={[styles.photoRemove, { backgroundColor: colors.destructive }]}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {beforePhotos.length < MAX_JOB_PHOTOS ? (
                <Pressable
                  testID="pick-before-photos"
                  onPress={pickBeforePhotos}
                  style={[styles.addPhotoButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Ionicons name="camera-outline" size={20} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Show the provider what needs to be done. Only visible to you and the provider working this job — never shown
              on the public listing.
            </Text>
          </View>

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
                disabled={emergency}
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
          <PrimaryButton label={emergency ? 'Post & find one provider' : 'Post job'} icon="paper-plane-outline" onPress={submit} loading={busy} testID="submit-job" />
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
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 10 },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16, marginTop: -6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  switchBody: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  scheduleField: { gap: 6 },
  scheduleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  scheduleButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  scheduleValue: { fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1 },
  feeNote: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, alignItems: 'flex-start' },
  feeText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, lineHeight: 18, flex: 1 },
  areaButton: { minHeight: 54, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
