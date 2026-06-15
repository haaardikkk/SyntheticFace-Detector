export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window:       'readonly',
        document:     'readonly',
        console:      'readonly',
        setTimeout:   'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame:  'readonly',
        cancelAnimationFrame:   'readonly',
        performance:  'readonly',
        navigator:    'readonly',
        URL:          'readonly',
        File:         'readonly',
        FileReader:   'readonly',
        FormData:     'readonly',
        fetch:        'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-undef':        'error',
    },
  },
];
