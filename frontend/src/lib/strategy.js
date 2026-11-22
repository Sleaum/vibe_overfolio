// Page « Stratégie CTO » : sept anneaux à deux niveaux (secteur, moat, localisation, notation, business,
// place de cotation, instruments), calculés à partir de la table `portfolio`.
// Les attributs d'une action (secteur, moat, note…) peuvent aussi vivre dans la table `stock` : chaque attribut
// est cherché d'abord dans `portfolio`, puis dans `stock` (rattachée ligne à ligne par Ticker, Instrument ou Nom).
// Fonctions pures : testables sans navigateur. Seule « Assets Master Currency » est obligatoire ;
// un attribut introuvable n'empêche pas les autres anneaux de s'afficher, il est simplement signalé.

import { DataError, findColumn, latestDate, requireColumns, rowsOf, toLabel, toNumber } from './aggregate.js'
import { capitalize, countryName, euro, formatDateLong, percent } from './format.js'
import { CONTEXT, SERIES } from './palette.js'
import { countryCode } from './countries.js'
import { t } from '../i18n/index.js'

/** Les six attributs d'une action ; le premier nom de `names` est celui affiché quand la colonne manque. */
export const ATTRIBUTES = [
  { key: 'sector', get title() { return t('strategy.rings.sector') }, names: ['Sector', 'Secteur'] },
  { key: 'moat', get title() { return t('strategy.rings.moat') }, names: ['Moat', 'Avantage concurrentiel'] },
  { key: 'area', get title() { return t('strategy.rings.area') }, names: ['Area', 'Localisation', 'Pays', 'Country', 'Zone', 'Region', 'Région'] },
  {
    key: 'rating',
    get title() {
      return t('strategy.rings.rating')
    },
    names: ['Note SP Trié', 'Note SP Trie', 'Note SP', 'S&P Rating', 'SP Rating', 'Rating', 'Notation', 'Note'],
  },
  { key: 'business', get title() { return t('strategy.rings.business') }, names: ['Business', 'Business Model', 'Modèle', 'Modele'] },
  { key: 'exchange', get title() { return t('strategy.rings.exchange') }, names: ['Exchange', 'New Field', 'Place', 'Bourse', 'Place de cotation'] },
]

const INSTRUMENT_NAMES = ['Instrument', 'Instruments']
const ENVELOPE_NAMES = ['Envelope', 'Enveloppe', 'Account', 'Compte', 'Wrapper']
const ASSET_NAMES = ['Asset']
const TICKER_NAMES = ['Ticker', 'Symbol', 'Symbole']
// Colonnes qui servent à rattacher une ligne de portfolio à sa ligne de stock (la première qui se retrouve des deux côtés)
const JOIN_NAMES = [TICKER_NAMES, INSTRUMENT_NAMES, ['Name', 'Nom']]

export const VALUE_NAMES = ['Assets Master Currency']

export const MAX_CATEGORIES = 8 // au-delà, le reste est regroupé en « Autres (n) »
export const MAX_CHILDREN = 6 // anneau extérieur : par catégorie, les 6 plus gros puis « Autres (n) »
// Catégorie des lignes sans valeur, dans la langue active
export const UNKNOWN = () => t('data.unknown')
export const UNKNOWN_COLOR = '#c4c2bc' // couleur fixe : gris clair : se distingue du gris « Autres » (CONTEXT)

// Échelle des notes S&P, de la meilleure à la moins bonne : l'anneau « Note S&P » suit cet ordre plutôt que la taille
const RATING_SCALE = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D']

/** Rang d'une note dans l'échelle S&P (0 = AAA), ou null si ce n'est pas une note connue. */
export function ratingRank(name) {
  const index = RATING_SCALE.indexOf(String(name ?? '').trim().toUpperCase())
  return index < 0 ? null : index
}

/** « aa+ » -> « AA+ » pour une note connue ; sinon simple majuscule initiale. */
const ratingLabel = (text) => (ratingRank(text) === null ? capitalize(text) : String(text).trim().toUpperCase())

const EQUITY = new Set(['public equity', 'equity', 'equities', 'action', 'actions', 'stock', 'stocks'])
const MY_ENVELOPES = ['pea', 'cto'] // choix par défaut : « PEA et CTO »

const lower = (text) => String(text ?? '').trim().toLowerCase()

/** Éclaircit une couleur « #rrggbb » vers le blanc : amount 0 = inchangée, 1 = blanc. */
export function tint(hex, amount) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const mix = (channel) => Math.round(channel + (255 - channel) * amount)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Valeur d'une cellule, ou '' si elle est vide. */
const cell = (row, column) => (column ? toLabel(row?.[column], '') : '')

/** Place de cotation tirée d'un ticker « NYSE:KO » -> « NYSE » ; '' sans deux-points. */
export function exchangeFromTicker(ticker) {
  const text = String(ticker ?? '').trim()
  const colon = text.indexOf(':')
  return colon > 0 ? text.slice(0, colon).trim().toUpperCase() : ''
}

/**
 * Choisit la colonne qui relie `portfolio` à `stock` : la première, parmi Ticker / Instrument / Nom,
 * qui existe des deux côtés et dont au moins une valeur se retrouve. Renvoie null sinon.
 */
function findJoin(portfolio, stock) {
  if (!stock?.columns?.length) return null
  const portfolioRows = rowsOf(portfolio)
  const stockRows = rowsOf(stock)
  for (const names of JOIN_NAMES) {
    const left = findColumn(portfolio.columns, names)
    const right = findColumn(stock.columns, names)
    if (!left || !right) continue
    const lookup = new Map()
    for (const row of stockRows) {
      const key = lower(row[right])
      if (key && !lookup.has(key)) lookup.set(key, row)
    }
    const matches = portfolioRows.filter((row) => lookup.has(lower(row[left]))).length
    if (matches > 0) return { column: left, stockColumn: right, lookup, matches }
  }
  return null
}

/**
 * Pour chaque attribut, d'où vient sa valeur : portfolio, stock (via la jointure), ou le ticker pour la place de cotation.
 * Renvoie { getters: { key: (row) => texte|'' }, used: [texte], skipped: [{ title, tried }] }.
 */
function resolveAttributes(portfolio, stock, join) {
  const getters = {}
  const used = []
  const skipped = []
  const portfolioTicker = findColumn(portfolio.columns, TICKER_NAMES)
  const stockTicker = findColumn(stock?.columns, TICKER_NAMES)
  const stockRowOf = (row) => (join ? join.lookup.get(lower(row[join.column])) : undefined)

  for (const attr of ATTRIBUTES) {
    const inPortfolio = findColumn(portfolio.columns, attr.names)
    const inStock = join ? findColumn(stock.columns, attr.names) : null

    if (inPortfolio) {
      getters[attr.key] = (row) => cell(row, inPortfolio)
      used.push(t('strategy.used.column', { title: attr.title, column: inPortfolio }))
      continue
    }
    if (inStock) {
      getters[attr.key] = (row) => cell(stockRowOf(row), inStock)
      used.push(t('strategy.used.stock', { title: attr.title, column: inStock, join: join.column }))
      continue
    }
    if (attr.key === 'exchange') {
      // Pas de colonne : la place de cotation est le début du ticker (« NYSE:KO »), dans portfolio ou dans stock
      const tickerOf = (row) => cell(row, portfolioTicker) || cell(stockRowOf(row), stockTicker)
      const anyColon = rowsOf(portfolio).some((row) => exchangeFromTicker(tickerOf(row)))
      if (anyColon) {
        getters[attr.key] = (row) => exchangeFromTicker(tickerOf(row))
        used.push(t('strategy.used.ticker', { title: attr.title, column: portfolioTicker ?? stockTicker }))
        continue
      }
    }
    skipped.push({ title: attr.title, tried: attr.names[0] })
  }
  return { getters, used, skipped }
}

/** Montants par catégorie, avec le détail de l'anneau extérieur. `outerOf` peut valoir null (un seul anneau). */
function aggregate(rows, valueColumn, innerOf, outerOf) {
  const groups = new Map()
  for (const row of rows) {
    const value = toNumber(row[valueColumn])
    if (!(value > 0)) continue
    const name = innerOf(row) || UNKNOWN()
    const key = lower(name)
    const group = groups.get(key) ?? { name, value: 0, children: new Map() }
    group.value += value
    if (outerOf) {
      const childName = outerOf(row) || UNKNOWN()
      const childKey = lower(childName)
      const child = group.children.get(childKey) ?? { name: childName, value: 0 }
      child.value += value
      group.children.set(childKey, child)
    }
    groups.set(key, group)
  }
  const byValue = (a, b) => b.value - a.value || a.name.localeCompare(b.name, 'fr')
  return [...groups.values()].map((group) => ({ ...group, children: [...group.children.values()].sort(byValue) })).sort(byValue)
}

/** Fusionne des catégories en une seule (« Autres (n) »), détails compris. */
function mergeGroups(groups, name) {
  const children = new Map()
  for (const group of groups) {
    for (const child of group.children) {
      const key = lower(child.name)
      const merged = children.get(key) ?? { name: child.name, value: 0 }
      merged.value += child.value
      children.set(key, merged)
    }
  }
  return {
    name,
    value: groups.reduce((sum, group) => sum + group.value, 0),
    children: [...children.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'fr')),
  }
}

/** Les `limit` plus gros détails, le reste regroupé en « Autres (n) ». */
function topChildren(children, limit) {
  if (children.length <= limit) return children
  const rest = children.slice(limit)
  return [...children.slice(0, limit), { name: t('data.othersCount', { count: rest.length }), value: rest.reduce((sum, c) => sum + c.value, 0) }]
}

/**
 * Catégories prêtes à dessiner : les 8 plus grosses prennent les couleurs dans l'ordre fixe de la palette,
 * le reste va dans « Autres (n) » (gris), « Non renseigné » est toujours à la fin (gris clair).
 * Le détail de chaque catégorie est une nuance de sa couleur : plus on descend dans la liste, plus la nuance est claire.
 */
export function buildCategories(groups, total, labelOf = capitalize, rankOf = null) {
  const known = groups.filter((group) => lower(group.name) !== lower(UNKNOWN()))
  const unknown = groups.find((group) => lower(group.name) === lower(UNKNOWN()))

  // On garde les plus grosses ; si un ordre est donné (notes S&P), elles s'affichent dans cet ordre, les inconnues à la suite
  const shown = known.slice(0, MAX_CATEGORIES)
  const rest = known.slice(MAX_CATEGORIES)
  if (rankOf) {
    shown.sort((a, b) => {
      const ra = rankOf(a.name)
      const rb = rankOf(b.name)
      if (ra === rb) return 0 // égalité : l'ordre par taille est conservé (tri stable)
      if (ra === null) return 1
      if (rb === null) return -1
      return ra - rb
    })
  }
  const ordered = shown.map((group, index) => ({ group, name: labelOf(group.name), color: SERIES[index] }))
  if (rest.length) {
    const others = t('data.othersCount', { count: rest.length })
    ordered.push({ group: mergeGroups(rest, others), name: others, color: CONTEXT })
  }
  if (unknown) ordered.push({ group: unknown, name: UNKNOWN(), color: UNKNOWN_COLOR })

  return ordered.map(({ group, name, color }) => {
    const kids = topChildren(group.children, MAX_CHILDREN)
    return {
      name,
      value: group.value,
      share: group.value / total,
      color,
      // tableau : tous les détails ; anneau : au plus MAX_CHILDREN + « Autres »
      allChildren: group.children.map((child) => ({ name: child.name, value: child.value, share: child.value / total })),
      children: kids.map((child, index) => ({
        name: child.name,
        value: child.value,
        share: child.value / total,
        shareOfParent: child.value / group.value,
        color: tint(color, kids.length === 1 ? 0.3 : 0.25 + (0.4 * index) / (kids.length - 1)),
      })),
    }
  })
}

/** Texte du tableau d'un anneau : une ligne « Ensemble » par catégorie, puis ses détails, puis le total. */
function tableOf(title, detailTitle, categories, total) {
  if (!detailTitle) {
    return {
      columns: [title, t('chart.amount'), t('chart.shareOfTotal')],
      numeric: [false, true, true],
      rows: [...categories.map((c) => [c.name, euro(c.value), percent(c.share)]), [t('chart.total'), euro(total), percent(1)]],
    }
  }
  const rows = []
  for (const category of categories) {
    rows.push([category.name, t('strategy.all'), euro(category.value), percent(category.share)])
    for (const child of category.allChildren) rows.push([category.name, child.name, euro(child.value), percent(child.share)])
  }
  rows.push([t('chart.total'), '', euro(total), percent(1)])
  return { columns: [title, detailTitle, t('chart.amount'), t('chart.shareOfTotal')], numeric: [false, false, true, true], rows }
}

/** Choix proposés pour restreindre les lignes : toutes, « PEA et CTO » si les deux existent, puis chaque enveloppe. */
function buildScopes(rows, envelopeColumn, valueColumn) {
  if (!envelopeColumn) return []
  const totals = new Map()
  for (const row of rows) {
    const value = toNumber(row[valueColumn])
    if (!(value > 0)) continue
    const name = cell(row, envelopeColumn) || UNKNOWN()
    const key = lower(name)
    const entry = totals.get(key) ?? { name, value: 0 }
    entry.value += value
    totals.set(key, entry)
  }
  const envelopes = [...totals.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'fr'))
  if (envelopes.length < 2) return []

  const scopes = [{ value: 'all', label: t('strategy.scopes.all') }]
  if (MY_ENVELOPES.every((name) => totals.has(name))) scopes.push({ value: 'peacto', label: t('strategy.scopes.peacto') })
  for (const envelope of envelopes) scopes.push({ value: `env:${lower(envelope.name)}`, label: envelope.name })
  return scopes
}

function inScope(scope, envelope) {
  if (scope === 'all') return true
  if (scope === 'peacto') return MY_ENVELOPES.includes(lower(envelope))
  return `env:${lower(envelope)}` === scope
}

/**
 * Construit tout ce qu'affiche la page.
 * @param portfolio table `portfolio` de l'API
 * @param stock     table `stock` (ou null) : fournit les attributs absents de portfolio
 * @param scope     'all' | 'peacto' | 'env:<enveloppe>' | undefined (= choix par défaut)
 */
/**
 * Carte du monde : montant par pays d'après la colonne Area (la même que l'anneau « Localisation »), avec les actions
 * de chaque pays. Une valeur qui n'est pas un pays (« world », « europe »…) va dans `unplaced`.
 * Renvoie { total, countries: [{ code, name, value, share, items: [{ name, value }] }], unplaced: [{ name, value, share }] }.
 */
function buildWorldMap(rows, valueColumn, areaOf, instrumentOf) {
  const countries = new Map()
  const unplaced = new Map()
  let total = 0
  const add = (items, name, value) => {
    const key = lower(name)
    const item = items.get(key) ?? { name, value: 0 }
    item.value += value
    items.set(key, item)
  }
  for (const row of rows) {
    const value = toNumber(row[valueColumn])
    if (!(value > 0)) continue
    total += value
    const area = areaOf(row)
    const code = countryCode(area)
    if (!code) {
      add(unplaced, capitalize(area || UNKNOWN()), value)
      continue
    }
    const country = countries.get(code) ?? { code, name: countryName(code), value: 0, items: new Map() }
    country.value += value
    add(country.items, (instrumentOf && instrumentOf(row)) || UNKNOWN(), value)
    countries.set(code, country)
  }
  const byValue = (a, b) => b.value - a.value
  return {
    total,
    countries: [...countries.values()]
      .map((country) => ({ ...country, share: country.value / total, items: [...country.items.values()].sort(byValue) }))
      .sort(byValue),
    unplaced: [...unplaced.values()].map((item) => ({ ...item, share: item.value / total })).sort(byValue),
  }
}

export function buildStrategy(portfolio, stock = null, scope = undefined) {
  const cols = requireColumns(portfolio, { value: VALUE_NAMES })
  const allRows = rowsOf(portfolio)
  const notes = []

  // Les attributs (secteur, moat, note…) n'ont de sens que pour les actions
  const assetColumn = findColumn(portfolio.columns, ASSET_NAMES)
  let rows = allRows.filter((row) => toNumber(row[cols.value]) > 0)
  if (assetColumn) {
    const equities = rows.filter((row) => EQUITY.has(lower(row[assetColumn])))
    if (equities.length) {
      if (equities.length < rows.length) notes.push(t('strategy.notes.equityOnly'))
      rows = equities
    } else if (rows.length) {
      notes.push(t('strategy.notes.noEquity'))
    }
  }
  if (!rows.length) return { empty: t('strategy.empty.noRows') }

  // Enveloppe : sert au choix PEA / CTO et à l'anneau « Instruments »
  const envelopeColumn = findColumn(portfolio.columns, ENVELOPE_NAMES)
  const scopes = buildScopes(rows, envelopeColumn, cols.value)
  const defaultScope = scopes.some((s) => s.value === 'peacto') ? 'peacto' : 'all'
  const current = scopes.some((s) => s.value === scope) ? scope : defaultScope
  const scoped = scopes.length ? rows.filter((row) => inScope(current, cell(row, envelopeColumn) || UNKNOWN())) : rows
  if (!scoped.length) return { empty: t('strategy.empty.noScope'), scopes, scope: current }

  const join = findJoin(portfolio, stock)
  const { getters, used, skipped } = resolveAttributes(portfolio, stock, join)
  const instrumentColumn = findColumn(portfolio.columns, INSTRUMENT_NAMES)
  if (instrumentColumn) used.push(t('strategy.used.column', { title: t('strategy.instrument'), column: instrumentColumn }))
  else skipped.push({ title: t('strategy.rings.instruments'), tried: INSTRUMENT_NAMES[0] })
  if (envelopeColumn) used.push(t('strategy.used.column', { title: t('strategy.envelope'), column: envelopeColumn }))

  const instrumentOf = instrumentColumn ? (row) => cell(row, instrumentColumn) : null
  const envelopeOf = envelopeColumn ? (row) => cell(row, envelopeColumn) : null
  // « cto » -> « CTO » : les noms d'enveloppe courts sont des sigles
  const envelopeName = (text) => (String(text).trim().length <= 4 ? String(text).trim().toUpperCase() : capitalize(text))

  // Anneaux : les attributs d'abord, puis les instruments (détail = enveloppe)
  const defs = ATTRIBUTES.filter((attr) => getters[attr.key]).map((attr) => ({
    key: attr.key,
    title: attr.title,
    inner: getters[attr.key],
    outer: instrumentOf,
    detailTitle: instrumentOf ? t('strategy.instrument') : '',
    labelOf: attr.key === 'rating' ? ratingLabel : capitalize,
    rankOf: attr.key === 'rating' ? ratingRank : null,
  }))
  // Anneau « Instruments » : les enveloppes au centre (CTO, PEA…), les instruments autour, comme les autres anneaux
  // (catégorie au centre, instruments autour). Sans colonne d'enveloppe : les instruments seuls.
  if (instrumentOf) {
    defs.push(
      envelopeOf
        ? {
            key: 'instrument',
            title: t('strategy.rings.instruments'),
            innerTitle: t('strategy.envelope'),
            inner: envelopeOf,
            outer: instrumentOf,
            detailTitle: t('strategy.instrument'),
            labelOf: envelopeName,
          }
        : {
            key: 'instrument',
            title: t('strategy.rings.instruments'),
            inner: instrumentOf,
            outer: null,
            detailTitle: '',
            labelOf: (text) => text, // les noms d'instruments gardent leur graphie
          },
    )
  }

  if (!defs.length) {
    const columns = (table) => (table?.columns?.length ? table.columns.join(', ') : t('data.none'))
    throw new DataError(
      t('strategy.errors.noAttribute', {
        portfolio: columns(portfolio),
        stock: stock ? columns(stock) : t('strategy.errors.noTable'),
      }),
    )
  }

  const charts = defs.map((def) => {
    const groups = aggregate(scoped, cols.value, def.inner, def.outer)
    const total = groups.reduce((sum, group) => sum + group.value, 0)
    const categories = buildCategories(groups, total, def.labelOf, def.rankOf)
    const biggest = categories.find((c) => c.name !== UNKNOWN()) ?? categories[0]
    const named = categories.filter((c) => c.name !== UNKNOWN()).length
    return {
      key: def.key,
      title: def.title,
      innerTitle: def.innerTitle ?? def.title, // nom de l'anneau intérieur (Enveloppe pour l'anneau Instruments)
      detailTitle: def.detailTitle,
      total,
      categories,
      unknownShare: categories.find((c) => c.name === UNKNOWN())?.share ?? 0,
      subtitle: [
        euro(total),
        t('strategy.categories', { count: named }, named),
        def.detailTitle ? t('strategy.detail', { detail: def.detailTitle.toLowerCase() }) : '',
      ]
        .filter(Boolean)
        .join(' · '),
      summary: t(def.detailTitle ? 'strategy.a11yDouble' : 'strategy.a11ySingle', {
        title: def.title.toLowerCase(),
        parts: t('strategy.parts', { count: categories.length }, categories.length),
        total: euro(total),
        biggest: biggest.name,
        share: percent(biggest.share),
      }),
      legend: categories.map((c) => ({ name: c.name, color: c.color, amount: euro(c.value), share: percent(c.share) })),
      table: tableOf(def.innerTitle ?? def.title, def.detailTitle, categories, total),
    }
  })

  if (join) {
    const matched = rows.filter((row) => join.lookup.has(lower(row[join.column]))).length
    notes.push(t('strategy.notes.joined', { column: join.column, matched, total: rows.length }))
  } else if (stock?.columns?.length) {
    notes.push(t('strategy.notes.notJoined'))
  }

  const dateColumn = findColumn(portfolio.columns, ['Date'])
  const asOf = dateColumn ? latestDate(allRows, dateColumn) : ''

  return {
    asOf,
    subtitle: asOf ? t('strategy.positionsAt', { date: formatDateLong(asOf) }) : t('strategy.subtitleDefault'),
    scopes,
    scope: current,
    scopeLabel: scopes.find((s) => s.value === current)?.label ?? '',
    charts,
    // Carte du monde (colonne Area) : null sans cette colonne
    map: getters.area ? buildWorldMap(scoped, cols.value, getters.area, instrumentOf) : null,
    skipped,
    usedColumns: used,
    notes,
  }
}
