import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useServiceApp, CATEGORIES } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';
import { GhostButton, PrimaryButton, Field, Card, HeaderBar, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function OnboardingScreen() {
  const { user, updateProfile, signOutUser } = useServiceApp();
  const colors = useColors();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? '');
  const [workArea, setWorkArea] = useState(user?.workArea ?? '');
  const [availability, setAvailability] = useState(user?.availability ?? '');
  
  const [categories, setCategories] = useState<string[]>(user?.categories ?? []);
  const [priceRange, setPriceRange] = useState(user?.priceRange ?? '');
  const [availableForWork, setAvailableForWork] = useState<boolean>(user?.availableForWork ?? true);

  const [bio, setBio] = useState(user?.bio ?? '');
  const [companyInfo, setCompanyInfo] = useState(user?.companyInfo ?? '');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const isProv = user.role === 'provider';
  const requiredChecks = isProv
    ? [
        name.trim().length >= 2,
        workArea.trim().length >= 2,
        availability.trim().length >= 2,
        categories.length > 0,
        priceRange.trim().length >= 2,
      ]
    : [
        name.trim().length >= 2,
        workArea.trim().length >= 2,
        availability.trim().length >= 2,
        bio.trim().length >= 2 || companyInfo.trim().length >= 2,
      ];
  const completedRequired = requiredChecks.filter(Boolean).length;
  const progressPercent = `${Math.round((completedRequired / requiredChecks.length) * 100)}%` as `${number}%`;

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleComplete = async () => {
    setError('');
    
    if (name.trim().length < 2) return setError('Please enter your full name.');
    if (workArea.trim().length < 2) return setError('Please enter your primary work area.');
    if (availability.trim().length < 2) return setError('Please provide your working-time availability.');

    if (isProv) {
      if (categories.length === 0) return setError('Please select at least one service category.');
      if (priceRange.trim().length < 2) return setError('Please provide a typical rate range.');
    } else {
      if (bio.trim().length < 2 && companyInfo.trim().length < 2) {
        return setError('Please provide a short bio or company description.');
      }
    }

    setBusy(true);
    const patch = isProv 
      ? { name: name.trim(), workArea: workArea.trim(), availability: availability.trim(), categories, priceRange: priceRange.trim(), availableForWork, bio: bio.trim() }
      : { name: name.trim(), workArea: workArea.trim(), availability: availability.trim(), bio: bio.trim(), companyInfo: companyInfo.trim() };
      
    const err = await updateProfile(patch);
    setBusy(false);

    if (err) {
      setError(err);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/login');
  };

  return (
    <Screen>
      <HeaderBar title="Welcome to the Marketplace" right={<GhostButton label="Sign out" onPress={handleSignOut} />} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <Text style={[styles.title, { color: colors.foreground }]}>Let's get your profile ready</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isProv 
              ? "Providers need a complete profile before connecting with clients. Tell us what you do and when you're available."
              : "Employers need a complete profile so providers know who they're working with."}
          </Text>
          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
              <View
                testID="ob-progress"
                style={[styles.progressFill, { backgroundColor: colors.primary, width: progressPercent }]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {completedRequired} of {requiredChecks.length} required details complete
            </Text>
          </View>
        </View>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Basic Details</Text>
          <Field label="Full Name" icon="person-outline" value={name} onChangeText={setName} placeholder="Your name" testID="ob-name" />
          <Field label={isProv ? "Service Area" : "Location"} icon="location-outline" value={workArea} onChangeText={setWorkArea} placeholder="e.g. Austin, TX" testID="ob-area" />
          <Field label="Availability Schedule" icon="time-outline" value={availability} onChangeText={setAvailability} placeholder="e.g. Weekdays 9am-5pm" testID="ob-avail" />
        </Card>

        {isProv ? (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Professional Info</Text>
            
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Service Categories</Text>
              <View style={styles.tagWrap}>
                {CATEGORIES.map((c) => {
                  const active = categories.includes(c);
                  return (
                    <Pressable
                      key={c}
                      testID={`ob-cat-${c}`}
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
            </View>

            <Field label="Typical Rate Range" icon="cash-outline" value={priceRange} onChangeText={setPriceRange} placeholder="e.g. $40-$80 / hour" testID="ob-rate" />
            <Field label="Short Bio" icon="document-text-outline" value={bio} onChangeText={setBio} multiline placeholder="Tell clients about your experience..." testID="ob-bio" />

            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Current Status</Text>
              <Pressable
                testID="ob-toggle-available"
                onPress={() => setAvailableForWork((v) => !v)}
                style={[
                  styles.availRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: availableForWork ? colors.success : colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={styles.availLeft}>
                  <View style={[styles.availDot, { backgroundColor: availableForWork ? colors.success : colors.mutedForeground }]} />
                  <View>
                    <Text style={[styles.availLabel, { color: colors.foreground }]}>
                      {availableForWork ? 'Available for work' : 'Not available right now'}
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
            </View>
          </Card>
        ) : (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About You</Text>
            <Field label="Short Bio" icon="document-text-outline" value={bio} onChangeText={setBio} multiline placeholder="Tell providers a bit about yourself..." testID="ob-bio" />
            <Field label="Company or contact context" icon="business-outline" value={companyInfo} onChangeText={setCompanyInfo} multiline placeholder="Company name, team, or the best context for providers..." testID="ob-company" />
          </Card>
        )}

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        
        <PrimaryButton label="Complete Setup" icon="arrow-forward" onPress={handleComplete} loading={busy} testID="ob-submit" style={styles.submit} />
        <GhostButton
          label="Account settings"
          icon="settings-outline"
          onPress={() => router.push('/(tabs)/profile')}
          testID="ob-account-settings"
        />
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center', gap: 24 },
  headerWrap: { gap: 8, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  progressBlock: { gap: 7, marginTop: 8 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  section: { gap: 16, padding: 20 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 4 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  availRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12 },
  availLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  submit: { marginTop: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
});
