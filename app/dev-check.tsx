import { Redirect } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Switch, Text, Vibration, View } from 'react-native';

import { strings } from '@/src/strings';

const KEEP_AWAKE_TAG = 'dev-check';

// The app-wide notification handler (D11) lives in src/platform/expoNotifier.ts and is installed
// by app/_layout.tsx. Notifications without data.kind (like the one below) are shown as a banner.

export default function DevCheckRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevCheck />;
}

function DevCheck() {
  const t = strings.devCheck;
  const [notifyStatus, setNotifyStatus] = useState('');
  const [keepAwake, setKeepAwake] = useState(false);
  const [accelAvailable, setAccelAvailable] = useState<boolean | null>(null);
  const [delta, setDelta] = useState(0);
  const [maxDelta, setMaxDelta] = useState(0);
  const [sqliteStatus, setSqliteStatus] = useState('');
  const previous = useRef<{ x: number; y: number; z: number } | null>(null);

  const notify = useCallback(async () => {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      setNotifyStatus(t.notifyDenied);
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: t.notifyTitle, body: t.notifyBody },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
      },
    });
    setNotifyStatus(t.notifyScheduled);
  }, [t]);

  useEffect(() => {
    if (keepAwake) {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepAwake]);

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    void Accelerometer.isAvailableAsync().then((available) => {
      if (cancelled) return;
      setAccelAvailable(available);
      if (!available) return;
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const prev = previous.current;
        previous.current = { x, y, z };
        if (!prev) return;
        const d = Math.hypot(x - prev.x, y - prev.y, z - prev.z);
        setDelta(d);
        setMaxDelta((m) => Math.max(m, d));
      });
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const sqliteCheck = useCallback(async () => {
    try {
      const db = await SQLite.openDatabaseAsync('devcheck.db');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS dev_check (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)',
      );
      const value = new Date().toISOString();
      await db.runAsync('INSERT INTO dev_check (value) VALUES (?)', [value]);
      const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM dev_check');
      const last = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM dev_check ORDER BY id DESC LIMIT 1',
      );
      await db.closeAsync();
      setSqliteStatus(`${t.sqliteResult}: ${count?.n ?? 0}\n${t.sqliteLast}: ${last?.value ?? ''}`);
    } catch (e) {
      setSqliteStatus(`${t.sqliteError}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [t]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Section title={t.notifySection}>
        <Button title={t.notifyButton} onPress={() => void notify()} />
        <Text>{notifyStatus}</Text>
      </Section>

      <Section title={t.vibrateSection}>
        <Button title={t.vibrateButton} onPress={() => Vibration.vibrate()} />
      </Section>

      <Section title={t.keepAwakeSection}>
        <View style={styles.row}>
          <Text>{t.keepAwakeLabel}</Text>
          <Switch value={keepAwake} onValueChange={setKeepAwake} />
        </View>
      </Section>

      <Section title={t.accelSection}>
        {accelAvailable === false ? (
          <Text>{t.accelUnavailable}</Text>
        ) : (
          <>
            <Text>
              {t.accelDelta}: {delta.toFixed(3)}
            </Text>
            <Text>
              {t.accelMax}: {maxDelta.toFixed(3)}
            </Text>
            <Button title={t.accelReset} onPress={() => setMaxDelta(0)} />
          </>
        )}
      </Section>

      <Section title={t.sqliteSection}>
        <Button title={t.sqliteButton} onPress={() => void sqliteCheck()} />
        <Text>{sqliteStatus}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
