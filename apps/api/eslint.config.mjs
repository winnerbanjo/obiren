import tseslint from 'typescript-eslint';

/**
 * The API is a Node/Nest service, not a Next app, so it does not use the root
 * React/Next lint config. TypeScript's recommended rules apply as errors; the
 * three rules below are reported as warnings because this codebase crosses
 * untyped boundaries on purpose (Mongo/Mongoose documents, Nest request
 * objects, provider payloads and JSON fixtures in tests) and a hard failure
 * there has never matched the way the code is written.
 *
 * Build output is ignored: `tsc` emits next to the sources in some setups, and
 * linting generated `.d.ts` files is pure noise.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.d.ts',
      'openapi/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
);
