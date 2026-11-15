// Lecture des dates venues de Google Sheets.
// L'API renvoie les dates telles qu'affichées dans la feuille ("2026-11-14", "14/11/2026"…),
// parfois des numéros de série (45 000 = jours depuis le 30/12/1899).
// Tout est converti en "AAAA-MM-JJ" (UTC), jamais en heure locale : pas de décalage d'un jour.

const SERIAL_ORIGIN = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000

const pad = (n) => String(n).padStart(2, '0')

function build(year, month, day) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return ''
  // Écarte les dates impossibles (31/02…)
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCMonth() !== m - 1) return ''
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Valeur de cellule -> "AAAA-MM-JJ", ou "" si ce n'est pas une date reconnaissable. */
export function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return ''

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 20_000 || value > 80_000) return ''
    return new Date(SERIAL_ORIGIN + Math.floor(value) * DAY_MS).toISOString().slice(0, 10)
  }

  const text = String(value).trim()

  // 2026-11-14, 2026/11/14, 2026.11.14 (suivi éventuel d'une heure)
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/)
  if (match) return build(match[1], match[2], match[3])

  // 14/11/2026, 14-11-2026, 14.11.2026
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/)
  if (match) return build(match[3], match[2], match[1])

  return ''
}

/** "AAAA-MM-JJ" -> millisecondes UTC (axe temporel d'ECharts). */
export function isoToTimestamp(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** "AAAA-MM-JJ" -> "AAAA-MM" (regroupement par mois). */
export function monthKey(iso) {
  return iso.slice(0, 7)
}

/** Liste continue des mois entre deux clés "AAAA-MM" incluses. */
export function monthsBetween(firstKey, lastKey) {
  const keys = []
  let [y, m] = firstKey.split('-').map(Number)
  const [endY, endM] = lastKey.split('-').map(Number)
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${pad(m)}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return keys
}
