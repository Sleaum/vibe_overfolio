/** @type {import('tailwindcss').Config} */
//
// Jetons de design d'Overfolio : tout le site s'appuie sur ces valeurs.
// Les 8 couleurs des graphiques sont dans src/lib/palette.js (même famille de bleu que l'accent).
//
// Couleur lue dans une variable CSS « R G B », pour garder les opacités de Tailwind (bg-paper/95…)
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  // Mode sombre : classe « dark » sur <html>, posée par index.html et composables/useTheme.js
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      // Chaque couleur vient d'une variable CSS (src/assets/tailwind.css) : valeurs claires dans :root,
      // valeurs sombres dans html.dark. Les contrastes indiqués sont ceux du mode clair.
      colors: {
        // Fond et surfaces
        paper: v('paper'),
        wash: v('wash'),
        // Encre : gris très foncé (jamais de noir pur), contrastes mesurés sur fond blanc
        ink: {
          DEFAULT: v('ink'), // 15,6:1
          2: v('ink-2'),     //  7,7:1  texte secondaire
          3: v('ink-3'),     //  6,0:1  texte discret (légendes, aides)
        },
        // Filets et bordures fines
        line: {
          DEFAULT: v('line'),
          strong: v('line-strong'),
        },
        // Une seule couleur d'accent : le bleu des graphiques, en version foncée pour le texte et les boutons
        accent: {
          DEFAULT: v('accent'), // 6,6:1 sur blanc, blanc sur accent : 6,6:1
          hover: v('accent-hover'),
          wash: v('accent-wash'),
          ring: v('accent-ring'), // anneau de focus (identique au bleu des graphiques)
        },
        // Texte posé sur un fond d'accent (bouton principal) : blanc en clair, encre foncée en sombre
        'on-accent': v('on-accent'),
        // États (toujours accompagnés d'un texte)
        danger: { DEFAULT: v('danger'), wash: v('danger-wash'), line: v('danger-line') },
        success: { DEFAULT: v('success'), wash: v('success-wash'), line: v('success-line') },
      },
      fontFamily: {
        // Inter si elle est installée, sinon la police système : aucun chargement externe
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Échelle typographique (taille, interligne, approche, graisse)
        body: ['1.0625rem', { lineHeight: '1.7' }],                  // 17 px
        lead: ['1.125rem', { lineHeight: '1.7' }],                   // 18 px
        display: ['clamp(2.5rem, 1.7rem + 3.4vw, 4rem)', {
          lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '800',
        }],
        h2: ['clamp(1.75rem, 1.35rem + 1.7vw, 2.5rem)', {
          lineHeight: '1.12', letterSpacing: '-0.025em', fontWeight: '700',
        }],
        h3: ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.012em', fontWeight: '600' }],
      },
      boxShadow: {
        // Ombres très douces
        soft: '0 1px 2px rgba(31, 35, 40, 0.04), 0 8px 24px -12px rgba(31, 35, 40, 0.10)',
        lift: '0 1px 2px rgba(31, 35, 40, 0.05), 0 20px 44px -20px rgba(31, 35, 40, 0.20)',
      },
    },
  },
  plugins: [],
}
