import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useActiveWorkout } from './ActiveWorkoutContext';

/** 1.4a: mounted only while a workout is active; unmounting restores auto-lock. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * D12 / 6.3: root runtime logic that works on every screen while a workout is active.
 * Step 5: keep-awake and AppState. The accelerometer, countdown tick and vibration come in step 7.
 */
export function WorkoutRuntime() {
  const { active, restService, refresh } = useActiveWorkout();
  const isActive = active != null;

  useEffect(() => {
    if (!isActive) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // T5: clear an expired rest silently, then reload the state.
        void restService.onForeground().then(refresh, refresh);
      } else if (state === 'background') {
        // Step 7: detector.reset() goes here (the accelerometer gets no samples in the background).
      }
    });
    return () => sub.remove();
  }, [isActive, restService, refresh]);

  return isActive ? <KeepAwake /> : null;
}
