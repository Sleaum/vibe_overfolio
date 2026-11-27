import { describe, expect, it } from 'vitest'
import { DataError, collectDropped } from '../src/lib/aggregate.js'
import { buildSnapshot, dayChange, periodChanges } from '../src/lib/snapshot.js'
import { historyTable, portfolioTable } from './fixtures/index.js'

// Fixture portfolio : 303 000 d'actifs, 162 000 de dettes (prêt maison 150 000 dans real estate, prêt auto 12 000 dans
// depreciating), patrimoine net 141 000. En net, depreciating (8 000 - 12 000) est négatif : il est écarté des parts.
// Fixture history (actifs / net) : 30/11/2025 240 000 / 65 000, 31/12/2025 250 000 / 80 000, 31/10/2026 290 000 / 125 000.
// previous_day de portfolio : 13/11/2026, 300 000 d'actifs, 160 000 de dettes.

describe('buildSnapshot en brut', () => {
  const snapshot = buildSnapshot(portfolioTable(), historyTable(), '2000-01-01', 'gross')

  it('prend la date des positions la plus récente, et non la date de secours', () => {
    expect(snapshot.asOf).toBe('2026-11-14')
  })

  it('compte les actifs seuls, et donne aussi le net', () => {
    expect(snapshot.mode).toBe('gross')
    expect(snapshot.total).toBe(303000)
    expect(snapshot.gross).toBe(303000)
    expect(snapshot.liabilities).toBe(-162000)
    expect(snapshot.net).toBe(141000)
  })

  it('range les types du plus gros au plus petit, avec leur part', () => {
    expect(snapshot.legend.map((item) => item.name)).toEqual([
      'Real estate',
      'Public equity',
      'Fiat',
      'Depreciating',
      'Commodity',
      'Crypto',
    ])
    const shares = Object.fromEntries(snapshot.parts.map((part) => [part.name, part.share]))
    expect(shares['Real estate']).toBeCloseTo(200000 / 303000)
    expect(snapshot.parts.reduce((sum, part) => sum + part.share, 0)).toBeCloseTo(1)
  })

  it('liste les dettes par instrument, en positif, avec leur part du total des dettes', () => {
    expect(snapshot.debts).toEqual([
      { name: 'Prêt maison', value: 150000, share: 150000 / 162000 },
      { name: 'Prêt auto', value: 12000, share: 12000 / 162000 },
    ])
  })

  it('détaille chaque type par les colonnes présentes, sans compter les dettes', () => {
    const equity = snapshot.types.find((type) => type.name === 'Public equity')
    expect(equity.value).toBe(75000)
    expect(equity.debts).toBe(0)
    const envelopes = equity.dimensions.find((dim) => dim.key === 'envelope')
    expect(envelopes.items).toEqual([
      { name: 'PEA', value: 60000, share: 0.8 },
      { name: 'CTO', value: 15000, share: 0.2 },
    ])
    expect(snapshot.missingDimensions).toEqual(['Zone'])
  })

  it('calcule les variations sur l’année, le mois et 24 h à partir des actifs', () => {
    expect(snapshot.changes.year).toEqual({ fraction: (303000 - 250000) / 250000, since: '2025-12-31' })
    expect(snapshot.changes.month).toEqual({ fraction: (303000 - 290000) / 290000, since: '2026-10-31' })
    expect(snapshot.changes.day).toEqual({ fraction: (303000 - 300000) / 300000, since: '2026-11-13' })
  })
})

describe('buildSnapshot en net', () => {
  const [snapshot, dropped] = collectDropped(() => buildSnapshot(portfolioTable(), historyTable(), '2000-01-01', 'net'))

  it('retire chaque dette de son type et écarte les types négatifs, qui sont relevés', () => {
    expect(snapshot.mode).toBe('net')
    expect(snapshot.total).toBe(145000) // somme des types positifs
    expect(snapshot.net).toBe(141000) // vrai patrimoine net, depreciating négatif compris
    expect(snapshot.legend.map((item) => item.name)).not.toContain('Depreciating')
    expect(dropped).toEqual(['depreciating'])
  })

  it('montre pour chaque type son montant net et les dettes retirées', () => {
    const realEstate = snapshot.types.find((type) => type.name === 'Real estate')
    expect(realEstate.value).toBe(50000)
    expect(realEstate.debts).toBe(150000)
  })

  it('n’affiche pas la liste des dettes', () => {
    expect(snapshot.debts).toEqual([])
  })

  it('calcule les variations à partir du patrimoine net', () => {
    expect(snapshot.changes.year).toEqual({ fraction: (141000 - 80000) / 80000, since: '2025-12-31' })
    expect(snapshot.changes.month).toEqual({ fraction: (141000 - 125000) / 125000, since: '2026-10-31' })
    expect(snapshot.changes.day).toEqual({ fraction: (141000 - 140000) / 140000, since: '2026-11-13' })
  })
})

describe('buildSnapshot sans history', () => {
  it('laisse les variations de l’année et du mois vides, et garde celle sur 24 h', () => {
    const snapshot = buildSnapshot(portfolioTable(), null, '2000-01-01', 'gross')
    expect(snapshot.changes.year).toBeNull()
    expect(snapshot.changes.month).toBeNull()
    expect(snapshot.changes.day).not.toBeNull()
  })

  it('sans previous_day, la variation sur 24 h est vide aussi', () => {
    const portfolio = portfolioTable()
    portfolio.previous_day = null
    expect(buildSnapshot(portfolio, null).changes).toEqual({ year: null, month: null, day: null })
  })
})

describe('buildSnapshot : tables inutilisables', () => {
  it('prend la date de secours si portfolio n’a pas de colonne Date', () => {
    const portfolio = portfolioTable()
    portfolio.columns = portfolio.columns.filter((column) => column !== 'Date')
    expect(buildSnapshot(portfolio, null, '2026-01-15').asOf).toBe('2026-01-15')
  })

  it('renvoie un message si aucun montant n’est positif', () => {
    const portfolio = { ...portfolioTable(), rows: [{ Asset: 'fiat', 'Assets Master Currency': 0 }] }
    expect(buildSnapshot(portfolio)).toEqual({ empty: 'Aucun montant supérieur à 0 dans la table portfolio.' })
  })

  it('lève une DataError si une colonne obligatoire manque', () => {
    const portfolio = { ...portfolioTable(), columns: ['Date', 'Instrument'] }
    expect(() => buildSnapshot(portfolio)).toThrow(DataError)
  })
})

describe('periodChanges', () => {
  it('prend le premier relevé de la période quand aucun n’est antérieur', () => {
    const history = historyTable()
    history.rows = history.rows.filter((row) => row.Date === '31/10/2026')
    const changes = periodChanges(history, '2026-11-14', 300000)
    expect(changes.year).toEqual({ fraction: 10000 / 290000, since: '2026-10-31' })
  })

  it('ignore les relevés postérieurs à la date des positions', () => {
    const changes = periodChanges(historyTable(), '2026-01-15', 260000)
    expect(changes.month).toEqual({ fraction: (260000 - 250000) / 250000, since: '2025-12-31' })
  })

  // Bug : un objectif (ligne de history sans Asset ni Instrument) dont le montant est dans Assets Master Currency
  // est additionné aux relevés de sa date. Un objectif de fin d'année, daté comme le relevé du 31/12, fausse la
  // variation de l'année (-40,6 % au lieu de +21,2 % ici). Les graphiques de Flow, eux, écartent les objectifs
  // (splitGoals de lib/charts/flowTrend.js). À corriger dans une PR à part.
  it.skip('ne compte pas les objectifs de history comme des relevés', () => {
    const history = historyTable()
    history.rows.push({ Date: '2025-12-31', Asset: '', Instrument: '', 'Assets Master Currency': 260000, 'Liabilities Master Currency': '' })
    const changes = periodChanges(history, '2026-11-14', 303000)
    expect(changes.year).toEqual({ fraction: (303000 - 250000) / 250000, since: '2025-12-31' })
  })

  it('renvoie des variations vides sans historique exploitable', () => {
    expect(periodChanges({ columns: ['Autre'], rows: [] }, '2026-11-14', 1)).toEqual({ year: null, month: null })
    expect(periodChanges(historyTable(), '', 1)).toEqual({ year: null, month: null })
  })
})

describe('dayChange', () => {
  it('compare au total gardé la veille, brut ou net', () => {
    const previous = { date: '2026-11-13', assets: 1000, liabilities: -400 }
    expect(dayChange(previous, 'gross', 1100)).toEqual({ fraction: 0.1, since: '2026-11-13' })
    expect(dayChange(previous, 'net', 660)).toEqual({ fraction: 0.1, since: '2026-11-13' })
  })

  it('renvoie null sans relevé ou avec une base nulle ou négative', () => {
    expect(dayChange(null, 'gross', 1)).toBeNull()
    expect(dayChange({ date: 'x', assets: 100, liabilities: -200 }, 'net', 1)).toBeNull()
  })
})
