import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Avatar, Card, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { CATEGORIES, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';
import { AreaCoordinates } from '@/context/types';
import { captureCoarseAreaLocation } from '@/lib/coarseAreaLocation';

export default function ProfileEditScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateProfile, saveAvatar } = useServiceApp();

  const [name, setName] = useState(user?.name ?? '');
  const [workArea, setWorkArea] = useState(user?.workArea ?? '');
  const [areaCoordinates, setAreaCoordinates] = useState<AreaCoordinates | null>(user?.areaCoordinates ?? null);
  const [availability, setAvailability] = useState(user?.availability ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [priceRange, setPriceRange] = useState(user?.priceRange ?? '');
  const [companyInfo, setCompanyInfo] = useState(user?.companyInfo ?? '');
  const [categories, setCategories] = useState<string[]>(user?.categories ?? []);
  const [availableForWork, setAvailableForWork] = useState<boolean>(user?.availableForWork ?? true);
  const [emergencyOptIn, setEmergencyOptIn] = useState<boolean>(user?.emergencyOptIn ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationNeedsSettings, setLocationNeedsSettings] = useState(false);

  if (!user) return null;
  const isEmployer = user.role === 'employer';

  const pickAvatar = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setAvatarBusy(true);
    const err = await saveAvatar(result.assets[0].uri);
    setAvatarBusy(false);
    if (err) setError(err);
  };

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const setCurrentArea = async () => {
    setLocationBusy(true);
    setError('');
    try {
      const result = await captureCoarseAreaLocation();
      if ('error' in result) {
        setError(result.error);
        setLocationNeedsSettings(result.needsSettings);
      } else {
        setAreaCoordinates(result.coordinates);
        setLocationNeedsSettings(false);
      }
    } catch {
      setError('Your current area could not be read. Check location access and try again.');
    } finally {
      setLocationBusy(false);
    }
  };

  const save = async () => {
    if (name.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    setError('');
    const patch = isEmployer
      ? { name: name.trim(), workArea: workArea.trim(), availability: availability.trim(), bio: bio.trim(), companyInfo: companyInfo.trim() }
      : { name: name.trim(), workArea: workArea.trim(), areaCoordinates, availability: availability.trim(), bio: bio.trim(), priceRange: priceRange.trim(), categories, availableForWork, emergencyOptIn };
    const err = await updateProfile(patch);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <HeaderBar title="Edit profile" onBack={() => router.back()} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <Pressable onPress={pickAvatar} testID="pick-avatar">
            <Avatar name={user.name} uri={user.avatarUrl || undefined} size={88} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              {avatarBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>Tap to change photo</Text>
        </View>

        <View style={{ gap: 14 }}>
          <Field label="Name" icon="person-outline" value={name} onChangeText={setName} testID="edit-name" />
          <Field
            label="Work area"
            icon="location-outline"
            placeholder="e.g. Brooklyn, NY"
            value={workArea}
            onChangeText={(value) => {
              setWorkArea(value);
              setAreaCoordinates(null);
            }}
            testID="edit-area"
          />
          {!isEmployer ? (
            <Card style={styles.locationCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.availLabel, { color: colors.foreground }]}>
                  {areaCoordinates ? 'Distance matching is ready' : 'Enable distance matching'}
                </Text>
                <Text style={[styles.availHint, { color: colors.mutedForeground }]}>
                  We store only a rounded area, never your exact device location.
                </Text>
              </View>
              <Pressable
                testID="set-current-work-area"
                accessibilityRole="button"
                accessibilityLabel="Use current area for distance matching"
                disabled={locationBusy}
                onPress={locationNeedsSettings && Platform.OS !== 'web' ? () => Linking.openSettings() : setCurrentArea}
                style={[styles.locationButton, { borderColor: colors.border }]}
              >
                {locationBusy
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name={locationNeedsSettings ? 'settings-outline' : 'locate-outline'} size={18} color={colors.primary} />}
                <Text style={[styles.locationButtonText, { color: colors.primary }]}>
                  {locationNeedsSettings ? 'Settings' : areaCoordinates ? 'Update' : 'Use area'}
                </Text>
              </Pressable>
            </Card>
          ) : null}
          <Field
            label="Availability Schedule"
            icon="time-outline"
            placeholder="e.g. Weekdays 9am-5pm"
            value={availability}
            onChangeText={setAvailability}
            testID="edit-avail"
          />
          <Field
            label="About you"
            icon="document-text-outline"
            placeholder={isEmployer ? 'Tell providers a bit about yourself…' : 'Describe your experience and what you offer…'}
            value={bio}
            onChangeText={setBio}
            multiline
            testID="edit-bio"
          />

          {isEmployer ? (
            <Field
              label="Company info (optional)"
              icon="business-outline"
              placeholder="Company name, what you do…"
              value={companyInfo}
              onChangeText={setCompanyInfo}
              multiline
              testID="edit-company"
            />
          ) : (
            <>
              <Card style={{ gap: 10 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Your services</Text>
                <View style={styles.tagWrap}>
                  {CATEGORIES.map((c) => {
                    const active = categories.includes(c);
                    return (
                      <Pressable
                        key={c}
                        testID={`edit-cat-${c}`}
                        onPress={() => toggleCategory(c)}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: active ? colors.primary : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: active ? '#fff' : colors.mutedForeground }]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
              <Field
                label="Typical rate range"
                icon="cash-outline"
                placeholder="e.g. $40–60/hr"
                value={priceRange}
                onChangeText={setPriceRange}
                testID="edit-rate"
              />
              {/* Availability toggle */}
              <Pressable
                testID="toggle-available"
                onPress={() => setAvailableForWork((v) => !v)}
                style={[
                  styles.availRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: availableForWork ? colors.success : colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                  },
                ]}
              >
                <View style={styles.availLeft}>
                  <View style={[styles.availDot, { backgroundColor: availableForWork ? colors.success : colors.mutedForeground }]} />
                  <View>
                    <Text style={[styles.availLabel, { color: colors.foreground }]}>
                      {availableForWork ? 'Available for work' : 'Not available'}
                    </Text>
                    <Text style={[styles.availHint, { color: colors.mutedForeground }]}>
                      {availableForWork
                        ? "Employers can see you\u2019re open to new jobs"
                        : 'Employers will see you as currently busy'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.toggleTrack,
                    { backgroundColor: availableForWork ? colors.success : colors.secondary },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      { transform: [{ translateX: availableForWork ? 18 : 2 }] },
                    ]}
                  />
                </View>
              </Pressable>
              <Pressable
                testID="toggle-emergency-opt-in"
                accessibilityRole="switch"
                accessibilityState={{ checked: emergencyOptIn }}
                onPress={() => setEmergencyOptIn((value) => !value)}
                style={[styles.emergencyCard, { borderColor: emergencyOptIn ? colors.destructive : colors.border, backgroundColor: colors.card }]}
              >
                <Ionicons name="flash-outline" size={18} color={emergencyOptIn ? colors.destructive : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availLabel, { color: colors.foreground }]}>Receive nearby emergency requests</Text>
                  <Text style={[styles.availHint, { color: colors.mutedForeground }]}>One direct, expiring request at a time. Your rounded service area is used for distance.</Text>
                </View>
                <Switch value={emergencyOptIn} onValueChange={setEmergencyOptIn} />
              </Pressable>
            </>
          )}

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <PrimaryButton label="Save changes" icon="checkmark" onPress={save} loading={busy} testID="save-profile" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  avatarWrap: { alignItems: 'center', gap: 8, marginBottom: 20 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  availRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  availHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  emergencyCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationButton: { minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
});
