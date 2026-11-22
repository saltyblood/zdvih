import { StyleSheet, Text, View } from 'react-native';

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 24, alignItems: 'center' },
  text: { fontSize: 16, color: '#777' },
});
