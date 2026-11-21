import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/src/strings';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.home.title}</Text>
      <Text style={styles.tagline}>{strings.home.tagline}</Text>
      {__DEV__ ? (
        <Link href="/dev-check" style={styles.link}>
          {strings.home.deviceCheck}
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
  tagline: { fontSize: 16, color: '#555' },
  link: { fontSize: 18, color: '#0a7ea4', padding: 12 },
});
