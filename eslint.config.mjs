import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Why: Both the JS and the TS blocks enforce the same AGENTS.md rules (JSDoc on functions, no
// rendered err.message), so they are defined once.
const sharedRules = {
  // Why: AGENTS.md requires JSDoc on every function, hook and component.
  'jsdoc/require-jsdoc': [
    'error',
    {
      publicOnly: false,
      require: {
        FunctionDeclaration: true,
        ClassDeclaration: true,
        MethodDefinition: true,
        ArrowFunctionExpression: false,
      },
      contexts: ['VariableDeclaration > VariableDeclarator > ArrowFunctionExpression'],
      checkConstructors: false,
    },
  ],
  // Why: AGENTS.md bans rendering raw error text; route errors through toUserMessage().
  'no-restricted-syntax': [
    'error',
    {
      selector:
        "JSXExpressionContainer MemberExpression[property.name='message'][object.name=/^(err|error|e)$/]",
      message: 'Never render err.message. Use toUserMessage(err, fallback).',
    },
  ],
};

export default [
  {
    ignores: [
      '.next',
      'out',
      'coverage',
      'node_modules',
      'public',
      '.agents',
      '.claude',
      '.playwright-mcp',
      '.playwright-ui-review',
      'MXTRADE_TEST',
      'src/lib/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, process: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, jsdoc },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Why: Existing pages load data by calling setState in mount effects; moving that to
      // TanStack Query is the planned fix, so it is reported as a warning until then.
      'react-hooks/set-state-in-effect': 'warn',
      ...sharedRules,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, process: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, jsdoc },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      ...sharedRules,
    },
  },
  {
    files: ['*.config.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', 'src/test/**', '*.config.{js,mjs}'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/globals': 'off',
    },
  },
  prettier,
];
