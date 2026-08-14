import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, EmptyState, Field, HeaderBar, PrimaryButton, Screen } from '@/components/AppPrimitives';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { REPORT_REASONS, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

export default function ReportUserScreen() {
  const colors = useColors();
  const router = useRouter();
  const { userId, jobId } = useLocalSearchParams<{ userId?: string; jobId?: string }>();
  const { getUserProfile, reportUser, blockUser } = useServiceApp();

  const [name, setName] = useState('this user');
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (userId) getUserProfile(userId).then((p) => p && setName(p.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!userId) {
    return (
      <Screen>
        <HeaderBar title="Report" onBack={() => router.back()} />
        <EmptyState icon="flag-outline" title="No user selected" />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <HeaderBar title="Report sent" onBack={() => router.back()} />
        <View style={styles.doneWrap}>
          <View style={[styles.doneIcon, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="checkmark" size={30} color={colors.success} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>Thanks for letting us know</Text>
          <Text style={[styles.doneBody, { color: colors.mutedForeground }]}>
            Our team will review your report{alsoBlock ? ` — and ${name} can no longer contact you` : ''}.
          </Text>
          <PrimaryButton label="Done" onPress={() => router.back()} testID="report-done" style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    if (!reason) {
      setError('Choose a reason for the report.');
      return;
    }
    setBusy(true);
    setError('');
    const err = await reportUser({ userId, jobId: jobId || undefined, reason, message: message.trim() });
    if (!err && alsoBlock) await blockUser(userId);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  };

  return (
    <Screen>
      <HeaderBar title={`Report ${name}`} subtitle="Reports are private" onBack={() => router.back()} />
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: 4 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Reason</Text>
          {REPORT_REASONS.map((r) => {
            const active = reason === r;
            return (
              <Pressable
                key={r}
                testID={`reason-${r}`}
                onPress={() => setReason(r)}
                style={({ pressed }) => [styles.reasonRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.reasonText, { color: colors.foreground }]}>{r}</Text>
              </Pressable>
            );
          })}
        </Card>

        <View style={{ marginTop: 12 }}>
          <Field
            label="Tell us more (optional)"
            icon="document-text-outline"
            placeholder="What happened?"
            value={message}
            onChangeText={setMessage}
            multiline
            testID="report-message"
          />
        </View>

        <Card style={{ marginTop: 12 }}>
          <View style={styles.blockRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.blockTitle, { color: colors.foreground }]}>Also block {name}</Text>
              <Text style={[styles.blockBody, { color: colors.mutedForeground }]}>
                They won't be able to message you, and you won't see their jobs.
              </Text>
            </View>
            <Switch
              value={alsoBlock}
              onValueChange={setAlsoBlock}
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor="#fff"
              testID="switch-block"
            />
          </View>
        </Card>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label="Send report" icon="flag-outline" onPress={submit} loading={busy} testID="submit-report" />
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  reasonText: { fontFamily: 'Inter_500Medium', fontSize: 13.5, flex: 1 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  blockBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 12 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  doneBody: { fontFamily: 'Inter_400Regular', fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
});
