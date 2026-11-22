import { defineConfig } from 'vitest/config';

export default defineConfig({
  // src/config.ts reads the React Native global __DEV__, which does not exist in Node.
  // false = release behaviour: defaults 180 s / 1800 s, D13 env overrides ignored.
  define: { __DEV__: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
