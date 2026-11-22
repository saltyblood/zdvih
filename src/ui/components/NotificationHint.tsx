import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '../../strings';
import { useActiveWorkout } from '../ActiveWorkoutContext';

/** T6 (3.4d): the one-time "rest alerts are off" hint; the shown flag lives in `settings`. */
export function NotificationHint() {
  const { settingsService } = useActiveWorkout();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void settingsService.takeDeniedHint().then((show) => {
      if (!cancelled && show) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [settingsService]);

  if (!visible) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{strings.notifications.hintDenied}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { margin: 16, marginBottom: 0, padding: 12, borderRadius: 10, backgroundColor: '#fff4d6' },
  text: { fontSize: 15, color: '#5c4400' },
});
