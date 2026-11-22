import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatHistoryRow } from '@/src/domain/historyFormat';
import type { HistoryItem } from '@/src/services/workoutService';
import { strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { EmptyState } from '@/src/ui/components/EmptyState';

export default function HistoryScreen() {
  const router = useRouter();
  const { workoutService } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.history;
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // D15: reload on every focus (a deleted workout must disappear when coming back).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workoutService.history().then(
        (list) => {
          if (cancelled) return;
          setItems(list);
          setError(null);
        },
        () => {
          if (!cancelled) setError(t.loadFailed);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [workoutService, t.loadFailed]),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items !== null && items.length === 0 ? <EmptyState text={t.empty} /> : null}
      {(items ?? []).map((h) => (
        <Pressable
          key={h.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(h.id) } })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowText}>{formatHistoryRow(h)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  row: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pressed: { opacity: 0.5 },
  rowText: { fontSize: 16 },
  error: { color: '#c0392b', fontSize: 15 },
});
