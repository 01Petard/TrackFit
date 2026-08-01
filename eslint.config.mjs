// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['.codex_tmp*/**'],
  },
  {
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      '@stylistic/brace-style': 'off',
      '@stylistic/multiline-ternary': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
)
