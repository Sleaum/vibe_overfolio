// Formatage "à la française" des montants, pourcentages et dates. Rien que de l'Intl : aucune dépendance.

import { isoToTimestamp, toIsoDate } from './dates.js'

const NBSP = ' '

const euroFormat = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const oneDecimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const percentFormat = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })
const cellInteger = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const cellDecimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 })
const cellSmall = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 8 })

const utc = { timeZone: 'UTC' }
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', ...utc })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', ...utc })
const numericDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', ...utc })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', ...utc })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', ...utc })
const monthYearTiny = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', ...utc })
const dateAndTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** 12345.6 -> "12 346 €" (espaces insécables). */
export function euro(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '–'
  return euroFormat.format(Math.abs(n) < 0.5 ? 0 : n) // évite "-0 €"
}

/** Fraction -> "23,4 %". */
export function percent(fraction) {
  const n = Number(fraction)
  return Number.isFinite(n) ? percentFormat.format(n) : '–'
}

/**
 * Étiquettes d'un axe de montants : en entier sous 10 000 (0 / 2 000 / 4 000 €),
 * en compact au-delà (0 / 10 k€ / 20 k€), un seul style par axe.
 */
export function axisEuroFormatter(maxValue) {
  const compact = Math.abs(Number(maxValue)) >= 10_000
  return (value) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    if (!compact) return euroFormat.format(n)
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${oneDecimal.format(n / 1_000_000)}${NBSP}M€`
    if (abs >= 1_000) return `${oneDecimal.format(n / 1_000)}${NBSP}k€`
    return `${integer.format(n)}${NBSP}€`
  }
}

/** Valeur "AAAA-MM-JJ" ou millisecondes UTC -> Date, ou null. */
function asDate(value) {
  if (typeof value === 'number') return new Date(value)
  const iso = toIsoDate(value)
  return iso ? new Date(isoToTimestamp(iso)) : null
}

// "1 octobre" -> "1er octobre" : usage français pour le premier du mois
const premier = (text) => text.replace(/^1(?=[\s\u00a0])/, '1er')

function withDate(formatter, fallback = '') {
  return (value) => {
    const date = asDate(value)
    return date ? premier(formatter.format(date)) : fallback
  }
}

export const formatDateLong = withDate(longDate)      // 14 novembre 2026
export const formatDateShort = withDate(shortDate)    // 14 nov. 2026
export const formatDateNumeric = withDate(numericDate) // 14/11/2026
export const formatDayMonth = withDate(dayMonth)      // 14 nov.
export const formatMonthYear = withDate(monthYear)    // nov. 2026
export const formatMonthYearTiny = withDate(monthYearTiny) // nov. 26

/** "AAAA-MM" -> "nov. 2026". */
export function formatMonthKey(key) {
  return formatMonthYear(`${key}-01`)
}

/** "AAAA-MM" -> "nov. 26" (étiquette d'axe). */
export function formatMonthKeyTiny(key) {
  return formatMonthYearTiny(`${key}-01`)
}

/** Horodatage ISO (avec fuseau) -> "15 novembre 2026 à 14:32", dans l'heure du navigateur. */
export function formatDateTime(isoDateTime) {
  const date = new Date(isoDateTime)
  return Number.isNaN(date.getTime()) ? '' : premier(dateAndTime.format(date))
}

/** 1 -> "1 ligne", 995 -> "995 lignes". */
export function plural(count, one, many = `${one}s`) {
  return `${integer.format(count)}${NBSP}${count > 1 ? many : one}`
}

/** "public equity" -> "Public equity". */
export function capitalize(text) {
  const s = String(text ?? '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Échappe le HTML : les noms viennent de la feuille, ils vont dans des infobulles HTML. */
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Une cellule du tableau brut : nombres à la française, dates de série lisibles. */
export function formatCell(value, column = '') {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    if (/date/i.test(column)) {
      const iso = toIsoDate(value)
      if (iso) return numericDate.format(new Date(isoToTimestamp(iso)))
    }
    if (Number.isInteger(value)) return cellInteger.format(value)
    return (Math.abs(value) >= 1 ? cellDecimal : cellSmall).format(value)
  }
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  return String(value)
}
