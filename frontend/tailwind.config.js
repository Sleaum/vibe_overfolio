/** @type {import('tailwindcss').Config} */
//
// Jetons de design d'Overfolio : tout le site s'appuie sur ces valeurs.
// Les 8 couleurs des graphiques sont dans src/lib/palette.js (même famille de bleu que l'accent).
//
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Fond et surfaces
        paper: '#ffffff',
        wash: '#f6f7f8',
        // Encre : gris très foncé (jamais de noir pur), contrastes mesurés sur fond blanc
        ink: {
          DEFAULT: '#1f2328', // 15,6:1
          2: '#4b5159',       //  7,7:1  texte secondaire
          3: '#5d646c',       //  6,0:1  texte discret (légendes, aides)
        },
        // Filets et bordures fines
        line: {
          DEFAULT: '#e4e6e9',
          strong: '#cfd3d8',
        },
        // Une seule couleur d'accent : le bleu des graphiques, en version foncée pour le texte et les boutons
        accent: {
          DEFAULT: '#1c5cab', // 6,6:1 sur blanc, blanc sur accent : 6,6:1
          hover: '#184f95',
          wash: '#eef4fc',
          ring: '#2a78d6',    // anneau de focus (identique au bleu des graphiques)
        },
        // États (toujours accompagnés d'un texte)
        danger: { DEFAULT: '#b42318', wash: '#fef3f2', line: '#fecdca' },
        success: { DEFAULT: '#067647', wash: '#ecfdf3', line: '#abefc6' },
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
