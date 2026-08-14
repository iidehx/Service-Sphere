import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

/**
 * Cross-platform confirmation dialog. React Native Web silently ignores
 * Alert.alert, so every destructive / contractual confirmation uses this
 * modal instead.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {body ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text> : null}
          <View style={styles.row}>
            <Pressable
              testID="confirm-cancel"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, { borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID="confirm-ok"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: destructive ? colors.destructive : colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  card: { width: '100%', maxWidth: 420, borderRadius: 14, borderWidth: 1, padding: 20, gap: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13.5, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 13.5 },
});
