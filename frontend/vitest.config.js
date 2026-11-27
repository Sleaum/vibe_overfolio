// Tests des calculs de src/lib/ (npm test). Config à part de vite.config.ts : les plugins du build (contrôle des
// couleurs et des traductions, Vue) n'ont rien à faire ici, et les tests tournent sous Node, sans navigateur.
// Les tests sont dans tests/ et pas dans src/ : le contrôle des traductions du build lit tout src/.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Mêmes drapeaux que vite.config.ts : sans eux, vue-i18n avertit à chaque import
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
})
