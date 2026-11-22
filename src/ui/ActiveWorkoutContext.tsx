import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '../strings';
import { Button } from './components/Button';

import type { Db } from '../db/db';
import type { Clock, Notifier } from '../services/ports';
import type { ActiveWorkout, WorkoutService } from '../services/workoutService';
import type { RestService } from '../services/restService';
import type { ExerciseService } from '../services/exerciseService';
import type { SettingsService } from '../services/settingsService';

export interface Services {
  db: Db;
  notifier: Notifier;
  clock: Clock;
  workoutService: WorkoutService;
  restService: RestService;
  exerciseService: ExerciseService;
  settingsService: SettingsService;
}

export interface ActiveWorkoutContextValue extends Services {
  /** null = no active workout; undefined = not loaded yet */
  active: ActiveWorkout | null | undefined;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ActiveWorkoutContextValue | null>(null);

/** D15: exposes the active workout, refresh() and the services. */
export function ActiveWorkoutProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  const [active, setActive] = useState<ActiveWorkout | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const { workoutService } = services;

  /** Never rejects: on failure the previous state is kept (initial load failure shows a retry screen). */
  const refresh = useCallback(async () => {
    try {
      setActive(await workoutService.getActive());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [workoutService]);

  useEffect(() => {
    let cancelled = false;
    workoutService.getActive().then(
      (a) => {
        if (!cancelled) setActive(a);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [workoutService]);

  const value = useMemo(() => ({ ...services, active, refresh }), [services, active, refresh]);
  if (active === undefined && loadFailed) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>{strings.shell.loadFailed}</Text>
        <Button title={strings.shell.retry} onPress={() => void refresh()} />
      </View>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { fontSize: 18, textAlign: 'center' },
});

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  return v;
}
