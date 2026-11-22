import { Pressable, StyleSheet, Text } from 'react-native';

import { formatKg } from '../../domain/weight';

/** `80 kg × 8` (the exercise name is the group heading above the rows). Tappable when onPress is set. */
export function SetRow({
  weightCg,
  reps,
  onPress,
}: {
  weightCg: number;
  reps: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.text}>
        {formatKg(weightCg)} × {reps}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, paddingHorizontal: 12 },
  pressed: { opacity: 0.5 },
  text: { fontSize: 17 },
});
