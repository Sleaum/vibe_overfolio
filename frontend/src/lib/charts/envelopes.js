// Page « Enveloppes » (/enveloppes) : tes enveloppes de placement (CTO, PEA, PER, PEE…), comme la page
// « Portfolio Stocks Enveloppe » de l'ancien rapport Data Studio.
// Une enveloppe de placement est une enveloppe qui contient au moins une ligne d'actions, d'ETF ou de fonds : les comptes
// qui ne détiennent que des liquidités, de l'immobilier ou un véhicule n'y figurent pas.
// Quatre graphiques : anneau enveloppe → instrument, évolution de chaque enveloppe, répartition par sous-type, par zone.

import { DataError, findColumn, latestDate, requireColumns, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { capitalize, euro, formatDateLong, formatMonthKey, percent } from '../format.js'
import { CONTEXT, SERIES } from '../palette.js'
import { toIsoDate } from '../dates.js'
import { tint } from '../strategy.js'
import { stackedOption } from './stackedBars.js'
import { dataSubtitle } from './common.js'
import { assetsLinesOption } from './flowAssets.js'
import { monthEnds, monthsSubtitle, skippedNote } from './flowData.js'
import { sunburstOption } from './sunburst.js'
import { t, tList } from '../../i18n/index.js'

const ENVELOPE_NAMES = ['Envelope', 'Enveloppe', 'Account', 'Compte', 'Wrapper']
const ASSET_NAMES = ['Asset']
const VALUE_NAMES = ['Assets Master Currency']
// Types d'actifs « de placement » : une enveloppe qui en contient au moins un est retenue
const INVESTED = new Set(['public equity', 'equity', 'equities', 'stock', 'stocks', 'etf', 'fund', 'funds', 'managed futures'])
// Anneau extérieur : chaque instrument d'au moins 1 % de son enveloppe a sa part (20 au plus), le reste va dans « Autres »
const MIN_CHILD_SHARE = 0.01
const MAX_CHILDREN = 20

const lower = (text) => String(text ?? '').trim().toLowerCase()

/** « cto » -> « CTO », « etf » -> « ETF », « assurance vie » -> « Assurance vie » : les sigles courts en capitales. */
export const envelopeLabel = (name) => (String(name).trim().length <= 4 ? String(name).trim().toUpperCase() : capitalize(name))

/** Colonnes communes ; Asset est facultative (sans elle, toutes les enveloppes sont retenues). */
function columnsOf(table, extra = {}) {
  const cols = requireColumns(table, { envelope: ENVELOPE_NAMES, value: VALUE_NAMES, ...extra })
  return { ...cols, asset: findColumn(table.columns, ASSET_NAMES) }
}

/** Noms (en minuscules) des enveloppes de placement présentes dans `rows`. */
export function investedEnvelopes(rows, envelopeColumn, assetColumn) {
  const names = new Set()
  for (const row of rows) {
    const envelope = lower(row[envelopeColumn])
    if (!envelope) continue
    if (!assetColumn || INVESTED.has(lower(row[assetColumn]))) names.add(envelope)
  }
  return names
}

/**
 * Toutes les lignes de `portfolio` (ta photo actuelle) et sa date la plus récente, pour le sous-titre.
 * On ne filtre pas sur cette date : selon la place de cotation, les lignes d'un même relevé peuvent porter des dates
 * différentes (titres européens datés de la veille des titres américains, par exemple). Comme Portfolio Snapshot.
 */
function currentRows(table) {
  const rows = rowsOf(table)
  const dateColumn = findColumn(table.columns, ['Date'])
  return { rows, date: dateColumn ? latestDate(rows, dateColumn) : '' }
}

/**
 * Montants > 0 des enveloppes de placement, détaillés par une colonne (ou par `labelOf(row)`) :
 * [{ name, total, parts: Map(libellé -> montant) }].
 */
export function envelopeBreakdown(rows, cols, detailColumn, labelOf = null) {
  const keep = investedEnvelopes(rows, cols.envelope, cols.asset)
  const groups = new Map()
  for (const row of rows) {
    const key = lower(row[cols.envelope])
    const value = toNumber(row[cols.value])
    if (!keep.has(key) || !(value > 0)) continue
    const group = groups.get(key) ?? { name: envelopeLabel(row[cols.envelope]), total: 0, parts: new Map() }
    const part = labelOf ? labelOf(row) : detailColumn ? toLabel(row[detailColumn]) : t('chart.total')
    group.total += value
    group.parts.set(part, (group.parts.get(part) ?? 0) + value)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

const noEnvelope = (table) => ({
  empty: t('charts.envelopes.none', { table: table?.name ?? '' }),
})

/* ---------- 1. Anneau enveloppe → instrument ---------- */

/**
 * Étiquettes de l'anneau : le nom de chaque enveloppe à l'intérieur, et celui des instruments dont la part est assez
 * large pour être lisible (les autres se lisent au survol et dans la vue en tableau).
 */
function labelRings(option, total) {
  for (const series of [].concat(option.series ?? [])) {
    for (const node of series.data ?? []) {
      node.label = { show: true, rotate: 0, color: '#fff', fontWeight: 600, fontSize: 13, minAngle: 12 } // couleur fixe : texte blanc sur couleur de série
      for (const child of node.children ?? []) {
        // Grande part : texte le long de l'arc (plus de place) ; petite part : texte en travers de l'anneau
        const wide = child.value / total >= 0.12
        child.label = {
          show: true,
          rotate: wide ? 'tangential' : 'radial',
          color: '#1f2937', // couleur fixe : texte foncé sur couleur de série
          fontSize: 11,
          minAngle: 7,
          overflow: 'truncate',
          width: wide ? 160 : 90,
        }
      }
    }
  }
  return option
}

/** « DE:UETW » -> « UETW » ; vide si la ligne n'a pas de ticker. */
const shortTicker = (value) => String(value ?? '').trim().split(':').pop().toUpperCase()

/** Nom affiché d'un instrument : « MSCI world · UETW » (le ticker distingue deux « msci world » d'enveloppes différentes). */
function instrumentLabel(row, cols) {
  const name = envelopeLabel(toLabel(row[cols.instrument]))
  const ticker = cols.ticker ? shortTicker(row[cols.ticker]) : ''
  if (!ticker) return name
  return ticker === name.toUpperCase() ? ticker : `${name} · ${ticker}`
}

export const envelopeInstruments = {
  slug: 'enveloppes-instruments',
  get title() {
    return t('charts.envelopeInstruments.title')
  },
  get summary() {
    return t('charts.envelopeInstruments.summary')
  },
  table: 'portfolio',
  get explain() {
    return tList('charts.envelopeInstruments.explain')
  },
  get source() {
    return t('charts.envelopeInstruments.source')
  },

  build(table) {
    const cols = { ...columnsOf(table, { instrument: ['Instrument', 'Instruments'] }), ticker: findColumn(table.columns, ['Ticker', 'Symbole', 'Symbol']) }
    const { rows, date } = currentRows(table)
    const groups = envelopeBreakdown(rows, cols, cols.instrument, (row) => instrumentLabel(row, cols))
    if (!groups.length) return noEnvelope(table)

    const total = groups.reduce((sum, group) => sum + group.total, 0)
    const sortedParts = groups.map((group) => [...group.parts.entries()].sort((a, b) => b[1] - a[1]))
    const categories = groups.map((group, g) => {
      const color = g < SERIES.length ? SERIES[g] : CONTEXT
      const parts = sortedParts[g]
      const big = parts.filter(([, value]) => value >= MIN_CHILD_SHARE * group.total)
      const shown = big.slice(0, MAX_CHILDREN)
      const rest = parts.filter((part) => !shown.includes(part))
      if (rest.length) shown.push([t('data.othersCount', { count: rest.length }), rest.reduce((sum, [, value]) => sum + value, 0)])
      return {
        name: group.name,
        value: group.total,
        share: group.total / total,
        color,
        children: shown.map(([name, value], c) => ({
          name,
          value,
          share: value / group.total,
          color: tint(color, 0.15 + (0.55 * c) / Math.max(shown.length, 1)),
        })),
      }
    })

    return {
      subtitle: date ? t('subtitle.recordOf', { date: formatDateLong(date) }) : dataSubtitle(table),
      summary: t('charts.envelopes.ringA11y', {
        envelopes: t('charts.envelopes.count', { count: groups.length }, groups.length),
        total: euro(total),
        shares: groups.map((group) => `${group.name} ${percent(group.total / total)}`).join(', '),
      }),
      option: labelRings(sunburstOption(categories, total), total),
      height: 520,
      table: {
        columns: [t('charts.envelopes.envelope'), t('charts.envelopes.instrument'), t('chart.amount'), t('charts.envelopes.shareOfEnvelope')],
        numeric: [false, false, true, true],
        // Le tableau liste tous les instruments, y compris ceux regroupés en « Autres » dans l'anneau
        rows: groups.flatMap((group, g) => [
          [group.name, t('chart.total'), euro(group.total), percent(1)],
          ...sortedParts[g].map(([name, value]) => ['', name, euro(value), percent(value / group.total)]),
        ]),
      },
      note: t('charts.envelopes.total', { total: euro(total) }),
    }
  },
}

/* ---------- 2. Évolution de chaque enveloppe ---------- */

export const envelopeHistory = {
  slug: 'enveloppes-evolution',
  get title() {
    return t('charts.envelopeHistory.title')
  },
  get summary() {
    return t('charts.envelopeHistory.summary')
  },
  table: '_history',
  minWidth: 720,
  get explain() {
    return tList('charts.envelopeHistory.explain')
  },
  get source() {
    return t('charts.envelopeHistory.source')
  },

  build(table) {
    const cols = columnsOf(table, { date: ['Date'] })
    const rows = rowsOf(table)
    const months = monthEnds(rows, cols.date)
    if (!months.length) return { empty: t('charts.envelopes.noRecord') }

    const lastRows = rows.filter((row) => toIsoDate(row[cols.date]) === months[months.length - 1].iso)
    const keep = investedEnvelopes(lastRows.length ? lastRows : rows, cols.envelope, cols.asset)
    if (!keep.size) return noEnvelope(table)

    // Montant de chaque enveloppe à chaque date de relevé
    const byDate = new Map()
    const labels = new Map()
    for (const row of rows) {
      const key = lower(row[cols.envelope])
      const value = toNumber(row[cols.value])
      if (!keep.has(key) || !(value > 0)) continue
      const iso = toIsoDate(row[cols.date])
      if (!iso) continue
      if (!labels.has(key)) labels.set(key, envelopeLabel(row[cols.envelope]))
      const day = byDate.get(iso) ?? new Map()
      day.set(key, (day.get(key) ?? 0) + value)
      byDate.set(iso, day)
    }

    const last = byDate.get(months[months.length - 1].iso) ?? new Map()
    const keys = [...labels.keys()].sort((a, b) => (last.get(b) ?? 0) - (last.get(a) ?? 0))
    const series = keys.map((key, s) => ({ label: labels.get(key), color: s < SERIES.length ? SERIES[s] : CONTEXT, slot: s, members: [key] }))
    const shownMonths = months.filter((month) => keys.some((key) => (byDate.get(month.iso)?.get(key) ?? 0) > 0))
    const values = series.map((serie) => shownMonths.map((month) => byDate.get(month.iso)?.get(serie.members[0]) ?? 0))
    const totals = shownMonths.map((_, m) => values.reduce((sum, row) => sum + row[m], 0))
    if (!shownMonths.length) return noEnvelope(table)

    const model = { months: shownMonths, series, values, totals }
    return {
      subtitle: monthsSubtitle(shownMonths),
      summary: t('charts.envelopes.historyA11y', {
        envelopes: t('charts.envelopes.count', { count: series.length }, series.length),
        months: t('charts.envelopes.months', { count: shownMonths.length }, shownMonths.length),
        last: series.map((serie, s) => `${serie.label} ${euro(values[s][shownMonths.length - 1])}`).join(', '),
      }),
      option: assetsLinesOption(model),
      height: 400,
      table: {
        columns: [t('chart.month'), ...series.map((serie) => serie.label), t('chart.total')],
        numeric: [false, ...series.map(() => true), true],
        rows: [...shownMonths.keys()]
          .reverse()
          .map((m) => [formatMonthKey(shownMonths[m].key), ...values.map((row) => euro(row[m])), euro(totals[m])]),
      },
      note: skippedNote(months.skipped),
    }
  },
}

/* ---------- 3 et 4. Répartition de chaque enveloppe (par sous-type, par zone) ---------- */

// `key` : rubrique des textes dans i18n (title, summary, explain, a11y)
function mixSpec({ slug, key, names }) {
  return {
    slug,
    get title() {
      return t(`${key}.title`)
    },
    get summary() {
      return t(`${key}.summary`)
    },
    table: 'portfolio',
    get explain() {
      return tList(`${key}.explain`)
    },
    get source() {
      return t('charts.envelopes.mixSource', { column: names[0] })
    },

    build(table) {
      const cols = columnsOf(table)
      const detail = findColumn(table.columns, names)
      if (!detail) {
        throw new DataError(
          t('charts.envelopes.missingColumn', {
            column: names[0],
            table: table?.name ?? 'portfolio',
            available: (table?.columns ?? []).join(', ') || t('data.none'),
          }),
        )
      }
      const { rows, date } = currentRows(table)
      const groups = envelopeBreakdown(rows, cols, detail)
      if (!groups.length) return noEnvelope(table)

      // Une couleur par valeur de la dimension, de la plus grosse à la plus petite (au-delà de 8 : « Autres »)
      const totals = new Map()
      for (const group of groups) for (const [name, value] of group.parts) totals.set(name, (totals.get(name) ?? 0) + value)
      const labels = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
      const shown = labels.slice(0, SERIES.length - 1)
      const folded = labels.slice(SERIES.length - 1)
      const series = shown.map((name, s) => ({ label: envelopeLabel(name), color: SERIES[s], members: [name] }))
      if (folded.length) series.push({ label: t('data.othersCount', { count: folded.length }), color: CONTEXT, members: folded })
      const values = groups.map((group) =>
        series.map((serie) => serie.members.reduce((sum, member) => sum + (group.parts.get(member) ?? 0), 0)),
      )

      return {
        subtitle: date ? t('subtitle.recordOf', { date: formatDateLong(date) }) : dataSubtitle(table),
        summary: t(`${key}.a11y`, {
          envelopes: t('charts.envelopes.count', { count: groups.length }, groups.length),
          details: groups
            .map((group, g) => {
              const top = series.map((serie, s) => ({ serie, value: values[g][s] })).sort((a, b) => b.value - a.value)[0]
              return `${group.name} : ${top.serie.label} ${percent(top.value / group.total)}`
            })
            .join(' ; '),
        }),
        option: stackedOption(groups, series, values),
        height: Math.max(220, groups.length * 56 + 70),
        table: {
          columns: [t('charts.envelopes.envelope'), ...series.map((serie) => serie.label), t('chart.total')],
          numeric: [false, ...series.map(() => true), true],
          rows: groups.map((group, g) => [
            group.name,
            ...values[g].map((value) => (value > 0 ? `${euro(value)} (${percent(value / group.total)})` : '')),
            euro(group.total),
          ]),
        },
      }
    },
  }
}

export const envelopeTypes = mixSpec({
  slug: 'enveloppes-types',
  key: 'charts.envelopeTypes',
  names: ['Sub Asset', 'Sub-Asset', 'SubAsset', 'Sous-type', 'Sous type'],
})

export const envelopeAreas = mixSpec({
  slug: 'enveloppes-zones',
  key: 'charts.envelopeAreas',
  names: ['Area', 'Zone', 'Region', 'Région', 'Pays', 'Country'],
})

export const ENVELOPE_CHARTS = [envelopeInstruments, envelopeHistory, envelopeTypes, envelopeAreas]
