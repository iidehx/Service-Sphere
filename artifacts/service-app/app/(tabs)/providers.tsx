import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar, Card, EmptyState, Screen, Stars } from '@/components/AppPrimitives';
import { CATEGORIES, CATEGORY_ICONS, PublicProfile, useServiceApp } from '@/context/ServiceAppContext';
import { useColors } from '@/hooks/useColors';

// ---------------------------------------------------------------------------
// Provider card
// Structurally: the body is a Pressable for profile navigation; the footer
// Message button is a separate sibling Pressable — never nested — so there
// is no touch-event propagation ambiguity.
// ---------------------------------------------------------------------------
function ProviderCard({
  profile,
  onMessage,
  onPress,
  isSaved,
  onToggleSaved,
}: {
  profile: PublicProfile;
  onMessage: () => void;
  onPress: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const handleMessage = async () => {
    setBusy(true);
    await onMessage();
    setBusy(false);
  };

  return (
    <Card style={styles.card}>
      {/* Tappable body — navigates to provider profile */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.87 : 1 })}
        testID={`provider-card-${profile.id}`}
      >
        {/* Top row: avatar + info + bookmark */}
        <View style={styles.cardTop}>
          <Avatar name={profile.name} uri={profile.avatarUrl || undefined} size={52} />
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                {profile.name}
              </Text>
              {profile.verified ? (
                <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              ) : null}
            </View>
            {profile.ratingCount > 0 ? (
              <View style={styles.ratingRow}>
                <Stars value={profile.ratingAvg} size={12} />
                <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
                  {profile.ratingAvg.toFixed(1)} · {profile.ratingCount}
                </Text>
              </View>
            ) : (
              <Text style={[styles.noRating, { color: colors.mutedForeground }]}>No reviews yet</Text>
            )}
            {profile.workArea ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {profile.workArea}
                </Text>
              </View>
            ) : null}
            {/* Availability badge */}
            <View style={[
              styles.availBadge,
              { backgroundColor: profile.availableForWork ? colors.successSoft : colors.secondary },
            ]}>
              <View style={[styles.availDot, { backgroundColor: profile.availableForWork ? colors.success : colors.mutedForeground }]} />
              <Text style={[styles.availText, { color: profile.availableForWork ? colors.success : colors.mutedForeground }]}>
                {profile.availableForWork ? 'Available' : 'Busy'}
              </Text>
            </View>
          </View>
          {/* Bookmark button — sibling to info, NOT nested inside the outer Pressable body */}
        </View>

        {/* Categories */}
        {profile.categories.length > 0 ? (
          <View style={[styles.catRow, { marginTop: 8 }]}>
            {profile.categories.slice(0, 4).map((c) => (
              <View key={c} style={[styles.catChip, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={CATEGORY_ICONS[c] ?? 'construct'} size={11} color={colors.primary} />
                <Text style={[styles.catText, { color: colors.primary }]}>{c}</Text>
              </View>
            ))}
            {profile.categories.length > 4 ? (
              <View style={[styles.catChip, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.catText, { color: colors.mutedForeground }]}>
                  +{profile.categories.length - 4}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Bio snippet */}
        {profile.bio ? (
          <Text style={[styles.bio, { color: colors.mutedForeground, marginTop: 8 }]} numberOfLines={2}>
            {profile.bio}
          </Text>
        ) : null}
      </Pressable>

      {/* Footer: price range + bookmark + Message CTA — sibling of the body Pressable, NOT nested inside it */}
      <View style={styles.cardFooter}>
        {profile.priceRange ? (
          <Text style={[styles.priceRange, { color: colors.foreground }]}>{profile.priceRange}</Text>
        ) : (
          <View />
        )}
        <View style={styles.footerActions}>
          <Pressable
            onPress={onToggleSaved}
            hitSlop={8}
            testID={`bookmark-${profile.id}`}
            style={({ pressed }) => [styles.bookmarkBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            onPress={handleMessage}
            disabled={busy}
            testID={`message-${profile.id}`}
            style={({ pressed }) => [
              styles.msgBtn,
              { backgroundColor: colors.primary, opacity: pressed || busy ? 0.75 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#fff" />
                <Text style={styles.msgBtnText}>Message</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Providers screen
// ---------------------------------------------------------------------------
type ViewMode = 'all' | 'saved';

export default function ProvidersScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, searchProviders, startDirectChat, toggleSavedProvider, getUserProfile } = useServiceApp();

  const [nameQuery, setNameQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [workAreaQuery, setWorkAreaQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // Saved-tab independent state
  const [savedProfiles, setSavedProfiles] = useState<PublicProfile[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const savedFetchedRef = useRef<string>(''); // tracks which set of IDs was last fetched

  // Debounce refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (name: string, category: string | null, workArea: string) => {
      setLoading(true);
      const list = await searchProviders({
        name: name.trim() || undefined,
        category: category ?? undefined,
        workArea: workArea.trim() || undefined,
      });
      setResults(list);
      setLoading(false);
      setSearched(true);
    },
    [searchProviders],
  );

  // Initial load: fetch all providers
  useEffect(() => {
    doSearch('', null, '');
  }, [doSearch]);

  // Re-run search when filters change (debounced for text)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(nameQuery, selectedCategory, workAreaQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameQuery, selectedCategory, workAreaQuery, doSearch]);

  // Independently fetch all saved provider profiles whenever the saved tab is
  // active or the saved ID list changes. This is intentionally decoupled from
  // the directory search so filters never hide saved providers.
  const savedProviderIds = user?.savedProviderIds ?? [];
  const savedIdsKey = savedProviderIds.slice().sort().join(',');
  useEffect(() => {
    if (viewMode !== 'saved') return;
    if (savedIdsKey === savedFetchedRef.current) return; // already up to date
    if (savedProviderIds.length === 0) {
      setSavedProfiles([]);
      savedFetchedRef.current = savedIdsKey;
      return;
    }
    setSavedLoading(true);
    Promise.all(savedProviderIds.map((id) => getUserProfile(id))).then((profiles) => {
      setSavedProfiles(profiles.filter((p): p is PublicProfile => p !== null));
      savedFetchedRef.current = savedIdsKey;
      setSavedLoading(false);
    });
  }, [viewMode, savedIdsKey, savedProviderIds, getUserProfile]);

  // When switching to saved tab, trigger fetch if needed
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'saved' && savedIdsKey !== savedFetchedRef.current) {
      // useEffect above will fire; just reset so it runs
      savedFetchedRef.current = '';
    }
  };

  const handleMessage = async (providerId: string) => {
    const { chatId, error } = await startDirectChat(providerId);
    if (chatId) {
      router.push({ pathname: '/chat/[id]', params: { id: chatId } });
    } else if (error) {
      // Navigate to their profile so the user can still see info
      router.push({ pathname: '/user/[id]', params: { id: providerId } });
    }
  };

  if (!user) return null;

  if (user.role !== 'employer') {
    return (
      <Screen>
        <View style={[styles.headerBar, { paddingTop: insets.top + 14, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Find Providers</Text>
        </View>
        <EmptyState
          icon="people-outline"
          title="For employers only"
          body="This directory lets employers browse and contact service providers."
        />
      </Screen>
    );
  }

  // Derive display list based on view mode
  const isLoadingSaved = viewMode === 'saved' && savedLoading;
  const displayList = viewMode === 'saved' ? savedProfiles : results;

  const allCategories = CATEGORIES as readonly string[];

  return (
    <Screen>
      {/* ---- Header ---- */}
      <View
        style={[
          styles.headerBar,
          { paddingTop: insets.top + 14, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Find Providers</Text>
      </View>

      {/* ---- View mode tabs (All / Saved) ---- */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['all', 'saved'] as ViewMode[]).map((mode) => {
          const active = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => handleViewModeChange(mode)}
              style={[
                styles.tab,
                active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {mode === 'all' ? 'All' : `Saved${savedProviderIds.length > 0 ? ` (${savedProviderIds.length})` : ''}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ---- Filters (hidden in saved view) ---- */}
      {viewMode === 'all' && (
        <View style={[styles.filterWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {/* Name search */}
          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              placeholder="Search by name…"
              placeholderTextColor={colors.mutedForeground}
              value={nameQuery}
              onChangeText={setNameQuery}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
              clearButtonMode="while-editing"
              testID="provider-name-search"
            />
            {nameQuery.length > 0 ? (
              <Pressable onPress={() => setNameQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          {/* Work area */}
          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="location-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              placeholder="Filter by area (e.g. Austin)…"
              placeholderTextColor={colors.mutedForeground}
              value={workAreaQuery}
              onChangeText={setWorkAreaQuery}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
              clearButtonMode="while-editing"
              testID="provider-area-search"
            />
            {workAreaQuery.length > 0 ? (
              <Pressable onPress={() => setWorkAreaQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[
                styles.pill,
                selectedCategory === null
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: selectedCategory === null ? '#fff' : colors.mutedForeground },
                ]}
              >
                All
              </Text>
            </Pressable>
            {allCategories.map((c) => {
              const active = selectedCategory === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setSelectedCategory(active ? null : c)}
                  style={[
                    styles.pill,
                    active
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[c] ?? 'construct'}
                    size={12}
                    color={active ? '#fff' : colors.mutedForeground}
                  />
                  <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground }]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ---- Results ---- */}
      {(viewMode === 'all' && loading && !searched) || isLoadingSaved ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ProviderCard
              profile={item}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
              onMessage={() => handleMessage(item.id)}
              isSaved={savedProviderIds.includes(item.id)}
              onToggleSaved={() => toggleSavedProvider(item.id)}
            />
          )}
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 120,
            gap: 10,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            (viewMode === 'all' ? searched && !loading : !savedLoading) ? (
              <EmptyState
                icon={viewMode === 'saved' ? 'bookmark-outline' : 'people-outline'}
                title={viewMode === 'saved' ? 'No saved providers' : 'No providers found'}
                body={
                  viewMode === 'saved'
                    ? 'Tap the bookmark icon on any provider card to save them here.'
                    : 'Try adjusting your search or clearing the category filter.'
                }
              />
            ) : null
          }
          ListHeaderComponent={
            displayList.length > 0 && !(viewMode === 'all' ? loading : savedLoading) ? (
              <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
                {displayList.length} provider{displayList.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
  },
  tab: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginRight: 20,
  },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  filterWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    paddingVertical: 0,
  },
  pillRow: { gap: 6, paddingVertical: 2, paddingRight: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 4,
    marginLeft: 2,
  },
  // Card
  cardWrap: { width: '100%' },
  card: { gap: 10, padding: 14 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardInfo: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardName: { fontFamily: 'Inter_700Bold', fontSize: 15, flexShrink: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingText: { fontFamily: 'Inter_500Medium', fontSize: 11.5 },
  noRating: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontFamily: 'Inter_400Regular', fontSize: 11.5, flexShrink: 1 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  catText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  bio: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookmarkBtn: {
    padding: 4,
  },
  priceRange: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 90,
    justifyContent: 'center',
  },
  msgBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#fff' },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
