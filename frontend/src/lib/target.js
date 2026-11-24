// Page Models > Target (/modeles/target) : ta répartition cible à une date, l'écart avec aujourd'hui, et le plan
// d'actions année par année pour l'atteindre. Fonctions pures (testables sans navigateur), sauf les couleurs.
//
// Deux façons de régler la cible (`basis`) :
// - 'types'   : tes types d'actifs (colonne Asset : public equity, fiat…), comparés directement à ta feuille ;
// - 'classes' : les classes d'actifs des modèles (lib/models.js : actions, obligations longues, or…) ; ta feuille y est
//               rangée par type, et pour commodity par sous-type (gold → or, le reste → matières premières).
//
// Plan (« versements puis ventes ») : chaque année, les versements de l'année (12 × le versement mensuel) vont d'abord
// aux catégories en dessous de leur cible, au prorata de ce qui leur manque ; s'il en reste, il est réparti selon la
// cible. Rien n'est vendu avant la dernière année ; si la cible n'est pas atteinte à ce moment-là, le plan vend ce qui
// dépasse et rachète ce qui manque. Hypothèse simple : pas de rendement, montants d'aujourd'hui (dans la devise d'affichage).

import { findColumn, rowsOf, toLabel, toNumber } from './aggregate.js'
import { amountTable } from './amounts.js'
import { CLASSES } from './models.js'
import { ASSET_ORDER } from './palette.js'

export const DEFAULT_YEAR = 2040
export const BASES = ['types', 'classes']

/** Catégorie « autres » du mode classes : ce qui n'entre dans aucune classe (crypto, objets…). */
export const OTHER = 'other'

/** Écart toléré, en points de pourcentage, pour dire qu'une cible est atteinte. */
export const TOLERANCE = 0.5

const keyOf = (name) => String(name ?? '').trim().toLowerCase()

/** Classe des modèles d'une ligne de la feuille, d'après son type d'actif (et son sous-type pour commodity). */
export function classOfRow(type, subType = '') {
  const key = keyOf(type)
  const sub = keyOf(subType)
  if (key === 'public equity' || key === 'equity' || key === 'stock' || key === 'action' || key === 'actions') return 'equity'
  if (/bond|oblig/.test(key)) return 'bondsMid'
  if (key === 'fiat' || key === 'cash') return 'cash'
  if (key === 'commodity' || key === 'gold' || key === 'or') return key === 'commodity' && !/gold|\bor\b/.test(sub) ? 'commodities' : 'gold'
  if (key === 'real estate' || key === 'immobilier') return 'realEstate'
  if (key === 'managed futures') return 'trend'
  return OTHER
}

/**
 * Ton patrimoine d'aujourd'hui par catégorie : { amounts: { catégorie: montant }, total, names: { catégorie: libellé } },
 * ou null (pas de table, colonnes Asset / Assets Master Currency absentes, rien de positif).
 * `mode` : 'gross' ou 'net' (bouton Brut / Net) ; en net, une catégorie négative compte pour 0.
 */
export function currentAmounts(portfolio, basis, mode = 'gross') {
  if (!portfolio) return null
  const asset = findColumn(portfolio.columns, ['Asset'])
  const value = findColumn(portfolio.columns, ['Assets Master Currency'])
  if (!asset || !value) return null
  const sub = findColumn(portfolio.columns, ['Sub Asset', 'Sub-Asset', 'SubAsset', 'Sous-type', 'Sous type'])
  const amounts = {}
  const names = {}
  for (const row of rowsOf(amountTable(portfolio, mode))) {
    const amount = toNumber(row[value])
    if (!amount) continue
    const label = toLabel(row[asset], '')
    if (!label) continue
    const key = basis === 'classes' ? classOfRow(label, sub ? row[sub] : '') : keyOf(label)
    names[key] ??= label
    amounts[key] = (amounts[key] ?? 0) + amount
  }
  for (const key of Object.keys(amounts)) if (amounts[key] < 0) amounts[key] = 0
  const total = Object.values(amounts).reduce((sum, v) => sum + v, 0)
  return total > 0 ? { amounts, total, names } : null
}

/**
 * Catégories proposées : en mode types, les types habituels du site puis ceux de ta feuille ; en mode classes,
 * les classes des modèles puis « autres ». `held` : catégories présentes dans ta feuille.
 */
export function categories(basis, held = []) {
  if (basis === 'classes') return [...Object.keys(CLASSES), OTHER]
  const known = ASSET_ORDER.filter((name) => name !== 'depreciating')
  return [...known, ...held.filter((key) => !known.includes(key))]
}

/** Somme des pourcentages de la cible. */
export const targetSum = (shares) => Object.values(shares ?? {}).reduce((sum, v) => sum + (Number(v) || 0), 0)

/** Part de chaque catégorie dans des montants : { catégorie: fraction }. */
export function sharesOf(amounts) {
  const total = Object.values(amounts).reduce((sum, v) => sum + v, 0)
  return Object.fromEntries(Object.entries(amounts).map(([key, v]) => [key, total > 0 ? v / total : 0]))
}

/** Plus grand écart entre des montants et la cible, en points de pourcentage. */
export function maxGap(amounts, target, keys) {
  const shares = sharesOf(amounts)
  return Math.max(0, ...keys.map((key) => Math.abs((shares[key] ?? 0) * 100 - (target[key] ?? 0))))
}

/**
 * Plan année par année, de `fromYear` + 1 à `toYear`.
 * @param amounts  montants d'aujourd'hui par catégorie
 * @param target   pourcentages visés par catégorie (somme = 100)
 * @param monthly  versement mensuel (0 ou plus)
 * Renvoie { steps: [{ year, buys, sells, total, gap }], reachedYear, final } : achats et ventes par catégorie,
 * total après l'année, plus grand écart à la cible ; `reachedYear` : première année où la cible est atteinte
 * (à TOLERANCE près) grâce aux seuls versements, sinon null ; `final` : montants à la date cible.
 */
export function buildPlan({ amounts, target, monthly, fromYear, toYear }) {
  const keys = [...new Set([...Object.keys(amounts), ...Object.keys(target)])]
  const current = Object.fromEntries(keys.map((key) => [key, amounts[key] ?? 0]))
  const steps = []
  let reachedYear = maxGap(current, target, keys) <= TOLERANCE ? fromYear : null
  const yearly = Math.max(0, Number(monthly) || 0) * 12

  for (let year = fromYear + 1; year <= toYear; year++) {
    const buys = {}
    const sells = {}
    const total = keys.reduce((sum, key) => sum + current[key], 0) + yearly
    const wanted = (key) => ((target[key] ?? 0) / 100) * total

    // 1. Versements de l'année : d'abord ce qui manque, au prorata ; le reste selon la cible
    if (yearly > 0) {
      const missing = Object.fromEntries(keys.map((key) => [key, Math.max(0, wanted(key) - current[key])]))
      const need = Object.values(missing).reduce((sum, v) => sum + v, 0)
      const toMissing = Math.min(yearly, need)
      const rest = yearly - toMissing
      for (const key of keys) {
        const amount = (need > 0 ? (missing[key] / need) * toMissing : 0) + ((target[key] ?? 0) / 100) * rest
        if (amount > 0.005) {
          buys[key] = amount
          current[key] += amount
        }
      }
    }

    // 2. Dernière année : si les versements n'ont pas suffi, vendre ce qui dépasse et racheter ce qui manque
    if (year === toYear && maxGap(current, target, keys) > TOLERANCE) {
      for (const key of keys) {
        const diff = wanted(key) - current[key]
        if (diff > 0.005) buys[key] = (buys[key] ?? 0) + diff
        if (diff < -0.005) sells[key] = -diff
        current[key] = wanted(key)
      }
    }

    const gap = maxGap(current, target, keys)
    if (reachedYear === null && !Object.keys(sells).length && gap <= TOLERANCE) reachedYear = year
    steps.push({ year, buys, sells, total, gap })
  }
  return { steps, reachedYear, final: { ...current } }
}
