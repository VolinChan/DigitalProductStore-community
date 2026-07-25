import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // These React Compiler-oriented rules are stricter than the legacy
      // Next.js lint defaults and flag the app's existing effect-based data
      // loading and defensive rendering patterns.
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
