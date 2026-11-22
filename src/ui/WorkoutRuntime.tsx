import { Accelerometer } from 'expo-sensors';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Vibration } from 'react-native';

import { DETECTOR } from '../config';
import { createPickupDetector } from '../domain/pickupDetector';
import { createRestTick } from '../services/restTick';
import { useActiveWorkout } from './ActiveWorkoutContext';

const TICK_MS = 250;
const SENSOR_INTERVAL_MS = 100;

/** 1.4a: mounted only while a workout is active; unmounting restores auto-lock. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * D12 / 6.3: root runtime logic that works on every screen while a workout is active:
 * keep-awake, accelerometer -> pickup detector -> restService.onPickup (T3),
 * the 250 ms countdown tick with vibration (T4), and AppState / cold start handling (T5).
 */
export function WorkoutRuntime() {
  const { active, restService, refresh } = useActiveWorkout();
  const isActive = active != null;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  // T5: true once the cold-start onForeground() has finished; the T4 tick starts only after it.
  const [coldStartDone, setColdStartDone] = useState(false);

  const detector = useMemo(() => createPickupDetector(DETECTOR), []);
  const restTick = useMemo(
    () => createRestTick(restService, () => Vibration.vibrate()),
    [restService],
  );

  // T5: cold start counts as returning to the foreground (AppState emits no 'active' change).
  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setColdStartDone(true);
    };
    restService
      .onForeground()
      .catch(() => undefined)
      .then(() => refresh())
      .then(done, done);
    return () => {
      cancelled = true;
    };
  }, [restService, refresh]);

  // AppState: background -> reset detector and tick memory; active -> T5.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      detector.reset();
      restTick.reset();
      if (state === 'active') {
        void restService
          .onForeground()
          .catch(() => undefined)
          .then(() => refresh());
      }
    });
    return () => sub.remove();
  }, [detector, restTick, restService, refresh]);

  // T4: 250 ms tick, vibrates on the crossing to 0.
  const ticking = isActive && foreground && coldStartDone;
  useEffect(() => {
    if (!ticking) return;
    restTick.reset();
    const id = setInterval(() => {
      void restTick.tick().then(
        (vibrated) => (vibrated ? refresh() : undefined),
        () => undefined,
      );
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ticking, restTick, refresh]);

  // 5.5 / T3: accelerometer only while a workout is active and the app is in the foreground.
  const sensing = isActive && foreground;
  useEffect(() => {
    if (!sensing) {
      detector.reset();
      return;
    }
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    void Accelerometer.isAvailableAsync().then(
      (available) => {
        // Unavailable: automatic start is silently disabled; the manual button still works.
        if (cancelled || !available) return;
        Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
        subscription = Accelerometer.addListener(({ x, y, z, timestamp }) => {
          // R10: expo-sensors reports the timestamp in seconds; the detector wants ms.
          if (detector.push({ t: timestamp * 1000, x, y, z }) === 'pickup') {
            void restService.onPickup().then(refresh, refresh);
          }
        });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      subscription?.remove();
      detector.reset();
    };
  }, [sensing, detector, restService, refresh]);

  return isActive ? <KeepAwake /> : null;
}
