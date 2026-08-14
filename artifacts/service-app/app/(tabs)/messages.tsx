import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar, EmptyState, Screen } from '@/components/AppPrimitives';
import { Chat, timeAgo, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

function ChatRow({ chat }: { chat: Chat }) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useServiceApp();
  if (!user) return null;

  const otherId = chat.participants.find((id) => id !== user.id) ?? '';
  const otherName = chat.participantNames[otherId] ?? 'User';
  const unread = chat.lastMessageAtMs > (chat.lastReadAt[user.id] ?? 0) && chat.lastSenderId !== user.id;

  return (
    <Pressable
      testID={`chat-row-${chat.id}`}
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: chat.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Avatar name={otherName} size={46} />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
            {otherName}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {chat.lastMessageAtMs ? timeAgo(chat.lastMessageAtMs) : ''}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.job, { color: colors.primary }]}>
          {chat.jobTitle}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.preview,
            { color: unread ? colors.foreground : colors.mutedForeground },
            unread ? styles.previewUnread : null,
          ]}
        >
          {chat.lastMessage || 'Say hello'}
        </Text>
      </View>
      {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, chats } = useServiceApp();
  if (!user) return null;

  return (
    <Screen>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ChatRow chat={item} />}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            body={
              user.role === 'provider'
                ? 'Accept a job to start chatting with the employer and agree on a quote.'
                : 'When a provider accepts one of your jobs, the conversation appears here.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },
  rowText: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 14.5, flex: 1 },
  time: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  job: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  preview: { fontFamily: 'Inter_400Regular', fontSize: 12.5 },
  previewUnread: { fontFamily: 'Inter_600SemiBold' },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
});
