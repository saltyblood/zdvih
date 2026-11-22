import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppError, type ErrorCode } from '@/src/domain/errors';
import { validateSetInput, weightInputText } from '@/src/domain/setInput';
import { formatDate } from '@/src/domain/time';
import { formatKg } from '@/src/domain/weight';
import type { Exercise } from '@/src/repos/exerciseRepo';
import { pickerSections } from '@/src/services/exercisePicker';
import type { PreviousSets } from '@/src/services/workoutService';
import { errorMessage, strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { Button } from '@/src/ui/components/Button';
import { confirmDialog } from '@/src/ui/components/ConfirmDialog';
import { EmptyState } from '@/src/ui/components/EmptyState';

export default function LogSetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ setId?: string }>();
  const { active, workoutService, exerciseService, refresh } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.logSet;
  // Synchronous guard against double submit (state from a dialog's closure can be stale).
  const busyRef = useRef(false);

  const setId = params.setId !== undefined ? Number(params.setId) : null;
  const editing = setId !== null;
  const editSet = editing ? (active?.sets.find((s) => s.id === setId) ?? null) : null;

  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [previousFor, setPreviousFor] = useState<{
    exerciseId: number;
    data: PreviousSets | null;
    failed: boolean;
  } | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [serverError, setServerError] = useState<{ code: ErrorCode | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editInit, setEditInit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    exerciseService.list().then(
      (list) => {
        if (!cancelled) setExercises(list);
      },
      () => {
        if (!cancelled) setLoadError(t.loadFailed);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [exerciseService, t.loadFailed]);

  // Edit mode: exercise is fixed, fields start from the stored set (once; adjusted during render).
  if (editSet && !editInit) {
    setEditInit(true);
    setExerciseId(editSet.exercise_id);
    setWeight(weightInputText(editSet.weight_cg));
    setReps(String(editSet.reps));
  }

  // Previous sets of the chosen exercise (2.2a/2.2b); add mode prefills from the last one (2.2c).
  useEffect(() => {
    if (exerciseId === null) return;
    let cancelled = false;
    workoutService.previousSets(exerciseId).then(
      (p) => {
        if (cancelled) return;
        setPreviousFor({ exerciseId, data: p, failed: false });
        if (!editing && p && p.sets.length > 0) {
          // Prefill only fields the user has not typed into yet.
          const last = p.sets[p.sets.length - 1];
          setWeight((cur) => (cur === '' ? weightInputText(last.weight_cg) : cur));
          setReps((cur) => (cur === '' ? String(last.reps) : cur));
        }
      },
      () => {
        // A failed query is not "no previous sets" (2.2b): show an error instead.
        if (!cancelled) setPreviousFor({ exerciseId, data: null, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [exerciseId, editing, workoutService]);

  // undefined = still loading for the chosen exercise
  const previousCurrent = previousFor?.exerciseId === exerciseId ? previousFor : null;
  const previous = previousCurrent ? previousCurrent.data : undefined;
  const previousFailed = previousCurrent?.failed ?? false;
  const sections = useMemo(() => pickerSections(exercises ?? [], query), [exercises, query]);
  const input = validateSetInput(weight, reps);
  const exerciseName =
    exercises?.find((e) => e.id === exerciseId)?.name ?? editSet?.exercise_name ?? '';

  function onWeight(v: string) {
    setWeight(v);
    setServerError(null);
  }
  function onReps(v: string) {
    setReps(v);
    setServerError(null);
  }
  function chooseExercise(id: number) {
    setWeight('');
    setReps('');
    setServerError(null);
    setExerciseId(id);
  }
  function changeExercise() {
    setExerciseId(null);
    setWeight('');
    setReps('');
    setServerError(null);
  }

  async function finish() {
    await refresh(); // D15
    router.dismissTo('/workout');
  }

  function showFailure(e: unknown, title: string) {
    if (e instanceof AppError) {
      if (e.code === 'WEIGHT_INVALID' || e.code === 'REPS_INVALID') {
        setServerError({ code: e.code });
      } else {
        Alert.alert(title, errorMessage(e.code));
      }
    } else {
      Alert.alert(title);
    }
  }

  async function onSave() {
    if (busyRef.current || exerciseId === null || !input.canSave) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (editing && setId !== null) await workoutService.updateSet(setId, weight, reps);
      else await workoutService.addSet(exerciseId, weight, reps);
      await finish();
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      await refresh();
      showFailure(e, t.saveFailed);
    }
  }

  async function doDelete() {
    if (busyRef.current || setId === null) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await workoutService.deleteSet(setId);
      await finish();
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      await refresh();
      showFailure(e, t.deleteFailed);
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

  const title = editing ? t.titleEdit : t.titleAdd;
  // Bottom of each list clears the home indicator; the scroll views also move content above
  // the keyboard (number pads have no return key to dismiss it).
  const contentStyle = [styles.content, { paddingBottom: 16 + insets.bottom }];
  const weightErrorShown =
    input.weightError ?? (serverError?.code === 'WEIGHT_INVALID' ? serverError.code : null);
  const repsErrorShown =
    input.repsError ?? (serverError?.code === 'REPS_INVALID' ? serverError.code : null);

  // Edit mode: the set is gone (e.g. the workout was finished) -> NOT_FOUND message.
  if (editing) {
    if (active === undefined) return null;
    if (!editSet && !editInit) {
      return (
        <View style={styles.center}>
          <Stack.Screen options={{ title }} />
          <Text style={styles.error}>{errorMessage('NOT_FOUND')}</Text>
          <Button title={strings.common.cancel} variant="secondary" onPress={() => router.back()} />
        </View>
      );
    }
  }

  // Step 1: exercise picker (add mode only)
  if (exerciseId === null) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Stack.Screen options={{ title }} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {exercises !== null && sections.length === 0 ? (
          <EmptyState text={t.noMatches} />
        ) : null}
        {sections.map((s) => (
          <View key={s.group} style={styles.section}>
            <Text style={styles.sectionTitle}>{strings.muscleGroups[s.group]}</Text>
            {s.exercises.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                onPress={() => chooseExercise(e.id)}
                style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
              >
                <Text style={styles.pickText}>{e.name}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Button title={strings.common.cancel} variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  // Step 2: previous sets + weight/reps form
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title }} />
      <Text style={styles.exercise}>{exerciseName}</Text>
      {!editing ? (
        <Pressable accessibilityRole="button" onPress={changeExercise} disabled={busy}>
          <Text style={styles.link}>{t.changeExercise}</Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        {previousFailed ? (
          <Text style={styles.error}>{t.previousFailed}</Text>
        ) : previous === undefined ? null : previous === null ? (
          <Text style={styles.muted}>{t.noPrevious}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {t.lastTime} · {formatDate(previous.workoutStartedAt)}
            </Text>
            {previous.sets.map((s) => (
              <Text key={s.id} style={styles.prevRow}>
                {formatKg(s.weight_cg)} × {s.reps}
              </Text>
            ))}
          </>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t.weightLabel}</Text>
        <TextInput
          style={[styles.input, weightErrorShown && styles.inputError]}
          value={weight}
          onChangeText={onWeight}
          keyboardType="decimal-pad"
          returnKeyType="done"
          editable={!busy}
        />
        {weightErrorShown ? <Text style={styles.error}>{errorMessage(weightErrorShown)}</Text> : null}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t.repsLabel}</Text>
        <TextInput
          style={[styles.input, repsErrorShown && styles.inputError]}
          value={reps}
          onChangeText={onReps}
          keyboardType="number-pad"
          editable={!busy}
        />
        {repsErrorShown ? <Text style={styles.error}>{errorMessage(repsErrorShown)}</Text> : null}
      </View>

      <Button
        title={editing ? t.save : t.saveSet}
        onPress={() => void onSave()}
        disabled={!input.canSave || busy}
      />
      {editing ? (
        <Button title={t.deleteSet} variant="secondary" onPress={onDelete} disabled={busy} />
      ) : null}
      <Button title={strings.common.cancel} variant="secondary" onPress={() => router.back()} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  section: { gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  pickRow: { paddingVertical: 12, paddingHorizontal: 12 },
  pickText: { fontSize: 17 },
  pressed: { opacity: 0.5 },
  exercise: { fontSize: 22, fontWeight: '700' },
  link: { fontSize: 16, color: '#0a7ea4' },
  muted: { fontSize: 16, color: '#666' },
  prevRow: { fontSize: 17, paddingHorizontal: 12 },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  inputError: { borderColor: '#c0392b' },
  error: { color: '#c0392b', fontSize: 15 },
});
