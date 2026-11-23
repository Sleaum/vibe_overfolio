// Portfolio Flow : patrimoine en euros à chaque relevé (barres), sa tendance (droite des moindres carrés) et tes objectifs.
// Table `_history` : une colonne « EUR » si elle existe, sinon Assets Master Currency.
// Une ligne sans type d'actif ni instrument (seulement une date et un montant) est un objectif, pas un relevé :
// elle est tracée à part (points reliés en pointillés) et n'entre ni dans les barres ni dans la tendance.

import { DataError, findColumn, requireColumns, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { axisLabelStyle, baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatDateLong, formatDateNumeric, formatMonthYear } from '../format.js'
import { AXIS, BLUE, NAVY, PALE_BLUE } from '../palette.js'
import { isoToTimestamp, toIsoDate } from '../dates.js'
import { findCurrencyColumn, linearTrend } from './flowData.js'
import { t, tList } from '../../i18n/index.js'

const DAY = 86_400_000
// Noms des séries (légende, infobulle), dans la langue active
const BARS = () => t('charts.trend.bars')
const TREND = () => t('charts.trend.trend')
const GOALS = () => t('charts.trend.goals')

/**
 * Sépare les relevés des objectifs. Objectif : une ligne datée, avec un montant, mais sans type d'actif ni instrument
 * (si la table n'a aucune de ces deux colonnes, il n'y a pas d'objectif). Retourne { totals: Map(iso -> somme des relevés),
 * goals: [[timestamp, montant]] triés }.
 */
export function splitGoals(rows, dateColumn, valueColumn, labelColumns) {
  const totals = new Map()
  const goals = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    if (!iso) continue
    const value = toNumber(row[valueColumn])
    const isGoal = labelColumns.length > 0 && labelColumns.every((column) => !toLabel(row[column], ''))
    const target = isGoal ? goals : totals
    target.set(iso, (target.get(iso) ?? 0) + value)
  }
  return {
    totals,
    goals: [...goals.entries()]
      .filter(([, value]) => value > 0)
      .map(([iso, value]) => [isoToTimestamp(iso), Math.round(value)])
      .sort((a, b) => a[0] - b[0]),
  }
}

/** Montant de la ligne des objectifs (points reliés) à une date, ou null hors de leur période. */
function goalAt(goals, ts) {
  for (let i = 1; i < goals.length; i++) {
    const [t0, v0] = goals[i - 1]
    const [t1, v1] = goals[i]
    if (ts >= t0 && ts <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (ts - t0)) / (t1 - t0)
  }
  return goals.length === 1 && goals[0][0] === ts ? goals[0][1] : null
}

export function trendOption(points, trend, goals = []) {
  const first = points[0][0]
  const lastPoint = points[points.length - 1][0]
  // Avec des objectifs, la tendance est prolongée jusqu'au dernier d'entre eux pour comparer les deux
  const last = goals.length ? Math.max(lastPoint, goals[goals.length - 1][0]) : lastPoint
  const zoom = points.length > 24 || goals.length > 0
  const max = Math.max(...points.map(([, value]) => value), trend.at(last), ...goals.map(([, value]) => value))
  const byTimestamp = new Map(points)
  const legend = goals.length ? [BARS(), TREND(), GOALS()] : [BARS(), TREND()]

  return {
    ...baseOption(),
    grid: { left: 4, right: 12, top: 40, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(legend),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const item = [].concat(params).find((p) => p.seriesName === BARS() || p.seriesName === GOALS())
        if (!item) return ''
        const ts = item.value[0]
        const rows = []
        if (byTimestamp.has(ts)) rows.push({ color: PALE_BLUE, label: BARS(), value: euro(byTimestamp.get(ts)), strong: true })
        rows.push({ color: NAVY, label: TREND(), value: euro(trend.at(ts)) })
        const goal = goals.length ? goalAt(goals, ts) : null
        if (goal !== null) rows.push({ color: BLUE, label: GOALS(), value: euro(goal), strong: !byTimestamp.has(ts) })
        return tooltipHtml(formatDateLong(ts), rows)
      },
    }),
    xAxis: {
      type: 'time',
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS } },
      splitLine: { show: false },
      axisLabel: { ...axisLabelStyle, hideOverlap: true, formatter: (value) => formatMonthYear(value) },
    },
    yAxis: valueAxis(axisEuroFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      {
        name: BARS(),
        type: 'bar',
        data: points,
        barMinWidth: 3,
        barMaxWidth: 10,
        itemStyle: { color: PALE_BLUE, borderRadius: [2, 2, 0, 0] },
      },
      {
        name: TREND(),
        type: 'line',
        data: [
          [first, Math.round(trend.at(first))],
          [lastPoint, Math.round(trend.at(lastPoint))],
        ],
        showSymbol: false,
        silent: true,
        lineStyle: { width: 2, color: NAVY },
        itemStyle: { color: NAVY },
        z: 3,
      },
      ...(last > lastPoint
        ? [
            {
              // Prolongement de la tendance jusqu'au dernier objectif : en pointillés, ce n'est pas une donnée
              name: TREND(),
              type: 'line',
              data: [
                [lastPoint, Math.round(trend.at(lastPoint))],
                [last, Math.round(trend.at(last))],
              ],
              showSymbol: false,
              silent: true,
              lineStyle: { width: 2, color: NAVY, type: 'dashed' },
              itemStyle: { color: NAVY },
              z: 3,
            },
          ]
        : []),
      ...(goals.length
        ? [
            {
              name: GOALS(),
              type: 'line',
              data: goals,
              symbol: 'diamond',
              symbolSize: 11,
              lineStyle: { width: 2, color: BLUE, type: 'dotted' },
              itemStyle: { color: BLUE },
              z: 4,
            },
          ]
        : []),
    ],
  }
}

export default {
  slug: 'patrimoine-tendance',
  amounts: true, // suit le bouton Brut / Net (lib/amounts.js)
  get title() {
    return t('charts.trend.title')
  },
  get summary() {
    return t('charts.trend.summary')
  },
  table: '_history',
  minWidth: 720,
  get explain() {
    return tList('charts.trend.explain')
  },
  get source() {
    return t('charts.trend.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const valueColumn =
      findCurrencyColumn(table.columns, 'EUR') ?? findColumn(table.columns, ['Assets Master Currency'])
    if (!valueColumn) {
      throw new DataError(
        t('charts.trend.noColumn', {
          table: table?.name ?? '_history',
          available: (table?.columns ?? []).join(', ') || t('data.none'),
        }),
      )
    }

    const labelColumns = [findColumn(table.columns, ['Asset']), findColumn(table.columns, ['Instrument'])].filter(Boolean)
    const { totals, goals } = splitGoals(rowsOf(table), cols.date, valueColumn, labelColumns)
    const points = [...totals.entries()]
      .filter(([, value]) => value > 0)
      .map(([iso, value]) => [isoToTimestamp(iso), Math.round(value)])
      .sort((a, b) => a[0] - b[0])
    if (points.length < 2) return { empty: t('charts.trend.twoRecords') }

    const { slope, intercept } = linearTrend(points)
    const trend = { at: (ts) => slope * ts + intercept }
    const perYear = slope * DAY * 365.25
    const last = points[points.length - 1]
    const nextGoal = goals.find(([ts]) => ts > last[0]) ?? null
    const goalText = nextGoal
      ? ` ${t('charts.trend.nextGoal', { goal: euro(nextGoal[1]), date: formatDateLong(nextGoal[0]), projected: euro(trend.at(nextGoal[0])) })}`
      : ''

    return {
      subtitle: t('charts.flow.recordsUntil', { date: formatDateLong(last[0]) }),
      summary:
        t('charts.trend.a11y', {
          count: points.length,
          from: formatDateLong(points[0][0]),
          to: formatDateLong(last[0]),
          last: euro(last[1]),
          perYear: euro(perYear),
        }) + goalText,
      option: trendOption(points, trend, goals),
      height: 380,
      table: {
        columns: [t('chart.date'), t('chart.wealth'), t('charts.trend.trend'), t('charts.trend.goal')],
        numeric: [false, true, true, true],
        rows: [...points.map(([ts, value]) => ({ ts, value, goal: false })), ...goals.map(([ts, value]) => ({ ts, value, goal: true }))]
          .sort((a, b) => b.ts - a.ts)
          .map(({ ts, value, goal }) => [
            formatDateNumeric(ts),
            goal ? '' : euro(value),
            euro(trend.at(ts)),
            goal ? euro(value) : '',
          ]),
      },
      note:
        t('charts.trend.note', { column: valueColumn, perYear: euro(perYear) }) +
        (goals.length ? ` ${t('charts.trend.goalCount', { count: goals.length }, goals.length)}${goalText}` : ''),
    }
  },
}
