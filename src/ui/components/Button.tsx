import { Pressable, StyleSheet, Text } from 'react-native';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.text, primary ? styles.textPrimary : styles.textSecondary]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center' },
  primary: { backgroundColor: '#0a7ea4' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#0a7ea4' },
  dim: { opacity: 0.6 },
  text: { fontSize: 18, fontWeight: '600' },
  textPrimary: { color: '#fff' },
  textSecondary: { color: '#0a7ea4' },
});
