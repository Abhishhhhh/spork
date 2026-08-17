import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Scoped deliberately to the two classic hooks rules, not the full
// eslint-plugin-react-hooks v7 "recommended" preset — that preset now
// bundles React Compiler-era rules (immutability, purity,
// set-state-in-render, static-components, etc.) which is a much bigger
// surface than what this project asked for. rules-of-hooks is the exact
// bug class that bit FriendProfile.tsx during the Likes & Comments phase
// (calling hooks after a conditional early return); exhaustive-deps is
// the other classic hooks pitfall (stale closures from a missing
// dependency), included as a low-noise "warn" alongside it.
//
// Only src/** is linted — the actual React app. scripts/*.mjs (a plain
// Node script) and supabase/functions/** (Deno edge functions) run under
// different global environments than the browser app and weren't part of
// what this was for; linting them properly is a separate task.
export default tseslint.config(
  { ignores: ['dist/**', 'scripts/**', 'supabase/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Destructuring-to-omit (`const { x: _x, ...rest } = obj`) is an
      // idiomatic way to drop a field while collecting the remainder —
      // the leading underscore is the standard "deliberately unused"
      // signal, so don't flag it.
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
)
