import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ---------------------------------------------------------------------------
// Module boundaries (CLAUDE.md, architecture rules 13–15)
// ---------------------------------------------------------------------------

/** Every folder in src/features must be listed in exactly one category. */
const modules = {
  core: ['auth', 'profile'],
  personal: ['training', 'habits', 'body', 'goals', 'calendar-sync'],
  social: [
    'groups',
    'feed',
    'comments',
    'reactions',
    'seasons',
    'comparison',
    'notifications',
    'admin',
    'invitations',
    'live-training',
  ],
};

/** Which other features a feature of each category may import (through index.ts only). */
function allowedImports(category) {
  switch (category) {
    case 'core':
      return [];
    case 'personal':
      return [...modules.core];
    case 'social':
      // Social modules use the personal modules' public interface, never the reverse.
      return [...modules.core, 'groups', ...modules.personal];
    default:
      throw new Error(`Unknown module category: ${category}`);
  }
}

const allModules = Object.values(modules).flat();
const featureDirs = readdirSync(new URL('./src/features', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const uncategorised = featureDirs.filter((name) => !allModules.includes(name));
if (uncategorised.length > 0) {
  throw new Error(
    `src/features/${uncategorised.join(', ')} has no module category. ` +
      'Add it to `modules` in eslint.config.js (CLAUDE.md rule 13).',
  );
}

// Escapes regex syntax (ESLint compiles these with the "u" flag, so "-" must stay unescaped).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyOf = (names) => names.map(escapeRegex).join('|');

const supabasePaths = [
  {
    name: '@supabase/supabase-js',
    message: 'Only src/shared/lib/supabase.ts and features/*/api may use Supabase.',
  },
  {
    name: '@/shared/lib/supabase',
    message: 'Components must use hooks from features/<name>/api instead.',
  },
];

const deepImportPattern = {
  regex: '^@/features/[^/]+/.+',
  message: 'Import other features only through their index.ts (@/features/<name>).',
};

function featureImportRule(feature, category, { allowSupabase }) {
  const allowed = [feature, ...allowedImports(category)];
  const forbidden = allModules.filter((name) => !allowed.includes(name));
  const message =
    `"${feature}" is a ${category} module and may not import this feature ` +
    '(CLAUDE.md rules 13–14). Compose features in src/app/ instead.';

  const patterns = [
    deepImportPattern,
    { regex: '^@/app(/|$)', message: 'Features never import from src/app.' },
  ];
  if (forbidden.length > 0) {
    patterns.push(
      { regex: `^@/features/(${anyOf(forbidden)})$`, message },
      // Relative escapes into a sibling feature, e.g. ../../feed or ../../../features/feed
      { regex: `^(\\.\\./)+(features/)?(${anyOf(forbidden)})(/|$)`, message },
    );
  }

  return [
    'error',
    {
      paths: allowSupabase ? [] : supabasePaths,
      patterns,
    },
  ];
}

const boundaryConfigs = Object.entries(modules).flatMap(([category, names]) =>
  names.flatMap((feature) => [
    {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      ignores: [`src/features/${feature}/api/**`],
      rules: {
        'no-restricted-imports': featureImportRule(feature, category, { allowSupabase: false }),
      },
    },
    {
      files: [`src/features/${feature}/api/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': featureImportRule(feature, category, { allowSupabase: true }),
      },
    },
  ]),
);

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      'supabase',
      'tools',
      'src/shared/types/database.ts',
    ],
  },
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
  // src/app composes features (only through index.ts) and never talks to Supabase directly.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: supabasePaths, patterns: [deepImportPattern] }],
    },
  },
  // src/shared holds no feature code and depends on nothing above it.
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/lib/supabase.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: supabasePaths,
          patterns: [
            {
              regex: '^@/(features|app)(/|$)',
              message: 'src/shared must not depend on features or the app.',
            },
          ],
        },
      ],
    },
  },
  ...boundaryConfigs,
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
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
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
