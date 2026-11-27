import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tables simulées : useTable(nom) renvoie la table de ce nom, que chaque test remplit à la main
const fakeTables = new Map()
const fakeTable = () => ({ data: ref(null), error: ref(null), loading: ref(false), reload: vi.fn() })
vi.mock('../src/composables/useTable.js', () => ({
  useTable: vi.fn((source, options) => {
    const name = typeof source === 'function' ? source() : source
    const table = fakeTable()
    table.options = options
    fakeTables.set(name, table)
    return table
  }),
}))

const { usePageModel } = await import('../src/composables/usePageModel.js')
const { useTable } = await import('../src/composables/useTable.js')
const { DataError } = await import('../src/lib/aggregate.js')

const PORTFOLIO = { name: 'portfolio', columns: ['Asset'], rows: [{ Asset: 'fiat' }] }
const HISTORY = { name: 'history', columns: ['Date'], rows: [] }
const table = (name) => fakeTables.get(name)

beforeEach(() => fakeTables.clear())
afterEach(() => vi.restoreAllMocks())

describe('chargement', () => {
  it('« loading » tant qu’une table obligatoire n’a pas répondu', () => {
    const build = vi.fn(() => ({}))
    const page = usePageModel({ required: ['portfolio'], build })
    expect(page.status.value).toBe('loading')
    expect(page.model.value).toBeNull()
    expect(build).not.toHaveBeenCalled()
  })

  it('« ready » une fois la table là, avec le modèle construit', () => {
    const page = usePageModel({ required: ['portfolio'], build: ({ portfolio }) => ({ count: portfolio.rows.length }) })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('ready')
    expect(page.model.value).toEqual({ count: 1 })
    expect(page.error.value).toBeNull()
  })

  it('« empty » quand le modèle dit qu’il n’y a rien à afficher', () => {
    const page = usePageModel({ required: ['portfolio'], build: () => ({ empty: 'Aucun montant.' }) })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('empty')
  })
})

describe('table obligatoire illisible', () => {
  it('404 : « error » et missingTable', () => {
    const page = usePageModel({ required: ['portfolio'], build: () => ({}) })
    table('portfolio').error.value = { message: 'Table introuvable', status: 404 }
    expect(page.status.value).toBe('error')
    expect(page.missingTable.value).toBe(true)
    expect(page.error.value).toEqual({ message: 'Table introuvable', status: 404 })
  })

  it('autre erreur : « error » sans missingTable', () => {
    const page = usePageModel({ required: ['portfolio'], build: () => ({}) })
    table('portfolio').error.value = { message: 'Serveur indisponible', status: 502 }
    expect(page.status.value).toBe('error')
    expect(page.missingTable.value).toBe(false)
  })

  it('l’erreur d’une table obligatoire l’emporte sur l’attente d’une autre', () => {
    const page = usePageModel({ required: ['portfolio', 'stock'], build: () => ({}) })
    table('stock').error.value = { message: 'Erreur', status: 500 }
    expect(page.status.value).toBe('error')
  })

  it('Réessayer relit les tables obligatoires seulement', async () => {
    const page = usePageModel({ required: ['portfolio'], optional: ['history'], build: () => ({}) })
    await page.reload()
    expect(table('portfolio').reload).toHaveBeenCalledTimes(1)
    expect(table('history').reload).not.toHaveBeenCalled()
  })
})

describe('erreurs pendant la construction', () => {
  it('DataError : « problem » avec son message, rien en console', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = usePageModel({
      required: ['portfolio'],
      build: () => {
        throw new DataError('Colonne Asset introuvable.')
      },
    })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('problem')
    expect(page.model.value).toEqual({ problem: 'Colonne Asset introuvable.' })
    expect(log).not.toHaveBeenCalled()
  })

  it('autre erreur : « problem » avec le texte choisi, et l’erreur en console (c’est un bug)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = usePageModel({
      required: ['portfolio'],
      failedKey: 'chartUi.buildFailed',
      build: () => {
        throw new TypeError('x is undefined')
      },
    })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('problem')
    expect(page.model.value.problem).toBe('Le graphique n’a pas pu être construit (x is undefined).')
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('texte par défaut : celui d’une page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const page = usePageModel({
      required: ['portfolio'],
      build: () => {
        throw new Error('boum')
      },
    })
    table('portfolio').data.value = PORTFOLIO
    expect(page.model.value.problem).toBe('La page n’a pas pu être construite (boum).')
  })
})

describe('tables facultatives', () => {
  it('sans attente : construite tout de suite, la table absente vaut null, puis reconstruite à son arrivée', () => {
    const build = vi.fn(({ portfolio, history }) => ({ withHistory: Boolean(history), portfolio: portfolio.name }))
    const page = usePageModel({ required: ['portfolio'], optional: ['history'], build })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('ready')
    expect(page.model.value).toEqual({ withHistory: false, portfolio: 'portfolio' })
    table('history').data.value = HISTORY
    expect(page.model.value.withHistory).toBe(true)
  })

  it('avec attente : « loading » jusqu’à la réponse de la table facultative', () => {
    const page = usePageModel({ required: ['portfolio'], optional: ['stock'], waitOptional: true, build: () => ({}) })
    table('portfolio').data.value = PORTFOLIO
    expect(page.status.value).toBe('loading')
    table('stock').data.value = { name: 'stock', columns: [], rows: [] }
    expect(page.status.value).toBe('ready')
  })

  it('table facultative absente (404) : la page s’affiche quand même, sans elle', () => {
    const build = vi.fn(({ stock }) => ({ stock }))
    const page = usePageModel({ required: ['portfolio'], optional: ['stock'], waitOptional: true, build })
    table('portfolio').data.value = PORTFOLIO
    table('stock').error.value = { message: 'Table introuvable', status: 404 }
    expect(page.status.value).toBe('ready')
    expect(page.model.value).toEqual({ stock: null })
    expect(page.missingTable.value).toBe(false) // seule une table obligatoire absente compte
  })
})

describe('façons de donner une table', () => {
  it('par son nom : useTable(nom), table exposée dans tables', () => {
    const page = usePageModel({ required: ['portfolio'], optional: ['history'], build: () => ({}) })
    expect(Object.keys(page.tables)).toEqual(['portfolio', 'history'])
    expect(page.tables.portfolio).toBe(table('portfolio'))
  })

  it('par une source et des options de useTable (ChartView)', () => {
    const spec = { table: 'history' }
    usePageModel({ required: [{ name: 'chart', source: () => spec.table, projection: true }], build: () => ({}) })
    expect(useTable).toHaveBeenLastCalledWith(expect.any(Function), { projection: true })
  })

  it('déjà chargée ailleurs (ChartCard) : aucun useTable', () => {
    useTable.mockClear()
    const shared = fakeTable()
    const page = usePageModel({ required: [{ name: 'chart', table: shared }], build: ({ chart }) => ({ rows: chart.rows.length }) })
    expect(useTable).not.toHaveBeenCalled()
    shared.data.value = PORTFOLIO
    expect(page.model.value).toEqual({ rows: 1 })
  })
})
