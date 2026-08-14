import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState, HeaderBar, Screen } from '@/components/AppPrimitives';
import { AppNotification, timeAgo, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

const KIND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  job_accepted: 'briefcase',
  quote: 'pricetag',
  quote_accepted: 'checkmark-circle',
  job_completed: 'ribbon',
  review: 'star',
  message: 'chatbubble-ellipses',
  payment: 'cash',
};

function NotificationRow({ item }: { item: AppNotification }) {
  const colors = useColors();
  const router = useRouter();
  const icon = KIND_ICONS[item.kind] ?? 'notifications';

  const open = () => {
    if (item.chatId) router.push({ pathname: '/chat/[id]', params: { id: item.chatId } });
    else if (item.jobId) router.push({ pathname: '/job/[id]', params: { id: item.jobId } });
  };

  return (
    <Pressable
      testID={`notification-${item.id}`}
      onPress={open}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: item.read ? colors.card : colors.primarySoft,
          borderColor: item.read ? colors.border : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: item.read ? colors.secondary : colors.card }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        {item.body ? (
          <Text numberOfLines={2} style={[styles.body, { color: colors.mutedForeground }]}>
            {item.body}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(item.createdAtMs)}</Text>
      </View>
      {!item.read ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { notifications, unreadNotificationCount, markNotificationsRead } = useServiceApp();

  return (
    <Screen>
      <HeaderBar
        title="Notifications"
        onBack={() => router.back()}
        right={
          unreadNotificationCount > 0 ? (
            <Pressable onPress={() => markNotificationsRead()} hitSlop={8} testID="mark-all-read">
              <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            body="Job updates, quotes, and messages will show up here."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  markAll: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 10, alignItems: 'flex-start' },
  icon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18 },
  time: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
});
