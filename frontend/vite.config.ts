import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { COLORS, STORAGE_KEY } from './src/lib/theme.js'

// Remplace __dirname en mode ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mode clair / sombre : index.html ne contient aucune valeur, elles viennent de src/lib/theme.js.
// - Remplace __THEME_KEY__, __THEME_LIGHT__, __THEME_DARK__ (clé de stockage, couleurs de fond) dans index.html.
// - Signale au démarrage toute couleur écrite en dur dans les fichiers des graphiques (src/lib/**/*.js) :
//   elle ne passerait pas en sombre. Les couleurs viennent de palette.js ; une couleur voulue fixe
//   (texte blanc posé sur une couleur de série…) porte le commentaire « couleur fixe » sur sa ligne.
function theme(): Plugin {
  const values: Record<string, string> = {
    '__THEME_KEY__': STORAGE_KEY,
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

export default defineConfig({
  plugins: [vue(), theme()],
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
