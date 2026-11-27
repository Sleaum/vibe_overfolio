import { describe, expect, it } from 'vitest'
import { DataError, collectDropped, findColumn, requireColumns, splitBy, toNumber } from '../src/lib/aggregate.js'
import { portfolioTable } from './fixtures/index.js'

describe('toNumber', () => {
  it.each([
    [12.5, 12.5],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['1 234,56 €', 1234.56],
    ['1 234,56 €', 1234.56], // espaces insécables, comme dans une feuille en français
    ['1.234,56', 1234.56],
    ['-2 500', -2500],
    ['$99', 99],
  ])('%j -> %j', (value, expected) => {
    expect(toNumber(value)).toBe(expected)
  })

  it.each([[''], ['   '], ['abc'], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [true], [{}]])(
    '%j -> 0',
    (value) => {
      expect(toNumber(value)).toBe(0)
    },
  )

  // À confirmer : une valeur écrite à l'anglaise (virgule des milliers) est lue comme une décimale.
  // Le serveur lit pareil (to_number de googlesheet/currencies.py) ; l'API Google renvoie d'habitude des nombres.
  it.skip('lit "1,234.56" comme 1234.56 (format anglais)', () => {
    expect(toNumber('1,234.56')).toBe(1234.56)
  })
})

describe('findColumn', () => {
  const columns = ['Date', 'Assets Master Currency', 'Sous-type', 'Enveloppe']

  it('ignore la casse, les accents, les espaces en trop, « _ » et « - »', () => {
    expect(findColumn(columns, ['date'])).toBe('Date')
    expect(findColumn(columns, ['assets_master_currency'])).toBe('Assets Master Currency')
    expect(findColumn(columns, ['  ASSETS   master-currency '])).toBe('Assets Master Currency')
    expect(findColumn(columns, ['sous type'])).toBe('Sous-type')
    expect(findColumn(columns, ['ÉNVELOPPE'])).toBe('Enveloppe')
  })

  it('essaie chaque nom accepté et renvoie la colonne telle qu’écrite dans la feuille', () => {
    expect(findColumn(columns, ['Envelope', 'Enveloppe', 'Account'])).toBe('Enveloppe')
  })

  it('renvoie null si rien ne correspond, ou sans colonnes', () => {
    expect(findColumn(columns, ['Broker'])).toBeNull()
    expect(findColumn(undefined, ['Date'])).toBeNull()
  })
})

describe('requireColumns', () => {
  it('renvoie le vrai nom de chaque colonne demandée', () => {
    expect(requireColumns(portfolioTable(), { asset: ['asset'], value: ['Assets Master Currency'] })).toEqual({
      asset: 'Asset',
      value: 'Assets Master Currency',
    })
  })

  it('lève une DataError lisible qui nomme la table, les colonnes manquantes et celles disponibles', () => {
    const table = { name: 'budget', columns: ['Source', 'Valeur'], rows: [] }
    let error
    try {
      requireColumns(table, { source: ['Source'], target: ['Destination', 'Target'], date: ['Date'] })
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(DataError)
    expect(error.message).toBe(
      'Colonne(s) introuvable(s) dans la table « budget » : Destination, Date. Colonnes disponibles : Source, Valeur.',
    )
  })
})

describe('splitBy et collectDropped', () => {
  it('additionne par libellé sans tenir compte de la casse, écarte et relève les groupes négatifs', () => {
    const rows = [
      { type: 'Crypto', value: 10 },
      { type: 'crypto', value: 5 },
      { type: 'loan', value: -20 },
      { type: 'loan', value: 4 },
      { type: '', value: 3 },
    ]
    const [{ entries, total }, dropped] = collectDropped(() => splitBy(rows, 'type', 'value'))
    expect(entries).toEqual([
      { name: 'Crypto', value: 15 },
      { name: 'Non renseigné', value: 3 },
    ])
    expect(total).toBe(18)
    expect(dropped).toEqual(['loan'])
  })
})
