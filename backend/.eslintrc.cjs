/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  settings: {},
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    'dist/',
    'coverage/',
    'node_modules/',
    'src/dashboard/**',
    '*.js',
  ],
  rules: {
    // Allow console in server code; consider gating by NODE_ENV if needed
    'no-console': 'off',

    // Relax some TS rules but keep signals for cleanup
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    '@typescript-eslint/ban-ts-comment': 'off',
  },
};
