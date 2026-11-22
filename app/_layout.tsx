import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { REST_SECONDS } from '@/src/config';
import { openExpoDb } from '@/src/db/expoDb';
import { runMigrations } from '@/src/db/migrations';
import { createExpoNotifier, installNotificationHandler } from '@/src/platform/expoNotifier';
import { systemClock } from '@/src/platform/systemClock';
import { createExerciseService } from '@/src/services/exerciseService';
import { createRestService } from '@/src/services/restService';
import { createSettingsService } from '@/src/services/settingsService';
import { createWorkoutService } from '@/src/services/workoutService';
import { strings } from '@/src/strings';
import { ActiveWorkoutProvider, type Services } from '@/src/ui/ActiveWorkoutContext';
import { WorkoutRuntime } from '@/src/ui/WorkoutRuntime';

// D11: the single notification handler of the app.
installNotificationHandler();

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; services: Services };

async function bootstrap(): Promise<Services> {
  const db = await openExpoDb();
  await runMigrations(db);
  const notifier = createExpoNotifier();
  const clock = systemClock;
  return {
    db,
    notifier,
    clock,
    workoutService: createWorkoutService({ db, notifier, clock }),
    restService: createRestService({ db, notifier, clock, restSeconds: REST_SECONDS }),
    exerciseService: createExerciseService({ db }),
    settingsService: createSettingsService({ db, notifier }),
  };
}

export default function RootLayout() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    bootstrap().then(
      (services) => {
        if (!cancelled) setState({ status: 'ready', services });
      },
      (e: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : strings.shell.unknownError,
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>{strings.shell.loading}</Text>
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{strings.shell.openFailedTitle}</Text>
        <Text style={styles.text}>{state.message}</Text>
      </View>
    );
  }

  return (
    <ActiveWorkoutProvider services={state.services}>
      <WorkoutRuntime />
      {/* D19: without an explicit header background the iOS 26 header becomes a transparent
          Liquid Glass bar drawn over the content; headerTransparent: false keeps it opaque and
          lays every screen out below it. */}
      <Stack screenOptions={{ headerTransparent: false }}>
        <Stack.Screen name="index" options={{ title: strings.appName }} />
        <Stack.Screen name="workout" options={{ title: strings.workout.title }} />
        <Stack.Screen
          name="log-set"
          options={{ title: strings.logSet.titleAdd, presentation: 'modal' }}
        />
        <Stack.Screen name="exercises/index" options={{ title: strings.exercises.title }} />
        <Stack.Screen name="exercises/new" options={{ title: strings.exercises.addTitle }} />
        <Stack.Screen name="exercises/[id]" options={{ title: strings.progress.title }} />
        <Stack.Screen name="history/index" options={{ title: strings.history.title }} />
        <Stack.Screen name="history/[id]" options={{ title: strings.history.detailTitle }} />
        <Stack.Screen name="dev-check" options={{ title: strings.devCheck.title }} />
      </Stack>
      <StatusBar style="auto" />
    </ActiveWorkoutProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  text: { fontSize: 16, color: '#555', textAlign: 'center' },
  errorTitle: { fontSize: 20, fontWeight: '700' },
});
