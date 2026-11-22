import { StyleSheet, Text, View } from 'react-native';

import { formatKg } from '../../domain/weight';

/** `80 kg × 8` (the exercise name is the group heading above the rows). */
export function SetRow({ weightCg, reps }: { weightCg: number; reps: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>
        {formatKg(weightCg)} × {reps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, paddingHorizontal: 12 },
  text: { fontSize: 17 },
});
