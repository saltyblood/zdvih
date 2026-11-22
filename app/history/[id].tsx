import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppError } from '@/src/domain/errors';
import { formatHistoryRow } from '@/src/domain/historyFormat';
import type { WorkoutDetail } from '@/src/services/workoutService';
import { errorMessage, strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { Button } from '@/src/ui/components/Button';
import { confirmDialog } from '@/src/ui/components/ConfirmDialog';
import { SetRow } from '@/src/ui/components/SetRow';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { workoutService } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.history;
  const busyRef = useRef(false);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const workoutId = Number(id);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      workoutService.workoutDetail(workoutId).then(
        (d) => {
          if (cancelled) return;
          setDetail(d);
          setError(null);
        },
        (e: unknown) => {
          if (!cancelled) setError(e instanceof AppError ? errorMessage(e.code) : t.loadFailed);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [workoutId, workoutService, t.loadFailed]),
  );

  async function doDelete() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await workoutService.deleteWorkout(workoutId);
      router.back(); // the list reloads on focus (D15)
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      Alert.alert(t.deleteFailed, e instanceof AppError ? errorMessage(e.code) : '');
    }
  }

  function onDelete() {
    confirmDialog({
      title: t.deleteTitle,
      message: t.deleteMessage,
      confirmLabel: t.deleteConfirm,
      destructive: true,
      onConfirm: () => void doDelete(),
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {detail ? (
        <>
          <Text style={styles.summary}>{formatHistoryRow(detail)}</Text>
          {detail.groups.map((g) => (
            <View key={g.exerciseId} style={styles.group}>
              <Text style={styles.groupTitle}>{g.exerciseName}</Text>
              {g.sets.map((s) => (
                <SetRow key={s.id} weightCg={s.weight_cg} reps={s.reps} />
              ))}
            </View>
          ))}
          <Button title={t.deleteWorkout} variant="secondary" onPress={onDelete} disabled={busy} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  summary: { fontSize: 16, fontWeight: '600' },
  group: { gap: 4 },
  groupTitle: { fontSize: 18, fontWeight: '700' },
  error: { color: '#c0392b', fontSize: 15 },
});
