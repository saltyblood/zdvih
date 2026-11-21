import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { strings } from '@/src/strings';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: strings.appName }} />
        <Stack.Screen name="dev-check" options={{ title: strings.devCheck.title }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
