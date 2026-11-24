// Page « Models » (/modeles) : portefeuilles modèles (lazy portfolios), leurs répartitions, et ta proximité avec chacun.
// Fonctions pures, sauf les couleurs (lues dans les choix de couleurs des types d'actifs, réactifs : à lire dans un computed).
//
// Couleurs : chaque classe d'actifs prend la couleur d'un type d'actif du site (menu « Couleurs des actifs » de Charts),
// en nuances plus foncées ou plus claires pour les sous-classes :
//   actions = public equity · obligations et liquidités = fiat · or et matières premières = commodity ·
//   immobilier = real estate · suivi de tendance et volatilité longue = managed futures.

import { findColumn, rowsOf, splitBy } from './aggregate.js'
import { amountTable } from './amounts.js'
import { ASSET_ORDER, CONTEXT, assignAssetColors, shade } from './palette.js'

/** Familles comparées entre ton portefeuille et les modèles, dans l'ordre d'affichage. */
export const FAMILIES = ['equity', 'defensive', 'real', 'realEstate', 'alternative', 'other']

/** Type d'actif du site qui donne sa couleur à chaque famille (« other » : gris des séries de contexte). */
const FAMILY_TYPE = {
  equity: 'public equity',
  defensive: 'fiat',
  real: 'commodity',
  realEstate: 'real estate',
  alternative: 'managed futures',
}

/** Classes d'actifs des modèles : famille et nuance de la couleur du type (négatif = plus foncé, positif = plus clair). */
export const CLASSES = {
  equity: { family: 'equity', shade: 0 },
  equityValue: { family: 'equity', shade: -0.25 },
  smallValue: { family: 'equity', shade: -0.5 },
  equityIntl: { family: 'equity', shade: 0.4 },
  emerging: { family: 'equity', shade: 0.65 },
  bondsLong: { family: 'defensive', shade: -0.5 },
  bondsMid: { family: 'defensive', shade: -0.25 },
  cash: { family: 'defensive', shade: 0 },
  bondsIndexed: { family: 'defensive', shade: 0.45 },
  gold: { family: 'real', shade: -0.2 },
  commodities: { family: 'real', shade: 0.4 },
  realEstate: { family: 'realEstate', shade: 0 },
  trend: { family: 'alternative', shade: 0 },
  longVol: { family: 'alternative', shade: 0.45 },
}

/** Ordre de la légende : classes regroupées par famille. */
export const LEGEND = [
  { family: 'equity', classes: ['equity', 'equityValue', 'smallValue', 'equityIntl', 'emerging'] },
  { family: 'defensive', classes: ['bondsLong', 'bondsMid', 'bondsIndexed', 'cash'] },
  { family: 'real', classes: ['gold', 'commodities', 'realEstate', 'trend', 'longVol'] },
]

/** Familles des filtres de la page (colonnes à droite du tableau). */
export const STYLES = ['seasons', 'balanced', 'index', 'active']

const wiki = (en, fr) => ({ en: `https://en.wikipedia.org/wiki/${en}`, fr: fr ? `https://fr.wikipedia.org/wiki/${fr}` : null })

/**
 * Les portefeuilles modèles. `key` sert aux textes traduits (modelsPage.models.<key>.goal / detail / note).
 * `allocation` : [classe, pourcentage, libellé particulier (modelsPage.slices.<clé>) facultatif].
 * Les noms des portefeuilles et des personnes ne se traduisent pas. Liens Wikipédia : français s'il existe, sinon anglais.
 */
export const MODELS = [
  {
    key: 'allWeather',
    name: 'All Weather',
    group: 'seasons',
    styles: ['seasons', 'index'],
    people: [
      { name: 'Ray Dalio', url: wiki('Ray_Dalio', 'Ray_Dalio') },
      { name: 'Tony Robbins', url: wiki('Tony_Robbins', 'Tony_Robbins') },
    ],
    allocation: [['equity', 30], ['bondsLong', 40], ['bondsMid', 15], ['gold', 7.5], ['commodities', 7.5]],
  },
  {
    key: 'permanent',
    name: 'Permanent Portfolio',
    group: 'seasons',
    styles: ['seasons', 'index'],
    people: [{ name: 'Harry Browne', url: wiki('Harry_Browne') }],
    allocation: [['equity', 25], ['bondsLong', 25], ['cash', 25], ['gold', 25]],
  },
  {
    key: 'goldenButterfly',
    name: 'Golden Butterfly',
    group: 'seasons',
    styles: ['seasons', 'index'],
    people: [{ name: 'Tyler', url: { en: 'https://portfoliocharts.com/', fr: null } }],
    allocation: [['equity', 20], ['smallValue', 20], ['bondsLong', 20], ['cash', 20, 'shortBonds'], ['gold', 20]],
  },
  {
    key: 'dragon',
    name: 'Dragon Portfolio',
    group: 'seasons',
    styles: ['seasons', 'active'],
    people: [{ name: 'Christopher Cole' }],
    allocation: [['equity', 24], ['bondsMid', 18, 'bonds'], ['gold', 19], ['trend', 18], ['longVol', 21]],
  },
  {
    key: 'sixtyForty',
    name: '60/40',
    group: 'classic',
    styles: ['balanced', 'index'],
    people: [],
    allocation: [['equity', 60], ['bondsMid', 40, 'bonds']],
  },
  {
    key: 'threeFund',
    name: 'Three-Fund',
    group: 'classic',
    styles: ['balanced', 'index'],
    people: [{ name: 'Taylor Larimore' }, { name: 'John Bogle', url: wiki('John_C._Bogle', 'John_C._Bogle') }],
    allocation: [['equity', 64, 'usEquity'], ['equityIntl', 16], ['bondsMid', 20, 'bonds']],
  },
  {
    key: 'buffett',
    name: 'Buffett 90/10',
    group: 'classic',
    styles: ['index'],
    people: [{ name: 'Warren Buffett', url: wiki('Warren_Buffett', 'Warren_Buffett') }],
    allocation: [['equity', 90, 'sp500'], ['cash', 10, 'shortBonds']],
  },
  {
    key: 'swensen',
    name: 'Swensen',
    group: 'classic',
    styles: ['balanced', 'index'],
    people: [{ name: 'David Swensen', url: wiki('David_Swensen') }],
    allocation: [
      ['equity', 30, 'usEquity'],
      ['equityIntl', 15, 'developed'],
      ['emerging', 5],
      ['realEstate', 20],
      ['bondsMid', 15, 'treasuries'],
      ['bondsIndexed', 15],
    ],
  },
  {
    key: 'coffeehouse',
    name: 'Coffeehouse',
    group: 'classic',
    styles: ['balanced', 'index'],
    people: [{ name: 'Bill Schultheis' }],
    allocation: [
      ['equity', 10, 'largeCap'],
      ['equityValue', 10, 'largeValue'],
      ['equityValue', 10, 'smallCap'],
      ['smallValue', 10],
      ['equityIntl', 10],
      ['realEstate', 10],
      ['bondsMid', 40, 'bonds'],
    ],
  },
  {
    key: 'ivy',
    name: 'Ivy Portfolio',
    group: 'classic',
    styles: ['index'],
    people: [{ name: 'Mebane Faber' }],
    allocation: [['equity', 20, 'usEquity'], ['equityIntl', 20], ['bondsMid', 20], ['commodities', 20], ['realEstate', 20]],
  },
  {
    key: 'larry',
    name: 'Larry Portfolio',
    group: 'classic',
    styles: ['balanced', 'index'],
    people: [{ name: 'Larry Swedroe' }],
    allocation: [['smallValue', 15, 'usSmallValue'], ['smallValue', 7.5, 'intlSmallValue'], ['emerging', 7.5, 'emergingValue'], ['bondsMid', 70, 'treasuries']],
  },
]

/** Groupes de la page, dans l'ordre. */
export const GROUPS = ['seasons', 'classic']

/** Lien d'une personne dans la langue du site : page française si elle existe, sinon anglaise ; null sans page. */
export function personUrl(person, locale) {
  if (!person.url) return null
  return (locale === 'fr' && person.url.fr) || person.url.en
}

/**
 * Couleurs des familles et des classes, d'après les couleurs choisies pour les types d'actifs.
 * Réactif (assetColorChoices) : à appeler dans un computed.
 */
export function modelColors() {
  const { colors } = assignAssetColors(ASSET_ORDER)
  const family = Object.fromEntries(
    FAMILIES.map((key) => [key, FAMILY_TYPE[key] ? colors.get(FAMILY_TYPE[key])?.color ?? CONTEXT : CONTEXT]),
  )
  const classes = Object.fromEntries(Object.entries(CLASSES).map(([key, c]) => [key, shade(family[c.family], c.shade)]))
  return { family, classes }
}

/** Répartition d'un modèle par famille : { equity: 0.3, defensive: 0.55, … } (fractions). */
export function familyShares(model) {
  const shares = Object.fromEntries(FAMILIES.map((key) => [key, 0]))
  for (const [cls, value] of model.allocation) shares[CLASSES[cls].family] += value / 100
  return shares
}

/** Famille d'un type d'actif du site (public equity, fiat…) ; une valeur inconnue va dans « other ». */
export function familyOfType(name) {
  const key = String(name ?? '').trim().toLowerCase()
  if (key === 'public equity' || key === 'equity' || key === 'stock' || key === 'action' || key === 'actions') return 'equity'
  if (key === 'fiat' || key === 'cash' || /bond|oblig/.test(key)) return 'defensive'
  if (key === 'commodity' || key === 'gold' || key === 'or') return 'real'
  if (key === 'real estate' || key === 'immobilier') return 'realEstate'
  if (key === 'managed futures') return 'alternative'
  return 'other'
}

/**
 * Ton patrimoine (table portfolio, actifs bruts) : { types: [{ name, value }], total, shares: { famille: fraction } },
 * ou null si la table n'a pas les colonnes Asset et Assets Master Currency, ou rien de positif.
 */
export function userAllocation(portfolio) {
  if (!portfolio) return null
  const asset = findColumn(portfolio.columns, ['Asset'])
  const value = findColumn(portfolio.columns, ['Assets Master Currency'])
  if (!asset || !value) return null
  const { entries, total } = splitBy(rowsOf(amountTable(portfolio, 'gross')), asset, value)
  if (!entries.length || !(total > 0)) return null
  const shares = Object.fromEntries(FAMILIES.map((key) => [key, 0]))
  for (const entry of entries) shares[familyOfType(entry.name)] += entry.value / total
  return { types: entries, total, shares }
}

/**
 * Écart entre deux répartitions par famille, en points de pourcentage : la part qu'il faudrait déplacer
 * pour passer de l'une à l'autre (0 = identiques, 100 = rien en commun).
 */
export function gap(a, b) {
  return (FAMILIES.reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / 2) * 100
}

/** Modèles du plus proche au plus éloigné de `shares` : [{ model, gap }]. */
export function closestModels(shares) {
  return MODELS.map((model) => ({ model, gap: gap(shares, familyShares(model)) })).sort((x, y) => x.gap - y.gap)
}
