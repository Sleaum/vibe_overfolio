import { describe, expect, it } from 'vitest'
import {
  PERCENTILES,
  averageContribution,
  monthsBetween,
  randomGenerator,
  readPortfolio,
  simulate,
} from '../src/lib/simulation.js'
import { inoutTable, portfolioTable } from './fixtures/index.js'

const equity = { name: 'public equity', amount: 10000, mu: 0.07, sigma: 0.16, rho: 0.95, invest: true, fees: true }
const fiat = { name: 'fiat', amount: 5000, mu: 0.02, sigma: 0.005, rho: 0, invest: true, fees: false }
const BASE = { assets: [equity, fiat], contribution: 200, fees: 0.003, inflation: 0.02, years: 10, runs: 500, startYear: 2026 }

// Actif sans hasard : rendement 0, volatilité 0. Le patrimoine ne bouge que par les versements et la dette.
const flat = (amount, extra = {}) => ({ name: 'fiat', amount, mu: 0, sigma: 0, rho: 0, invest: true, fees: false, ...extra })

describe('randomGenerator', () => {
  it('même graine, même suite ; graines différentes, suites différentes', () => {
    const draw = (seed) => {
      const random = randomGenerator(seed)
      return Array.from({ length: 5 }, random)
    }
    expect(draw(7)).toEqual(draw(7))
    expect(draw(7)).not.toEqual(draw(8))
  })

  it('tire dans [0, 1)', () => {
    const random = randomGenerator(123)
    for (let k = 0; k < 10000; k++) {
      const x = random()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('simulate : reproductibilité', () => {
  it('même graine, mêmes résultats', () => {
    const first = simulate({ ...BASE, seed: 42 })
    const second = simulate({ ...BASE, seed: 42 })
    expect(second.years).toEqual(first.years)
    expect(Array.from(second.finalNet)).toEqual(Array.from(first.finalNet))
    expect(second.ruin).toBe(first.ruin)
  })

  it('graine différente, résultats différents', () => {
    const first = simulate({ ...BASE, seed: 42 })
    const other = simulate({ ...BASE, seed: 43 })
    expect(other.years[9].nominal).not.toEqual(first.years[9].nominal)
  })

  it('sans graine, la graine 42 est prise', () => {
    expect(simulate(BASE).years).toEqual(simulate({ ...BASE, seed: 42 }).years)
  })
})

describe('simulate : bornes et forme des résultats', () => {
  const result = simulate({ ...BASE, seed: 1, goal: { months: 120, amount: 50000 } })

  it('un point par année, daté depuis startYear', () => {
    expect(result.years).toHaveLength(10)
    expect(result.years.map((point) => point.year)).toEqual([2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036])
    expect(result.years.at(-1).month).toBe(120)
    expect(result.runs).toBe(500)
  })

  it('centiles dans l’ordre, montants réels sous les montants nominaux (inflation positive)', () => {
    for (const point of result.years) {
      expect(point.nominal).toHaveLength(PERCENTILES.length)
      for (let k = 1; k < point.nominal.length; k++) expect(point.nominal[k]).toBeGreaterThanOrEqual(point.nominal[k - 1])
      point.real.forEach((value, k) => expect(value).toBeLessThan(point.nominal[k]))
    }
  })

  it('résultats finaux triés, probabilités entre 0 et 1', () => {
    expect(result.finalNet).toHaveLength(500)
    for (let k = 1; k < result.finalNet.length; k++) expect(result.finalNet[k]).toBeGreaterThanOrEqual(result.finalNet[k - 1])
    expect(result.goalChance).toBeGreaterThanOrEqual(0)
    expect(result.goalChance).toBeLessThanOrEqual(1)
    expect(result.ruin).toBe(0)
  })

  it('le médian du dernier point est le médian de finalNet', () => {
    const sorted = result.finalNet
    const median = (sorted[249] + sorted[250]) / 2
    expect(result.years.at(-1).nominal[2]).toBeCloseTo(median)
  })

  it('le rendement annuel moyen vaut mu (à 1,5 % près), avec ou sans queues épaisses', () => {
    for (const fatTails of [true, false]) {
      const asset = { ...equity, amount: 1000, fees: false }
      const { finalNet } = simulate({ assets: [asset], years: 1, runs: 20000, seed: 5, fatTails })
      const mean = finalNet.reduce((sum, value) => sum + value, 0) / finalNet.length
      expect(mean / 1070).toBeGreaterThan(0.985)
      expect(mean / 1070).toBeLessThan(1.015)
    }
  })
})

describe('simulate : cas sans hasard', () => {
  it('ajoute les versements et retire la dette remboursée', () => {
    // 1 000 + 100 par mois ; dette de 1 000 remboursée de 50 par mois (finie au 20e mois)
    const result = simulate({ assets: [flat(1000)], contribution: 100, debt: 1000, debtPayment: 50, years: 2, runs: 10, startYear: 2026 })
    expect(result.years[0].nominal).toEqual(Array(5).fill(2200 - 400))
    expect(result.years[1].nominal).toEqual(Array(5).fill(3400))
  })

  it('fait croître le versement chaque année', () => {
    const result = simulate({ assets: [flat(0)], contribution: 100, contributionGrowth: 0.1, years: 2, runs: 1 })
    expect(result.years[1].nominal[0]).toBeCloseTo(1200 + 1320)
  })

  it('prélève les frais sur les actifs financiers seulement', () => {
    const result = simulate({
      assets: [flat(1000, { fees: true }), flat(1000, { name: 'real estate', fees: false, invest: false })],
      fees: 0.12,
      years: 1,
      runs: 1,
    })
    expect(result.years[0].nominal[0]).toBeCloseTo(1000 * 0.99 ** 12 + 1000)
  })

  it('répartit le versement entre les actifs investissables selon leur poids', () => {
    const result = simulate({
      assets: [flat(3000), flat(1000), flat(5000, { name: 'real estate', invest: false })],
      contribution: 100,
      years: 1,
      runs: 1,
    })
    expect(result.years[0].nominal[0]).toBeCloseTo(9000 + 1200)
  })

  it('objectif : atteint ou non au mois demandé', () => {
    const params = { assets: [flat(1000)], contribution: 100, years: 2, runs: 10 }
    expect(simulate({ ...params, goal: { months: 24, amount: 3400 } }).goalChance).toBe(1)
    expect(simulate({ ...params, goal: { months: 24, amount: 3401 } }).goalChance).toBe(0)
    expect(simulate(params).goalChance).toBeNull()
  })

  it('un retrait plus gros que le patrimoine vide les actifs sans passer sous zéro, et compte comme une ruine', () => {
    const result = simulate({ assets: [flat(1000)], contribution: -200, years: 1, runs: 10 })
    expect(result.ruin).toBe(1)
    expect(result.years[0].nominal).toEqual(Array(5).fill(0))
  })

  it('une durée non entière ajoute un dernier point au dernier mois', () => {
    const result = simulate({ assets: [flat(1000)], years: 1.5, runs: 1, startYear: 2026 })
    expect(result.years.map((point) => point.month)).toEqual([12, 18])
    expect(result.years[1].year).toBe(2027.5)
  })
})

describe('lecture des tables', () => {
  it('readPortfolio : actifs positifs par type, dettes en positif, date la plus récente', () => {
    const { date, assets, debt } = readPortfolio(portfolioTable())
    expect(date).toBe('2026-11-14')
    expect(debt).toBe(162000)
    expect(assets).toEqual([
      { name: 'real estate', amount: 200000 },
      { name: 'public equity', amount: 75000 },
      { name: 'fiat', amount: 10000 },
      { name: 'depreciating', amount: 8000 },
      { name: 'crypto', amount: 5000 },
      { name: 'commodity', amount: 5000 },
    ])
  })

  it('averageContribution : moyenne des mois complets, sorties et impôts retirés quel que soit leur signe', () => {
    // août 4000 - 2500 - 300, septembre 4000 - 2700, octobre 4200 - 2600 - 400 ; novembre (en cours) ignoré
    expect(averageContribution(inoutTable(), '2026-11-20')).toBeCloseTo((1200 + 1300 + 1200) / 3)
    expect(averageContribution(null)).toBeNull()
    expect(averageContribution(inoutTable(), '2026-08-15')).toBeNull()
  })

  it('monthsBetween : écart en mois, jours ignorés', () => {
    expect(monthsBetween('2026-11-14', '2040-01-01')).toBe(158)
    expect(monthsBetween('2026-11-30', '2026-12-01')).toBe(1)
  })
})
