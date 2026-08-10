import React, { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function AppLogo({ size = 46 }: { size?: number }) {
  const colors = useColors();
  return <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary }]}><Ionicons name="construct" size={size * 0.48} color={colors.accent} /></View>;
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.screen, { backgroundColor: colors.background }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{action ? <Pressable onPress={onAction} hitSlop={10}><Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text></Pressable> : null}</View>;
}

export function Pill({ label, active = false, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}><>{icon ? <Ionicons name={icon} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} /> : null}<Text style={[styles.pillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text></></Pressable>;
}

export function PrimaryButton({ label, onPress, icon, disabled = false, loading = false, style }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }, style]}>{loading ? <ActivityIndicator color={colors.primaryForeground} /> : <>{icon ? <Ionicons name={icon} size={18} color={colors.primaryForeground} /> : null}<Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text></>}</Pressable>;
}

export function GhostButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>{icon ? <Ionicons name={icon} size={17} color={colors.primary} /> : null}<Text style={[styles.ghostButtonText, { color: colors.primary }]}>{label}</Text></Pressable>;
}

export function Field({ label, icon, ...props }: TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return <View style={styles.fieldWrap}>{label ? <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text> : null}<View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>{icon ? <Ionicons name={icon} size={18} color={colors.mutedForeground} /> : null}<TextInput {...props} placeholderTextColor={colors.mutedForeground} style={[styles.fieldInput, { color: colors.foreground }]} /></View></View>;
}

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const label = status === 'open' ? 'Open' : status === 'negotiating' ? 'Negotiating' : status === 'accepted' ? 'Confirmed' : 'Completed';
  const tone = status === 'completed' ? colors.secondary : status === 'accepted' ? '#E8F2EC' : status === 'negotiating' ? '#FFF4E5' : '#EAF1F8';
  const text = status === 'completed' ? '#3E6B4E' : status === 'accepted' ? '#2E6A43' : status === 'negotiating' ? '#A65F00' : colors.primary;
  return <View style={[styles.statusBadge, { backgroundColor: tone }]}><Text style={[styles.statusText, { color: text }]}>{label}</Text></View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  logo: { alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderRadius: 18, marginRight: 8 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  primaryButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  ghostButton: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ghostButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  field: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 12 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
});