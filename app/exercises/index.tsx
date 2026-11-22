import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppError } from '@/src/domain/errors';
import type { Exercise } from '@/src/repos/exerciseRepo';
import { pickerSections } from '@/src/services/exercisePicker';
import { errorMessage, strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { Button } from '@/src/ui/components/Button';
import { confirmDialog } from '@/src/ui/components/ConfirmDialog';

// Cast: typed-routes types (.expo/types, git-ignored) may be stale.
const NEW_ROUTE = '/exercises/new' as Href;

export default function ExercisesScreen() {
  const router = useRouter();
  const { exerciseService } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.exercises;
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [deletable, setDeletable] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // D15: reload on every focus (a new exercise or a deletion changes the list).
  const load = useCallback(async () => {
    try {
      const list = await exerciseService.list();
      const ids = new Set<number>();
      for (const e of list) {
        if (!e.is_builtin && (await exerciseService.canDelete(e.id))) ids.add(e.id);
      }
      setExercises(list);
      setDeletable(ids);
      setError(null);
    } catch {
      setError(t.loadFailed);
    }
  }, [exerciseService, t.loadFailed]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sections = useMemo(() => pickerSections(exercises ?? [], ''), [exercises]);

  async function doDelete(id: number) {
    try {
      await exerciseService.delete(id);
    } catch (e) {
      Alert.alert(t.deleteFailed, e instanceof AppError ? errorMessage(e.code) : '');
    }
    await load();
  }

  function onDelete(e: Exercise) {
    confirmDialog({
      title: t.deleteTitle,
      message: `${e.name}\n${t.deleteMessage}`,
      confirmLabel: t.delete,
      destructive: true,
      onConfirm: () => void doDelete(e.id),
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
    >
      <Button title={t.add} onPress={() => router.push(NEW_ROUTE)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {sections.map((s) => (
        <View key={s.group} style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.muscleGroups[s.group]}</Text>
          {s.exercises.map((e) => (
            <View key={e.id} style={styles.row}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: String(e.id) } })}
              >
                <Text style={styles.rowText}>{e.name}</Text>
              </Pressable>
              {deletable.has(e.id) ? (
                <Pressable accessibilityRole="button" onPress={() => onDelete(e)} style={styles.delete}>
                  <Text style={styles.deleteText}>{t.delete}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  section: { gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  rowText: { fontSize: 17 },
  pressed: { opacity: 0.5 },
  delete: { paddingVertical: 12, paddingHorizontal: 12 },
  deleteText: { fontSize: 16, color: '#c0392b' },
  error: { color: '#c0392b', fontSize: 15 },
});
