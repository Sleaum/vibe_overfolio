// Portfolio Flow : patrimoine en euros à chaque relevé (barres), sa tendance (droite des moindres carrés) et tes objectifs.
// Table `_history` : une colonne « EUR » si elle existe, sinon Assets Master Currency.
// Une ligne sans type d'actif ni instrument (seulement une date et un montant) est un objectif, pas un relevé :
// elle est tracée à part (points reliés en pointillés) et n'entre ni dans les barres ni dans la tendance.

import { DataError, findColumn, requireColumns, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { axisLabelStyle, baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatDateLong, formatDateNumeric, formatMonthYear } from '../format.js'
import { AXIS, SERIES } from '../palette.js'
import { isoToTimestamp, toIsoDate } from '../dates.js'
import { findCurrencyColumn, linearTrend } from './flowData.js'

const DAY = 86_400_000
const BARS = 'Patrimoine en euros'
const TREND = 'Tendance'
const GOALS = 'Objectifs'

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
  const legend = goals.length ? [BARS, TREND, GOALS] : [BARS, TREND]

  return {
    ...baseOption(),
    grid: { left: 4, right: 12, top: 40, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(legend),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const item = [].concat(params).find((p) => p.seriesName === BARS || p.seriesName === GOALS)
        if (!item) return ''
        const ts = item.value[0]
        const rows = []
        if (byTimestamp.has(ts)) rows.push({ color: SERIES[0], label: BARS, value: euro(byTimestamp.get(ts)), strong: true })
        rows.push({ color: SERIES[2], label: TREND, value: euro(trend.at(ts)) })
        const goal = goals.length ? goalAt(goals, ts) : null
        if (goal !== null) rows.push({ color: SERIES[1], label: GOALS, value: euro(goal), strong: !byTimestamp.has(ts) })
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
        name: BARS,
        type: 'bar',
        data: points,
        barMinWidth: 3,
        barMaxWidth: 10,
        itemStyle: { color: SERIES[0], borderRadius: [2, 2, 0, 0] },
      },
      {
        name: TREND,
        type: 'line',
        data: [
          [first, Math.round(trend.at(first))],
          [lastPoint, Math.round(trend.at(lastPoint))],
        ],
        showSymbol: false,
        silent: true,
        lineStyle: { width: 2, color: SERIES[2] },
        itemStyle: { color: SERIES[2] },
        z: 3,
      },
      ...(last > lastPoint
        ? [
            {
              // Prolongement de la tendance jusqu'au dernier objectif : en pointillés, ce n'est pas une donnée
              name: TREND,
              type: 'line',
              data: [
                [lastPoint, Math.round(trend.at(lastPoint))],
                [last, Math.round(trend.at(last))],
              ],
              showSymbol: false,
              silent: true,
              lineStyle: { width: 2, color: SERIES[2], type: 'dashed' },
              itemStyle: { color: SERIES[2] },
              z: 3,
            },
          ]
        : []),
      ...(goals.length
        ? [
            {
              name: GOALS,
              type: 'line',
              data: goals,
              symbol: 'diamond',
              symbolSize: 11,
              lineStyle: { width: 2, color: SERIES[1], type: 'dotted' },
              itemStyle: { color: SERIES[1] },
              z: 4,
            },
          ]
        : []),
    ],
  }
}

export default {
  slug: 'patrimoine-tendance',
  title: 'Patrimoine et tendance',
  summary: 'Ton patrimoine en euros à chaque relevé, avec la droite de tendance.',
  table: '_history',
  minWidth: 720,
  explain: [
    'Chaque barre est le total de tes actifs en euros à la date d’un relevé. La droite est la tendance moyenne de tous les relevés : elle montre le rythme de croissance passé.',
    'Les losanges orange sont tes objectifs : dans la table _history, ce sont les lignes qui n’ont qu’une date et un montant (ni type d’actif, ni instrument). La tendance est prolongée en pointillés jusqu’au dernier objectif : si elle passe au-dessus d’un losange, ton rythme actuel suffit pour l’atteindre.',
    'Les objectifs étirent l’axe du temps : le curseur du bas permet de zoomer sur les relevés.',
  ],
  source:
    'Table _history, colonne Date et colonne de montants en euros (EUR, sinon Assets Master Currency), additionnées par date. Les lignes sans Asset ni Instrument sont des objectifs.',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const valueColumn =
      findCurrencyColumn(table.columns, 'EUR') ?? findColumn(table.columns, ['Assets Master Currency'])
    if (!valueColumn) {
      throw new DataError(
        `Colonne de montants en euros introuvable dans la table « ${table?.name ?? '_history'} » : EUR ou Assets Master Currency. ` +
          `Colonnes disponibles : ${(table?.columns ?? []).join(', ') || 'aucune'}.`,
      )
    }

    const labelColumns = [findColumn(table.columns, ['Asset']), findColumn(table.columns, ['Instrument'])].filter(Boolean)
    const { totals, goals } = splitGoals(rowsOf(table), cols.date, valueColumn, labelColumns)
    const points = [...totals.entries()]
      .filter(([, value]) => value > 0)
      .map(([iso, value]) => [isoToTimestamp(iso), Math.round(value)])
      .sort((a, b) => a[0] - b[0])
    if (points.length < 2) return { empty: 'Il faut au moins deux relevés dans la table _history pour tracer une tendance.' }

    const { slope, intercept } = linearTrend(points)
    const trend = { at: (ts) => slope * ts + intercept }
    const perYear = slope * DAY * 365.25
    const last = points[points.length - 1]
    const nextGoal = goals.find(([ts]) => ts > last[0]) ?? null
    const goalText = nextGoal
      ? ` Prochain objectif : ${euro(nextGoal[1])} au ${formatDateLong(nextGoal[0])} ; au rythme de la tendance, tu serais à ${euro(trend.at(nextGoal[0]))}.`
      : ''

    return {
      subtitle: `Relevés jusqu’au ${formatDateLong(last[0])}.`,
      summary:
        `Patrimoine en euros sur ${points.length} relevés, du ${formatDateLong(points[0][0])} au ${formatDateLong(last[0])}. ` +
        `Dernier relevé : ${euro(last[1])}. La tendance est de ${euro(perYear)} par an.${goalText}`,
      option: trendOption(points, trend, goals),
      height: 380,
      table: {
        columns: ['Date', 'Patrimoine', 'Tendance', 'Objectif'],
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
        `Colonne utilisée : ${valueColumn}. Tendance : ${euro(perYear)} par an en moyenne.` +
        (goals.length ? ` ${goals.length} objectif${goals.length > 1 ? 's' : ''} (lignes sans Asset ni Instrument).${goalText}` : ''),
    }
  },
}
