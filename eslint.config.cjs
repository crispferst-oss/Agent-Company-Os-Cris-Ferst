const js = require('@eslint/js');
const parser = require('@typescript-eslint/parser');
module.exports = [{ ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'] }, {
  files: ['**/*.ts'],
  languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' },
  rules: { ...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off' },
}];
