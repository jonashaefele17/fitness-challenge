import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'supabase', 'src/shared/types/database.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  // Architecture rules (CLAUDE.md): features are only imported through their index.ts,
  // and only the data layer may talk to Supabase.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/lib/supabase.ts', 'src/features/*/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Only src/shared/lib/supabase.ts and features/*/api may use Supabase.',
            },
            {
              name: '@/shared/lib/supabase',
              message: 'Components must use hooks from features/<name>/api instead.',
            },
          ],
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Import other features only through their index.ts (@/features/<name>).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/*/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Import other features only through their index.ts (@/features/<name>).',
            },
          ],
        },
      ],
    },
  },
  // Context providers live next to their hooks in api/ by design.
  {
    files: ['src/features/*/api/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // Design rule: no raw hex colours in components; use design tokens.
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\b/]',
          message: 'Use design tokens instead of hex colours.',
        },
      ],
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
