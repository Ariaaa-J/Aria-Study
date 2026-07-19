import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // Browser APIs
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        MutationObserver: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        Audio: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        speechSynthesis: 'readonly',
        SpeechRecognition: 'readonly',
        webkitSpeechRecognition: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        navigator: 'readonly',
        encodeURIComponent: 'readonly',

        // Cross-file globals (loaded via <script> tags)
        STORAGE: 'readonly',
        KNOWLEDGE: 'readonly',
        ENGLISH: 'readonly',
        APP: 'readonly',
        marked: 'readonly',
        showToast: 'writable',
        showModal: 'writable',
        closeModal: 'writable',
        exportData: 'writable',
        importData: 'writable',
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'error',
      'no-warning-comments': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': ['warn', {
        args: 'none',
        vars: 'local',
        caughtErrors: 'none',
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-assignment': 'off',
      'no-useless-escape': 'warn',
    },
    ignores: ['node_modules/', '.venv/'],
  },
];
