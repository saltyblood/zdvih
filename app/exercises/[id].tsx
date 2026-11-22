import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatProgressRow } from '@/src/domain/historyFormat';
import { formatDate } from '@/src/domain/time';
import type { ProgressPoint } from '@/src/services/workoutService';
import { strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { EmptyState } from '@/src/ui/components/EmptyState';
import { LineChart } from '@/src/ui/components/LineChart';

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workoutService, exerciseService } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.progress;
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const exerciseId = Number(id);
      Promise.all([workoutService.progress(exerciseId), exerciseService.list()]).then(
        ([p, list]) => {
          if (cancelled) return;
          setPoints(p);
          setName(list.find((e) => e.id === exerciseId)?.name ?? null);
          setError(null);
        },
        () => {
          if (!cancelled) setError(t.loadFailed);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [id, workoutService, exerciseService, t.loadFailed]),
  );

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
    >
      <Stack.Screen options={{ title: name ?? t.title }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {points === null ? null : points.length < 2 ? (
        // 5.3b
        <EmptyState text={t.notEnough} />
      ) : (
        <LineChart
          points={points.map((p) => ({ value: p.e1rmCg, label: formatDate(p.startedAt) }))}
        />
      )}
      {points !== null && points.length > 0 ? (
        <View style={styles.list}>
          {[...points].reverse().map((p) => (
            <Text key={p.workoutId} style={styles.row}>
              {formatProgressRow(p)}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  list: { gap: 8 },
  row: { fontSize: 16 },
  error: { color: '#c0392b', fontSize: 15 },
});
