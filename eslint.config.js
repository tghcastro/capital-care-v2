import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Architecture rules (see docs/tech/definitions/architecture.md#architecture-lint-rules).
// Modules that exist or are planned: add a name here when a module is created.
const MODULES = ['ledger', 'identity'];

const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

// Importing a module's internals: a deep package path or a relative path into modules/<name>/.
const internals = (name, message) => [
  {
    group: [`@capital-care/${name}/*`, `**/modules/${name}/*`, `**/modules/${name}/**/*`],
    message,
  },
];

// The whole module, including its index.ts.
const wholeModule = (name, message) => [
  {
    group: [
      `@capital-care/${name}`,
      `@capital-care/${name}/*`,
      `**/modules/${name}`,
      `**/modules/${name}/**`,
      `../**/${name}/src`,
      `../**/${name}/src/**`,
    ],
    message,
  },
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // apps/web only: browser globals, React hooks rules and accessibility rules.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Architecture rule ARCH-3 (AD-008, AD-011): code outside a module imports it only through its
  // index.ts (public package entry), never its internals.
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: restrict(
      MODULES.flatMap((name) =>
        internals(name, `ARCH-3: import @capital-care/${name} (its index.ts), not its internals.`)
      )
    ),
  },
  // Architecture rule ARCH-1 (AD-008, AD-011): a module never imports another module.
  ...MODULES.map((name) => ({
    files: [`modules/${name}/**/*.{ts,tsx}`],
    rules: restrict(
      MODULES.filter((other) => other !== name).flatMap((other) =>
        wholeModule(
          other,
          `ARCH-1: modules never import each other; wire ${other} through a callback in apps/api.`
        )
      )
    ),
  })),
  // Architecture rule ARCH-2 (AD-006, ADR 001): apps/web never imports a module; business rules
  // stay in the API. (Declared last so it replaces ARCH-3 for apps/web; it includes the same ban.)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: restrict(
      MODULES.flatMap((name) =>
        wholeModule(
          name,
          `ARCH-2: apps/web talks to the API over HTTP and never imports modules/${name}.`
        )
      )
    ),
  }
);
