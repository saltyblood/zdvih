import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatCountdown } from '../../domain/time';
import { strings } from '../../strings';
import { useActiveWorkout } from '../ActiveWorkoutContext';
import { Button } from './Button';

const POLL_MS = 250;

/**
 * §6.2: idle -> "Start rest"; running -> countdown + "Restart" + "Stop".
 * The remaining time is read from restService every 250 ms (D10), never counted locally.
 */
export function RestBar({ disabled = false }: { disabled?: boolean }) {
  const { restService } = useActiveWorkout();
  const [remaining, setRemaining] = useState(0);
  const busy = useRef(false);

  const poll = useCallback(async () => {
    try {
      setRemaining(await restService.remainingSeconds());
    } catch {
      // keep the last value
    }
  }, [restService]);

  useEffect(() => {
    const first = setTimeout(() => void poll(), 0);
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [poll]);

  // Guards against double taps while a call is in flight.
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } catch {
      // the next poll shows the real state
    } finally {
      busy.current = false;
      await poll();
    }
  }

  if (remaining <= 0) {
    return (
      <View style={styles.row}>
        <Button
          title={strings.rest.start}
          variant="secondary"
          disabled={disabled}
          onPress={() => void run(() => restService.startRest())}
        />
      </View>
    );
  }

  return (
    <View style={styles.running}>
      <Text style={styles.countdown} accessibilityLiveRegion="none">
        {formatCountdown(remaining)}
      </Text>
      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button
            title={strings.rest.restart}
            variant="secondary"
            disabled={disabled}
            onPress={() => void run(() => restService.startRest())}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={strings.rest.stop}
            variant="secondary"
            disabled={disabled}
            onPress={() => void run(() => restService.stopRest())}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'stretch' },
  running: { alignSelf: 'stretch', gap: 8 },
  countdown: { fontSize: 56, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
