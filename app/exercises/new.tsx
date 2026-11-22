import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppError, type ErrorCode } from '@/src/domain/errors';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/src/repos/exerciseRepo';
import { errorMessage, strings } from '@/src/strings';
import { useActiveWorkout } from '@/src/ui/ActiveWorkoutContext';
import { Button } from '@/src/ui/components/Button';

export default function NewExerciseScreen() {
  const router = useRouter();
  const { exerciseService } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const t = strings.exercises;
  const busyRef = useRef(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [nameError, setNameError] = useState<ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await exerciseService.create(name, group);
      router.back();
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      if (e instanceof AppError && (e.code === 'EXERCISE_EXISTS' || e.code === 'NAME_INVALID')) {
        setNameError(e.code); // 4.2a, 4.2b: shown under the name field
      } else {
        Alert.alert(t.saveFailed, e instanceof AppError ? errorMessage(e.code) : '');
      }
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.field}>
        <Text style={styles.label}>{t.nameLabel}</Text>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameError(null);
          }}
          autoCapitalize="words"
          returnKeyType="done"
          editable={!busy}
        />
        {nameError ? <Text style={styles.error}>{errorMessage(nameError)}</Text> : null}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t.groupLabel}</Text>
        {MUSCLE_GROUPS.map((g) => (
          <Pressable
            key={g}
            accessibilityRole="radio"
            accessibilityState={{ selected: g === group }}
            onPress={() => setGroup(g)}
            disabled={busy}
            style={[styles.option, g === group && styles.optionSelected]}
          >
            <Text style={[styles.optionText, g === group && styles.optionTextSelected]}>
              {strings.muscleGroups[g]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button title={t.save} onPress={() => void onSave()} disabled={busy} />
      <Button title={t.cancel} variant="secondary" onPress={() => router.back()} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
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
  option: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  optionSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  optionText: { fontSize: 17 },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
});
