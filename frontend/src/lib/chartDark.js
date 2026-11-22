// Passe une option ECharts construite en clair au mode sombre, en remplaçant les couleurs de DARK (lib/palette.js).
// Les chaînes sont traitées partout (y compris le HTML des infobulles), et les fonctions (formatter, couleur calculée…)
// sont enveloppées pour que leur résultat soit converti au moment où ECharts les appelle.
// Seuls les objets et tableaux simples sont copiés : dates, dégradés ECharts, etc. sont laissés tels quels.

import { DARK } from './palette.js'

const PAIRS = Object.entries(DARK)

function darkString(text) {
  if (DARK[text]) return DARK[text]
  if (!text.includes('#') && !text.includes('rgba')) return text
  let out = text
  for (const [light, dark] of PAIRS) out = out.split(light).join(dark)
  return out
}

export function toDark(value) {
  if (typeof value === 'string') return darkString(value)
  if (typeof value === 'function') {
    return function (...args) {
      return toDark(value.apply(this, args))
    }
  }
  if (Array.isArray(value)) return value.map(toDark)
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {}
    for (const key of Object.keys(value)) out[key] = toDark(value[key])
    return out
  }
  return value
}
