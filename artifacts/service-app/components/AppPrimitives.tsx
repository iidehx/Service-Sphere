import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { initialsOf, JobStatus, PaymentStatus } from '@/context/types';

export function AppLogo({ size = 46 }: { size?: number }) {
  const colors = useColors();
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary }]}>
      <Ionicons name="construct" size={size * 0.48} color={colors.accent} />
    </View>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.screen, { backgroundColor: colors.background }, style]}>{children}</View>;
}

export function HeaderBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerBar, { paddingTop: insets.top + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.headerBack} testID="header-back">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.headerBack} />
      )}
      <View style={styles.headerCenter}>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <>
        {icon ? <Ionicons name={icon} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} /> : null}
        <Text style={[styles.pillText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
      </>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.primary, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={colors.primaryForeground} /> : null}
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  tone = 'primary',
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'destructive';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const colors = useColors();
  const tint = tone === 'destructive' ? colors.destructive : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.ghostButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={17} color={tint} /> : null}
      <Text style={[styles.ghostButtonText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  icon,
  error,
  multiline,
  testID,
  ...props
}: TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap; error?: string }) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border },
          multiline ? styles.fieldMultiline : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.mutedForeground} style={multiline ? styles.fieldIconTop : undefined} /> : null}
        <TextInput
          {...props}
          multiline={multiline}
          testID={testID}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.fieldInput, { color: colors.foreground }, multiline ? styles.fieldInputMultiline : null]}
        />
      </View>
      {error ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

export function StatusBadge({ status }: { status: JobStatus | string }) {
  const colors = useColors();
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    open: { label: 'Open', bg: colors.primarySoft, fg: colors.primary },
    negotiating: { label: 'Negotiating', bg: colors.warningSoft, fg: colors.warning },
    accepted: { label: 'Confirmed', bg: colors.successSoft, fg: colors.success },
    completed: { label: 'Completed', bg: colors.secondary, fg: colors.mutedForeground },
  };
  const item = map[status] ?? map.open;
  return (
    <View style={[styles.statusBadge, { backgroundColor: item.bg }]}>
      <Text style={[styles.statusText, { color: item.fg }]}>{item.label}</Text>
    </View>
  );
}

export function PayBadge({ status }: { status: PaymentStatus }) {
  const colors = useColors();
  const map: Record<PaymentStatus, { label: string; bg: string; fg: string }> = {
    pending: { label: 'Payment pending', bg: colors.warningSoft, fg: colors.warning },
    paid: { label: 'Paid', bg: colors.successSoft, fg: colors.success },
    refunded: { label: 'Refunded', bg: colors.destructiveSoft, fg: colors.destructive },
  };
  const item = map[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: item.bg }]}>
      <Text style={[styles.statusText, { color: item.fg }]}>{item.label}</Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string; size?: number }) {
  const colors = useColors();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={120} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: Math.max(11, size * 0.34), color: colors.primary }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function Stars({
  value,
  size = 15,
  onChange,
  muted = false,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
  muted?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 10 : 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        const name = filled ? 'star' : half ? 'star-half' : 'star-outline';
        const color = filled || half ? (muted ? colors.mutedForeground : colors.accent) : colors.input;
        const star = <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={8} testID={`star-${i}`}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text> : null}
    </View>
  );
}

export function KeyValueRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          strong ? styles.kvValueStrong : styles.kvValue,
          { color: strong ? colors.foreground : colors.cardForeground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function DotBadge({ count }: { count: number }) {
  const colors = useColors();
  if (count <= 0) return null;
  return (
    <View style={[styles.dotBadge, { backgroundColor: colors.accent }]}>
      <Text style={styles.dotBadgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  logo: { alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBack: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  headerRight: { minWidth: 40, alignItems: 'flex-end', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 18,
    marginRight: 8,
  },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  ghostButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  ghostButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  field: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldMultiline: { minHeight: 110, alignItems: 'flex-start', paddingVertical: 12 },
  fieldIconTop: { marginTop: 2 },
  fieldInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, paddingVertical: 12 },
  fieldInputMultiline: { paddingVertical: 0, textAlignVertical: 'top', minHeight: 84 },
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  emptyState: { alignItems: 'center', paddingVertical: 42, paddingHorizontal: 24, gap: 8 },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, textAlign: 'center' },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  kvLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  kvValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  kvValueStrong: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  dotBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dotBadgeText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10 },
});
