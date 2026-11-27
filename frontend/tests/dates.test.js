import { describe, expect, it } from 'vitest'
import { isoToTimestamp, monthKey, toIsoDate } from '../src/lib/dates.js'

describe('toIsoDate', () => {
  it.each([
    ['2026-11-14', '2026-11-14'],
    ['2026/11/14', '2026-11-14'],
    ['2026.1.5', '2026-01-05'],
    ['2026-11-14 10:30:00', '2026-11-14'],
    ['2026-11-14T10:30:00Z', '2026-11-14'],
    ['14/11/2026', '2026-11-14'],
    ['14-11-2026', '2026-11-14'],
    ['5.1.2026', '2026-01-05'],
    ['  14/11/2026  ', '2026-11-14'],
    ['29/02/2024', '2024-02-29'],
  ])('%j -> %j', (value, expected) => {
    expect(toIsoDate(value)).toBe(expected)
  })

  it('lit un numéro de série Google Sheets (jours depuis le 30/12/1899), heure ignorée', () => {
    expect(toIsoDate(45000)).toBe('2023-03-15')
    expect(toIsoDate(45000.99)).toBe('2023-03-15')
    expect(toIsoDate(46340)).toBe('2026-11-14')
  })

  it.each([
    [''],
    [null],
    [undefined],
    ['abc'],
    ['31/02/2026'], // date impossible
    ['2026-13-01'],
    ['1899-12-31'], // hors de 1900..2200
    ['14/11/26'], // année sur deux chiffres : ambiguë
    ['20261114'],
    [100], // trop petit pour un numéro de série plausible
    [Number.NaN],
  ])('%j -> ""', (value) => {
    expect(toIsoDate(value)).toBe('')
  })
})

describe('isoToTimestamp et monthKey', () => {
  it('convertit en millisecondes UTC, sans décalage de fuseau', () => {
    expect(isoToTimestamp('2026-11-14')).toBe(Date.UTC(2026, 10, 14))
  })

  it('garde l’année et le mois', () => {
    expect(monthKey('2026-11-14')).toBe('2026-11')
  })
})
