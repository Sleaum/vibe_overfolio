import { describe, expect, it } from 'vitest'
import { CLASSES } from '../src/lib/models.js'
import { OTHER, TOLERANCE, buildPlan, categories, classOfRow, currentAmounts, maxGap, targetSum } from '../src/lib/target.js'
import { portfolioTable } from './fixtures/index.js'

describe('buildPlan : versements puis ventes', () => {
  it('cible déjà atteinte : atteinte dès l’année de départ, rien à acheter ni à vendre', () => {
    const plan = buildPlan({ amounts: { a: 600, b: 400 }, target: { a: 60, b: 40 }, monthly: 0, fromYear: 2026, toYear: 2028 })
    expect(plan.reachedYear).toBe(2026)
    expect(plan.steps.map((step) => step.year)).toEqual([2027, 2028])
    for (const step of plan.steps) {
      expect(step.buys).toEqual({})
      expect(step.sells).toEqual({})
      expect(step.gap).toBe(0)
    }
    expect(plan.final).toEqual({ a: 600, b: 400 })
  })

  it('versements suffisants : ils vont d’abord à ce qui manque, la cible est atteinte sans rien vendre', () => {
    // 50 / 50 vers 80 / 20, 10 par mois (120 par an)
    const plan = buildPlan({ amounts: { equity: 50, cash: 50 }, target: { equity: 80, cash: 20 }, monthly: 10, fromYear: 2026, toYear: 2030 })
    const [y1, y2, y3, y4] = plan.steps

    // 2027 : il manque 126 en actions, plus que les 120 versés : tout va aux actions
    expect(y1.buys).toEqual({ equity: 120 })
    expect(y1.total).toBe(220)
    expect(y1.gap).toBeCloseTo(80 - (170 / 220) * 100)

    // 2028 : il manque 102 en actions et 18 en liquidités, soit exactement 120 : cible atteinte
    expect(y2.buys.equity).toBeCloseTo(102)
    expect(y2.buys.cash).toBeCloseTo(18)
    expect(y2.gap).toBeCloseTo(0)
    expect(plan.reachedYear).toBe(2028)

    // Ensuite, les versements suivent la cible
    expect(y3.buys.equity).toBeCloseTo(96)
    expect(y3.buys.cash).toBeCloseTo(24)
    expect(y4.sells).toEqual({})
    expect(plan.final.equity).toBeCloseTo(464)
    expect(plan.final.cash).toBeCloseTo(116)
  })

  it('versements insuffisants : rien n’est vendu avant la dernière année, qui vend ce qui dépasse', () => {
    const plan = buildPlan({ amounts: { equity: 100, cash: 0 }, target: { equity: 50, cash: 50 }, monthly: 0, fromYear: 2026, toYear: 2029 })
    const last = plan.steps.at(-1)
    for (const step of plan.steps.slice(0, -1)) {
      expect(step.sells).toEqual({})
      expect(step.gap).toBe(50)
    }
    expect(last.year).toBe(2029)
    expect(last.sells).toEqual({ equity: 50 })
    expect(last.buys).toEqual({ cash: 50 })
    expect(last.gap).toBe(0)
    expect(plan.final).toEqual({ equity: 50, cash: 50 })
    // Atteinte par une vente, pas par les versements : pas d’année d’atteinte
    expect(plan.reachedYear).toBeNull()
  })

  it('une catégorie de la cible absente du patrimoine est créée par les achats', () => {
    const plan = buildPlan({ amounts: { equity: 100 }, target: { equity: 50, gold: 50 }, monthly: 0, fromYear: 2026, toYear: 2027 })
    expect(plan.steps[0].buys).toEqual({ gold: 50 })
    expect(plan.final).toEqual({ equity: 50, gold: 50 })
  })

  it('un versement négatif ou non numérique compte pour 0', () => {
    for (const monthly of [-50, 'abc', null]) {
      const plan = buildPlan({ amounts: { a: 100, b: 0 }, target: { a: 50, b: 50 }, monthly, fromYear: 2026, toYear: 2027 })
      expect(plan.steps[0].total).toBe(100)
    }
  })

  it('année cible égale à l’année de départ : aucun pas', () => {
    const plan = buildPlan({ amounts: { a: 100 }, target: { a: 100 }, monthly: 10, fromYear: 2026, toYear: 2026 })
    expect(plan.steps).toEqual([])
    expect(plan.reachedYear).toBe(2026)
  })
})

describe('maxGap et targetSum', () => {
  it('donne le plus grand écart en points, catégories absentes comprises', () => {
    expect(maxGap({ a: 70, b: 30 }, { a: 60, b: 30, c: 10 }, ['a', 'b', 'c'])).toBeCloseTo(10)
    expect(TOLERANCE).toBe(0.5)
  })

  it('additionne les pourcentages, en ignorant ce qui n’est pas un nombre', () => {
    expect(targetSum({ a: 60, b: '30', c: 'x' })).toBe(90)
    expect(targetSum(null)).toBe(0)
  })
})

describe('classOfRow', () => {
  it.each([
    ['public equity', '', 'equity'],
    ['Actions', '', 'equity'],
    ['bonds', '', 'bondsMid'],
    ['Obligations', '', 'bondsMid'],
    ['fiat', '', 'cash'],
    ['commodity', 'Gold', 'gold'],
    ['commodity', 'or', 'gold'],
    ['commodity', 'oil', 'commodities'],
    ['gold', '', 'gold'],
    ['real estate', '', 'realEstate'],
    ['managed futures', '', 'trend'],
    ['crypto', '', OTHER],
  ])('%j (%j) -> %j', (type, sub, expected) => {
    expect(classOfRow(type, sub)).toBe(expected)
  })
})

describe('currentAmounts', () => {
  it('base types, en brut : chaque type de la feuille, en minuscules', () => {
    const current = currentAmounts(portfolioTable(), 'types', 'gross')
    expect(current.amounts).toEqual({
      'public equity': 75000,
      fiat: 10000,
      'real estate': 200000,
      crypto: 5000,
      commodity: 5000,
      depreciating: 8000,
    })
    expect(current.total).toBe(303000)
    expect(current.names['public equity']).toBe('public equity')
  })

  it('base types, en net : les dettes sont retirées, un type négatif compte pour 0', () => {
    const current = currentAmounts(portfolioTable(), 'types', 'net')
    expect(current.amounts['real estate']).toBe(50000)
    expect(current.amounts.depreciating).toBe(0)
    expect(current.total).toBe(145000)
  })

  it('base classes : les types sont rangés dans les classes des modèles, commodity selon son sous-type', () => {
    const current = currentAmounts(portfolioTable(), 'classes', 'gross')
    expect(current.amounts).toEqual({ equity: 75000, cash: 10000, realEstate: 200000, other: 13000, gold: 4000, commodities: 1000 })
    expect(current.total).toBe(303000)
  })

  it('renvoie null sans table, sans colonnes utiles ou sans rien de positif', () => {
    expect(currentAmounts(null, 'types')).toBeNull()
    expect(currentAmounts({ columns: ['Asset'], rows: [] }, 'types')).toBeNull()
    expect(currentAmounts({ columns: ['Asset', 'Assets Master Currency'], rows: [{ Asset: 'fiat', 'Assets Master Currency': 0 }] }, 'types')).toBeNull()
  })

  it('un plan en base classes part des montants rangés par classe', () => {
    const { amounts } = currentAmounts(portfolioTable(), 'classes', 'gross')
    const target = { equity: 60, bondsMid: 20, gold: 10, realEstate: 10 }
    const plan = buildPlan({ amounts, target, monthly: 0, fromYear: 2026, toYear: 2027 })
    expect(plan.final.equity).toBeCloseTo(0.6 * 303000)
    expect(plan.final.bondsMid).toBeCloseTo(0.2 * 303000)
    expect(plan.final.other).toBeCloseTo(0)
    expect(plan.steps[0].sells.realEstate).toBeCloseTo(200000 - 30300)
  })
})

describe('categories', () => {
  it('base classes : les classes des modèles, puis « autres »', () => {
    expect(categories('classes')).toEqual([...Object.keys(CLASSES), OTHER])
  })

  it('base types : les types habituels (sans depreciating), puis ceux de la feuille qui manquent', () => {
    const list = categories('types', ['public equity', 'wine'])
    expect(list).not.toContain('depreciating')
    expect(list.filter((key) => key === 'public equity')).toHaveLength(1)
    expect(list.at(-1)).toBe('wine')
  })
})
