// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/', 'node_modules/'],
  },
  {
    rules: {
      // Allow underscore-prefixed unused args (e.g. _backups)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests commonly need `any` for mocks and partial test data
      '@typescript-eslint/no-explicit-any': 'off',
      // Integration tests use require() for dynamic imports
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
