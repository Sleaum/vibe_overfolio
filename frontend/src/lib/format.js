// Formatage des montants, pourcentages et dates, dans la langue active (i18n/index.js). Rien que de l'Intl.
// Les formateurs sont créés à la demande pour chaque langue, puis gardés. Comme ils lisent la langue active,
// un graphique ou un calcul qui les appelle est refait automatiquement au changement de langue.

import { intlLocale, locale, t } from '../i18n/index.js'
import { isoToTimestamp, toIsoDate } from './dates.js'

const NBSP = '\u00a0'

const cache = new Map()
/** Formateur Intl de la langue active, pour un réglage donné (créé une fois par langue). */
function intl(Kind, name, options) {
  const tag = intlLocale()
  const key = `${tag}|${name}`
  if (!cache.has(key)) cache.set(key, new Kind(tag, options))
  return cache.get(key)
}
const number = (name, options) => intl(Intl.NumberFormat, name, options)
const date = (name, options) => intl(Intl.DateTimeFormat, name, { timeZone: 'UTC', ...options })

const euroFormat = () => number('euro', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euroCompact = () =>
  number('euroCompact', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
const oneDecimal = () => number('oneDecimal', { maximumFractionDigits: 1 })
const integer = () => number('integer', { maximumFractionDigits: 0 })
const percentFormat = () => number('percent', { style: 'percent', maximumFractionDigits: 1 })
const percentTwo = () => number('percentTwo', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cellDecimal = () => number('cellDecimal', { maximumFractionDigits: 4 })
const cellSmall = () => number('cellSmall', { maximumFractionDigits: 8 })

const longDate = () => date('long', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = () => date('short', { day: 'numeric', month: 'short', year: 'numeric' })
const numericDate = () => date('numeric', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dayMonth = () => date('dayMonth', { day: 'numeric', month: 'short' })
const monthYear = () => date('monthYear', { month: 'short', year: 'numeric' })
const monthYearTiny = () => date('monthYearTiny', { month: 'short', year: '2-digit' })
// Heure du navigateur (pas UTC) : c'est l'heure de la synchronisation
const dateAndTime = () => intl(Intl.DateTimeFormat, 'dateAndTime', { dateStyle: 'long', timeStyle: 'short' })

/** 12345.6 -> "12 346 €" (espaces insécables). */
export function euro(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '–'
  return euroFormat().format(Math.abs(n) < 0.5 ? 0 : n) // évite "-0 €"
}

/** 12345 -> "12 345 CHF" / "12 345 $US" selon la devise ; devise inconnue : le code après le nombre. */
export function money(value, code) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '–'
  let format = null
  try {
    format = number(`money-${code}`, { style: 'currency', currency: code, maximumFractionDigits: 0 })
  } catch {
    format = null // code de devise inconnu d'Intl
  }
  const rounded = Math.abs(n) < 0.5 ? 0 : n
  return format ? format.format(rounded) : `${Math.round(rounded)} ${code}`
}

/** Étiquette d'axe sans symbole monétaire : 150000 -> "150 k". */
export function compactNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? number('compact', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : ''
}

/** Fraction -> "23,4 %". */
export function percent(fraction) {
  const n = Number(fraction)
  return Number.isFinite(n) ? percentFormat().format(n) : '–'
}

/** Graduation d'axe déjà en points de pourcentage : 20 -> "20 %" (français), "20%" (anglais)… */
export function axisPercent(points) {
  const n = Number(points)
  return Number.isFinite(n) ? number('axisPercent', { style: 'percent', maximumFractionDigits: 1 }).format(n / 100) : ''
}

/** Fraction -> "23,45 %" (deux décimales). */
export function percentPrecise(fraction) {
  const n = Number(fraction)
  return Number.isFinite(n) ? percentTwo().format(n) : '–'
}

/** 5000 -> "5 000" (séparateurs de la langue active). */
export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? integer().format(n) : '–'
}

/**
 * Étiquettes d'un axe de montants : en entier sous 10 000 (0 / 2 000 / 4 000 €),
 * en compact au-delà (0 / 10 k€ / 20 k€ ; €10K en anglais), un seul style par axe.
 */
export function axisEuroFormatter(maxValue) {
  const compact = Math.abs(Number(maxValue)) >= 10_000
  return (value) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    if (!compact) return euroFormat().format(n)
    // Français : écriture habituelle « 12,5 k€ » ; autres langues : forme compacte d'Intl
    if (locale.value !== 'fr') return euroCompact().format(n)
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${oneDecimal().format(n / 1_000_000)}${NBSP}M€`
    if (abs >= 1_000) return `${oneDecimal().format(n / 1_000)}${NBSP}k€`
    return `${integer().format(n)}${NBSP}€`
  }
}

/** Valeur "AAAA-MM-JJ" ou millisecondes UTC -> Date, ou null. */
function asDate(value) {
  if (typeof value === 'number') return new Date(value)
  const iso = toIsoDate(value)
  return iso ? new Date(isoToTimestamp(iso)) : null
}

// "1 octobre" -> "1er octobre" : usage français pour le premier du mois (seulement en français)
const premier = (text) => (locale.value === 'fr' ? text.replace(/^1(?=[\s\u00a0])/, '1er') : text)

function withDate(formatter, fallback = '') {
  return (value) => {
    const when = asDate(value)
    return when ? premier(formatter().format(when)) : fallback
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
  return Number.isNaN(date.getTime()) ? '' : premier(dateAndTime().format(date))
}

/** "public equity" -> "Public equity". */
/** Nom d'un pays dans la langue active, d'après son code ISO à 2 lettres (« US » -> « États-Unis »). */
export function countryName(code) {
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

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

/** Une cellule du tableau brut : nombres dans la langue active, dates de série lisibles. */
export function formatCell(value, column = '') {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    if (/date/i.test(column)) {
      const iso = toIsoDate(value)
      if (iso) return numericDate().format(new Date(isoToTimestamp(iso)))
    }
    if (Number.isInteger(value)) return integer().format(value)
    return (Math.abs(value) >= 1 ? cellDecimal() : cellSmall()).format(value)
  }
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  return String(value)
}
