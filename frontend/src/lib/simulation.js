// Simulation de Monte-Carlo du patrimoine (page /simulation). Fonctions pures : testables sans navigateur.
//
// Modèle, mois par mois, pour chaque tirage :
// - chaque type d'actif a un rendement annuel attendu (mu) et une volatilité (sigma) ; le rendement d'un mois est
//   log-normal : exp(m + s·z) - 1, avec m et s tirés de mu et sigma, si bien que le rendement annuel moyen vaut bien mu ;
// - z mélange un choc « marché » commun à tous les actifs et un choc propre à l'actif : la corrélation entre deux actifs
//   vaut rho_i × rho_j (modèle à un facteur, toujours cohérent quel que soit le nombre d'actifs) ;
// - les chocs suivent une loi de Student à 5 degrés de liberté, ramenée à une variance de 1 : les krachs sont plus
//   fréquents qu'avec une loi normale ;
// - le versement mensuel est réparti entre les actifs « investissables » selon leurs poids actuels ;
// - les frais annuels sont prélevés chaque mois sur les actifs financiers (pas sur l'immobilier ni sur les biens) ;
// - la dette baisse du remboursement mensuel de capital jusqu'à zéro ; patrimoine net = actifs - dette.
// Pas de rééquilibrage, pas d'impôt à la sortie : ce sont des limites assumées et écrites sur la page.

import { buildInOut, findColumn, latestDate, requireColumns, rowsOf, toLabel, toNumber } from './aggregate.js'
import { displayCurrency } from './displayCurrency.js'
import { splitGoals } from './charts/flowTrend.js'
import { findCurrencyColumn } from './charts/flowData.js'

/** Hypothèses par défaut, par type d'actif (rendement et volatilité annuels, corrélation au marché actions). */
export const DEFAULT_ASSUMPTIONS = {
  'public equity': { mu: 0.07, sigma: 0.16, rho: 0.95, invest: true, fees: true },
  crypto: { mu: 0.12, sigma: 0.65, rho: 0.45, invest: true, fees: true },
  'real estate': { mu: 0.025, sigma: 0.06, rho: 0.2, invest: false, fees: false },
  fiat: { mu: 0.02, sigma: 0.005, rho: 0, invest: true, fees: false },
  commodity: { mu: 0.04, sigma: 0.15, rho: 0.1, invest: true, fees: true },
  'managed futures': { mu: 0.04, sigma: 0.12, rho: -0.2, invest: true, fees: true },
  depreciating: { mu: -0.15, sigma: 0.05, rho: 0, invest: false, fees: false },
  exotic: { mu: 0.02, sigma: 0.1, rho: 0, invest: false, fees: false },
}
const FALLBACK = { mu: 0.03, sigma: 0.1, rho: 0.3, invest: true, fees: true }

export const assumptionFor = (asset) => ({ ...(DEFAULT_ASSUMPTIONS[String(asset).trim().toLowerCase()] ?? FALLBACK) })

/* ---------- Lecture des tables ---------- */

/** Patrimoine actuel par type d'actif et dette, depuis `portfolio` (toutes ses lignes ; date = la plus récente). */
export function readPortfolio(table) {
  const cols = requireColumns(table, { asset: ['Asset'], value: ['Assets Master Currency'] })
  const liabilities = findColumn(table.columns, ['Liabilities Master Currency'])
  const dateColumn = findColumn(table.columns, ['Date'])
  const rows = rowsOf(table)
  // Toutes les lignes : selon la place de cotation, une même photo peut porter plusieurs dates (voir envelopes.js)
  const date = dateColumn ? latestDate(rows, dateColumn) : ''

  const assets = new Map()
  let debt = 0
  for (const row of rows) {
    const value = toNumber(row[cols.value])
    if (value > 0) {
      const name = toLabel(row[cols.asset]).toLowerCase()
      assets.set(name, (assets.get(name) ?? 0) + value)
    }
    if (liabilities) debt += Math.abs(Math.min(0, toNumber(row[liabilities])))
  }
  return {
    date,
    assets: [...assets.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    debt,
  }
}

/** Versement net moyen des 12 derniers mois complets de `inout` (entrées - sorties - impôts), ou null. */
export function averageContribution(table, today = new Date().toISOString().slice(0, 10)) {
  if (!table) return null
  const cols = requireColumns(table, { date: ['date', 'mois', 'month'], inflow: ['in', 'entree', 'entrees'], outflow: ['out', 'sortie', 'sorties'] })
  const tax = findColumn(table.columns, ['tax', 'taxe', 'taxes', 'impot', 'impots'])
  const current = today.slice(0, 7)
  const months = buildInOut(rowsOf(table), { ...cols, tax }).filter((month) => month.key < current).slice(-12)
  if (!months.length) return null
  return months.reduce((sum, month) => sum + month.inflow - month.outflow - month.tax, 0) / months.length
}

/** Objectifs de `history` (lignes sans Asset ni Instrument) postérieurs à `fromIso` : [{ iso, amount }]. */
export function readGoals(table, fromIso) {
  if (!table) return []
  const date = findColumn(table.columns, ['Date'])
  const value = findCurrencyColumn(table.columns, displayCurrency.value) ?? findColumn(table.columns, ['Assets Master Currency'])
  if (!date || !value) return []
  const labels = [findColumn(table.columns, ['Asset']), findColumn(table.columns, ['Instrument'])].filter(Boolean)
  return splitGoals(rowsOf(table), date, value, labels)
    .goals.map(([ts, amount]) => ({ iso: new Date(ts).toISOString().slice(0, 10), amount }))
    .filter((goal) => goal.iso > fromIso)
}

/* ---------- Tirages ---------- */

/** Générateur pseudo-aléatoire reproductible (mulberry32) : mêmes hypothèses, mêmes résultats. */
export function randomGenerator(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tirage normal centré réduit (Box-Muller). */
function normal(random) {
  let u = 0
  while (u === 0) u = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

const DF = 5
const STUDENT_SCALE = Math.sqrt((DF - 2) / DF) // ramène la variance de la loi de Student (df / (df - 2)) à 1

/** Tirage de Student à 5 degrés de liberté, de variance 1 (queues épaisses). */
function student(random) {
  let chi2 = 0
  for (let k = 0; k < DF; k++) chi2 += normal(random) ** 2
  return (normal(random) / Math.sqrt(chi2 / DF)) * STUDENT_SCALE
}

const TABLE_SIZE = 1 << 16
const tables = new Map()

/**
 * Table de 65 536 chocs (Student ou normaux), tirée une fois pour toutes : chaque tirage de la simulation y pioche une
 * case au hasard. C'est 10 fois plus rapide que de tirer chaque choc, et la table est assez grande pour que la
 * distribution soit respectée (moyenne 0 et variance 1 ajustées exactement).
 */
function shockTable(fatTails) {
  const key = fatTails ? 'student' : 'normal'
  if (tables.has(key)) return tables.get(key)
  const random = randomGenerator(fatTails ? 2024 : 1989)
  const table = new Float64Array(TABLE_SIZE)
  for (let k = 0; k < TABLE_SIZE; k++) table[k] = fatTails ? student(random) : normal(random)
  const mean = table.reduce((sum, x) => sum + x, 0) / TABLE_SIZE
  const sd = Math.sqrt(table.reduce((sum, x) => sum + (x - mean) ** 2, 0) / TABLE_SIZE)
  for (let k = 0; k < TABLE_SIZE; k++) table[k] = (table[k] - mean) / sd
  tables.set(key, table)
  return table
}

/** Centile p (0..1) d'un tableau trié. */
function quantile(sorted, p) {
  if (!sorted.length) return 0
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low)
}

export const PERCENTILES = [0.1, 0.25, 0.5, 0.75, 0.9]

/**
 * Lance la simulation.
 * params : {
 *   assets: [{ name, amount, mu, sigma, rho, invest, fees }],
 *   debt, debtPayment,       // dette actuelle et remboursement mensuel de capital
 *   contribution,            // versement net mensuel (peut être négatif : retrait)
 *   contributionGrowth,      // hausse annuelle du versement (0.02 = +2 %/an)
 *   fees,                    // frais annuels sur les actifs financiers (0.003 = 0,3 %)
 *   inflation,               // inflation annuelle, pour les montants « en euros d'aujourd'hui »
 *   years, runs, seed,
 *   goal: { months, amount } | null, // objectif à tester (en euros courants), n mois après le départ
 *   fatTails: true,
 * }
 * Retourne { years: [{ year, nominal: [p10..p90], real: [p10..p90] }], finalNet: tableau trié, goalChance, ruin }.
 */
export function simulate(params) {
  const { assets, debt = 0, debtPayment = 0, contribution = 0, contributionGrowth = 0, fees = 0, inflation = 0 } = params
  const months = Math.max(1, Math.round(params.years * 12))
  const runs = params.runs ?? 5000
  const random = randomGenerator(params.seed ?? 42)
  const shocks = shockTable(params.fatTails !== false)
  const draw = () => shocks[(random() * TABLE_SIZE) | 0]

  const n = assets.length
  const drift = assets.map((asset) => {
    const s = asset.sigma / Math.sqrt(12)
    return Math.log(1 + asset.mu) / 12 - (s * s) / 2
  })
  const vol = assets.map((asset) => asset.sigma / Math.sqrt(12))
  const rho = assets.map((asset) => Math.max(-1, Math.min(1, asset.rho ?? 0)))
  const idio = rho.map((r) => Math.sqrt(1 - r * r))
  const monthlyFee = fees / 12

  const investTotal = assets.reduce((sum, asset) => sum + (asset.invest ? asset.amount : 0), 0)
  const split = assets.map((asset) =>
    investTotal > 0 ? (asset.invest ? asset.amount / investTotal : 0) : asset.invest ? 1 / Math.max(1, assets.filter((a) => a.invest).length) : 0,
  )

  const checkpoints = [] // fin de chaque année (et dernier mois)
  for (let m = 12; m <= months; m += 12) checkpoints.push(m)
  if (checkpoints[checkpoints.length - 1] !== months) checkpoints.push(months)
  const atCheckpoint = checkpoints.map(() => new Float64Array(runs))
  const goalMonth = params.goal ? Math.min(months, Math.max(1, params.goal.months)) : null
  let reached = 0
  let ruined = 0

  const values = new Float64Array(n)
  for (let r = 0; r < runs; r++) {
    for (let i = 0; i < n; i++) values[i] = assets[i].amount
    let remainingDebt = debt
    let payment = contribution
    let wentNegative = false
    let c = 0
    for (let m = 1; m <= months; m++) {
      const market = draw()
      let total = 0
      for (let i = 0; i < n; i++) {
        const z = rho[i] * market + idio[i] * draw()
        let v = values[i] * Math.exp(drift[i] + vol[i] * z)
        if (assets[i].fees) v *= 1 - monthlyFee
        v += payment * split[i]
        // Un retrait plus gros que ce qui reste vide l'actif : on ne descend pas sous zéro
        if (v < 0) {
          v = 0
          wentNegative = true
        }
        values[i] = v
        total += v
      }
      remainingDebt = Math.max(0, remainingDebt - debtPayment)
      const net = total - remainingDebt
      if (goalMonth === m && net >= params.goal.amount) reached++
      if (m % 12 === 0) payment *= 1 + contributionGrowth
      if (checkpoints[c] === m) atCheckpoint[c++][r] = net
    }
    if (wentNegative) ruined++
  }

  const sorted = atCheckpoint.map((list) => Float64Array.from(list).sort())
  const startYear = params.startYear ?? new Date().getFullYear()
  return {
    years: checkpoints.map((m, c) => {
      const deflator = (1 + inflation) ** (m / 12)
      const nominal = PERCENTILES.map((p) => quantile(sorted[c], p))
      return { month: m, year: startYear + m / 12, nominal, real: nominal.map((value) => value / deflator) }
    }),
    finalNet: sorted[sorted.length - 1],
    goalChance: goalMonth ? reached / runs : null,
    ruin: ruined / runs,
    runs,
  }
}

/** Nombre de mois entre deux dates "AAAA-MM-JJ" (arrondi). */
export function monthsBetween(fromIso, toIso) {
  const [y1, m1] = fromIso.split('-').map(Number)
  const [y2, m2] = toIso.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}
