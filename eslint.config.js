import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'workers/', '.vercel/', '*.config.*', 'public/sw.js', 'scripts/', 'tmp-publications.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // react-hooks 7 solo publica configs en formato legacy o con todo el conjunto de
  // reglas del React Compiler. Se declaran las dos reglas clásicas para no activar
  // reglas de compilación nuevas sin revisarlas (marcan código existente).
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  reactRefresh.configs.vite,
  prettierConfig,
  {
    // Scripts estáticos servidos al navegador (p. ej. el bootstrap del tema).
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        location: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);