import { Redirect, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppError } from '@/src/domain/errors';
import { durationMinutes, formatTime } from '@/src/domain/time';
import { errorMessage, strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { confirmDialog } from '@/src/ui/components/ConfirmDialog';
import { EmptyState } from '@/src/ui/components/EmptyState';
import { SetRow } from '@/src/ui/components/SetRow';
import { useNow } from '@/src/ui/useNow';

export default function WorkoutScreen() {
  const router = useRouter();
  const { active, workoutService, refresh } = useActiveWorkout();
  const now = useNow();
  const [finishing, setFinishing] = useState(false);
  const t = strings.workout;

  // Sets grouped by exercise in logged order (position order, first appearance).
  const groups = useMemo(() => {
    const result: { exerciseId: number; name: string; sets: NonNullable<typeof active>['sets'] }[] =
      [];
    for (const s of active?.sets ?? []) {
      let g = result.find((x) => x.exerciseId === s.exercise_id);
      if (!g) {
        g = { exerciseId: s.exercise_id, name: s.exercise_name, sets: [] };
        result.push(g);
      }
      g.sets.push(s);
    }
    return result;
  }, [active]);

  if (active === undefined) return null;
  // While finishing, doFinish navigates back to Home itself (no Redirect, so no extra Home entry).
  if (active === null) return finishing ? null : <Redirect href="/" />;

  const hasSets = active.sets.length > 0;

  async function doFinish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await workoutService.finishWorkout();
      await refresh();
      // Pops back to the existing Home ([index, workout] -> [index]); `finishing` stays true on
      // success so the null-active Redirect cannot fire meanwhile.
      router.dismissTo('/');
    } catch (e) {
      await refresh();
      setFinishing(false);
      Alert.alert(t.finishFailed, e instanceof AppError ? errorMessage(e.code) : '');
    }
  }

  function onFinish() {
    confirmDialog({
      title: t.finishTitle,
      message: hasSets ? t.finishMessage : t.discardMessage,
      confirmLabel: hasSets ? t.finishConfirm : t.discardConfirm,
      onConfirm: () => void doFinish(),
    });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={onFinish} disabled={finishing}>
              <Text style={styles.finish}>{t.finish}</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {t.started} {formatTime(active.started_at)} · {durationMinutes(active.started_at, now)}{' '}
          {t.minutes}
        </Text>
      </View>
      {/* Step 6 adds the "Log set" button and tappable rows; step 7 adds RestBar and the T6 hint. */}
      <ScrollView contentContainerStyle={styles.body}>
        {groups.length === 0 ? (
          <EmptyState text={t.noSets} />
        ) : (
          groups.map((g) => (
            <View key={g.exerciseId} style={styles.group}>
              <Text style={styles.groupTitle}>{g.name}</Text>
              {g.sets.map((s) => (
                <SetRow key={s.id} weightCg={s.weight_cg} reps={s.reps} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  headerText: { fontSize: 18, fontWeight: '600' },
  finish: { fontSize: 17, fontWeight: "600", color: "#0a7ea4", padding: 8 },
  body: { padding: 16, gap: 16 },
  group: { gap: 4 },
  groupTitle: { fontSize: 18, fontWeight: '700' },
});
