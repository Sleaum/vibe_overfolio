import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { COLORS } from './src/lib/theme.js'
import { PREFERENCES } from './src/lib/preferences.js'

// Remplace __dirname en mode ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mode clair / sombre : index.html ne contient aucune valeur, elles viennent de src/lib/theme.js et src/lib/preferences.js.
// - Remplace __THEME_KEY__, __THEME_LIGHT__, __THEME_DARK__ (clé de stockage, couleurs de fond) dans index.html.
// - Signale au démarrage toute couleur écrite en dur dans les fichiers des graphiques (src/lib/**/*.js) :
//   elle ne passerait pas en sombre. Les couleurs viennent de palette.js ; une couleur voulue fixe
//   (texte blanc posé sur une couleur de série…) porte le commentaire « couleur fixe » sur sa ligne.
function theme(): Plugin {
  const values: Record<string, string> = {
    '__THEME_KEY__': PREFERENCES.theme,
    '__THEME_LIGHT__': COLORS.paper.light,
    '__THEME_DARK__': COLORS.paper.dark,
  }
  const SKIP = new Set(['theme.js', 'palette.js'])
  const LITERAL = /['"](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"]/

  function checkColors(warn: (message: string) => void) {
    const dir = path.resolve(__dirname, 'src/lib')
    const files = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.js'))
    for (const file of files) {
      if (SKIP.has(path.basename(file))) continue
      fs.readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (LITERAL.test(line) && !line.includes('couleur fixe')) {
            warn(`Couleur en dur dans src/lib/${file}:${i + 1} : passer par palette.js (ou commenter « couleur fixe »)`)
          }
        })
    }
  }

  return {
    name: 'theme-clair-sombre',
    buildStart() {
      checkColors((message) => this.warn(message))
    },
    transformIndexHtml(html) {
      return Object.entries(values).reduce((out, [key, value]) => out.split(key).join(value), html)
    },
  }
}

// Langues : les fichiers src/i18n/*.json doivent avoir exactement les mêmes clés. Au build, une clé présente
// dans une langue et absente d'une autre arrête le build (elle s'afficherait en français par défaut).
function languages(): Plugin {
  const dir = path.resolve(__dirname, 'src/i18n')
  const keysOf = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
      : [prefix]

  return {
    name: 'langues',
    buildStart() {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
      const keys = new Map(files.map((f) => [f, new Set(keysOf(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))))]))
      const all = new Set([...keys.values()].flatMap((set) => [...set]))
      const problems = files.flatMap((f) => [...all].filter((key) => !keys.get(f)!.has(key)).map((key) => `${f} : clé manquante « ${key} »`))
      if (problems.length) this.error(`Traductions incomplètes :\n${problems.join('\n')}`)
    },
  }
}

export default defineConfig({
  plugins: [vue(), theme(), languages()],
  // vue-i18n : API Composition seulement, pas d'outils de développement en production
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  resolve: {               
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',       
    port: 5173,
    // Configuration du proxy pour éviter les erreurs CORS
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // Votre serveur Django
        changeOrigin: true,
        secure: false
      }
    }
  } 
})
