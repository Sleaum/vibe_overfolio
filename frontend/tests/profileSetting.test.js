import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/api.js', async (importOriginal) => ({ ...(await importOriginal()), saveProfile: vi.fn() }))

const { saveProfile } = await import('../src/lib/api.js')
const { session } = await import('../src/lib/auth.js')
const { createProfileSetting } = await import('../src/lib/profileSetting.js')

/** Promesse réglée à la main : une réponse du serveur qui arrive quand le test le décide. */
function later() {
  let resolve, reject
  const promise = new Promise((ok, ko) => {
    resolve = ok
    reject = ko
  })
  return { promise, resolve, reject }
}

/** Laisse partir ce qui attend (deux clics sont deux événements : la requête du premier part entre les deux). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

const stored = new Map()

beforeEach(() => {
  saveProfile.mockReset()
  saveProfile.mockResolvedValue({})
  session.authenticated = false
  stored.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key) => (stored.has(key) ? stored.get(key) : null),
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key),
  })
})

// Réglage de test : une liste de nombres, [] par défaut, enregistrée telle quelle
const numbers = (options = {}) =>
  createProfileSetting({
    field: 'numbers',
    default: () => [],
    validate: (raw) => (Array.isArray(raw) && raw.every(Number.isInteger) ? raw : null),
    ...options,
  })

// Réglage gardé aussi par le navigateur, enregistré sur le profil seulement pour un compte connecté
const mode = () =>
  createProfileSetting({
    field: 'theme',
    preference: 'theme',
    default: '',
    validate: (raw) => (['', 'light', 'dark'].includes(raw) ? raw : null),
    toPreference: (value) => value,
    onlyWhenSignedIn: true,
  })

describe('set : succès', () => {
  it('affiche tout de suite, puis enregistre la valeur sur le profil', async () => {
    const setting = numbers({ serialize: (list) => ({ list }) })
    const pending = setting.set([1, 2])
    expect(setting.value.value).toEqual([1, 2]) // avant la réponse du serveur
    expect(await pending).toBe(true)
    expect(saveProfile).toHaveBeenCalledWith({ numbers: { list: [1, 2] } })
    expect(setting.error.value).toBe('')
  })

  it('refuse une valeur non valable sans rien changer ni envoyer', async () => {
    const setting = numbers()
    expect(await setting.set(['x'])).toBe(false)
    expect(setting.value.value).toEqual([])
    expect(saveProfile).not.toHaveBeenCalled()
  })

  it('n’envoie rien si la valeur ne change pas', async () => {
    const setting = numbers()
    expect(await setting.set([])).toBe(true)
    expect(saveProfile).not.toHaveBeenCalled()
  })
})

describe('set : refus du serveur', () => {
  it('revient à la dernière valeur confirmée et donne le message', async () => {
    const setting = numbers()
    await setting.set([1])
    saveProfile.mockRejectedValueOnce(new Error('Périodes non valables'))
    expect(await setting.set([1, 2])).toBe(false)
    expect(setting.value.value).toEqual([1])
    expect(setting.error.value).toBe('Périodes non valables')
  })

  it('remet aussi la préférence du navigateur', async () => {
    session.authenticated = true
    const setting = mode()
    await setting.set('dark')
    expect(stored.get('overfolio-theme')).toBe('dark')
    saveProfile.mockRejectedValueOnce(new Error('Réseau'))
    await setting.set('light')
    expect(setting.value.value).toBe('dark')
    expect(stored.get('overfolio-theme')).toBe('dark')
  })

  it('le choix suivant efface le message d’erreur', async () => {
    const setting = numbers()
    saveProfile.mockRejectedValueOnce(new Error('Réseau'))
    await setting.set([1])
    expect(setting.error.value).toBe('Réseau')
    await setting.set([2])
    expect(setting.error.value).toBe('')
  })
})

describe('set : changements rapprochés', () => {
  it('deux changements rapides dont le premier échoue : le second reste, sans erreur', async () => {
    const setting = numbers()
    const first = later()
    saveProfile.mockReturnValueOnce(first.promise).mockResolvedValueOnce({})
    const a = setting.set([1])
    await tick()
    const b = setting.set([2])
    expect(setting.value.value).toEqual([2])
    first.reject(new Error('Réseau'))
    expect(await a).toBe(false)
    expect(await b).toBe(true)
    expect(setting.value.value).toEqual([2]) // pas de retour à [] : un choix plus récent a suivi
    expect(setting.error.value).toBe('')
    expect(saveProfile.mock.calls.map(([body]) => body.numbers)).toEqual([[1], [2]]) // dans l'ordre, l'un après l'autre
  })

  it('un choix remplacé avant son envoi n’est pas envoyé', async () => {
    const setting = numbers()
    const first = later()
    saveProfile.mockReturnValueOnce(first.promise)
    const results = [setting.set([1])]
    await tick()
    results.push(setting.set([2]), setting.set([3]))
    await tick()
    expect(saveProfile).toHaveBeenCalledTimes(1) // [2] et [3] attendent la réponse pour [1]
    first.resolve({})
    await Promise.all(results)
    expect(saveProfile.mock.calls.map(([body]) => body.numbers)).toEqual([[1], [3]])
    expect(setting.value.value).toEqual([3])
  })

  it('deux choix dans le même instant : seul le dernier part', async () => {
    const setting = numbers()
    await Promise.all([setting.set([1]), setting.set([2])])
    expect(saveProfile.mock.calls.map(([body]) => body.numbers)).toEqual([[2]])
  })

  it('le refus du dernier choix revient à la dernière valeur que le serveur a acceptée', async () => {
    const setting = numbers()
    await setting.set([1]) // accepté
    const second = later()
    saveProfile.mockReturnValueOnce(second.promise).mockRejectedValueOnce(new Error('Refusé'))
    const b = setting.set([2])
    await tick()
    const c = setting.set([3])
    second.resolve({}) // [2] accepté
    await b
    await c // [3] refusé
    expect(setting.value.value).toEqual([2])
  })
})

describe('applyProfile', () => {
  it('prend la valeur du profil, ou la valeur par défaut s’il est vide', async () => {
    const setting = numbers()
    await setting.applyProfile({ numbers: [4] })
    expect(setting.value.value).toEqual([4])
    await setting.applyProfile({})
    expect(setting.value.value).toEqual([])
  })

  it('un enregistrement en cours ne revient pas sur le profil appliqué entre-temps', async () => {
    const setting = numbers()
    const pending = later()
    saveProfile.mockReturnValueOnce(pending.promise)
    const result = setting.set([1])
    await tick()
    await setting.applyProfile({ numbers: [9] }) // connexion ou déconnexion pendant l'enregistrement
    pending.reject(new Error('Réseau'))
    await result
    expect(setting.value.value).toEqual([9])
    expect(setting.error.value).toBe('')
  })

  it('efface le message d’erreur', async () => {
    const setting = numbers()
    saveProfile.mockRejectedValueOnce(new Error('Réseau'))
    await setting.set([1])
    await setting.applyProfile({ numbers: [1] })
    expect(setting.error.value).toBe('')
  })
})

describe('réglage gardé par le navigateur, sur le profil pour un compte connecté', () => {
  it('part de la préférence du navigateur', () => {
    stored.set('overfolio-theme', 'dark')
    expect(mode().value.value).toBe('dark')
  })

  it('visiteur : gardé par le navigateur seulement, le profil du site ne décide pas', async () => {
    const setting = mode()
    expect(await setting.set('dark')).toBe(true)
    expect(saveProfile).not.toHaveBeenCalled()
    expect(stored.get('overfolio-theme')).toBe('dark')
    await setting.applyProfile({ theme: 'light' }, { authenticated: false })
    expect(setting.value.value).toBe('dark')
  })

  it('valeur par défaut : la préférence est effacée', async () => {
    const setting = mode()
    await setting.set('dark')
    await setting.set('')
    expect(stored.has('overfolio-theme')).toBe(false)
  })

  it('compte connecté : le profil décide', async () => {
    stored.set('overfolio-theme', 'dark')
    const setting = mode()
    await setting.applyProfile({ theme: 'light' }, { authenticated: true })
    expect(setting.value.value).toBe('light')
    expect(stored.get('overfolio-theme')).toBe('light')
  })

  it('première connexion, profil vide : il reprend le choix du navigateur', async () => {
    stored.set('overfolio-theme', 'dark')
    const setting = mode()
    await setting.applyProfile({ theme: '' }, { authenticated: true, firstLogin: true })
    expect(saveProfile).toHaveBeenCalledWith({ theme: 'dark' })
    expect(setting.value.value).toBe('dark')
  })

  it('première connexion, profil déjà réglé : le profil gagne, rien n’est envoyé', async () => {
    stored.set('overfolio-theme', 'dark')
    const setting = mode()
    await setting.applyProfile({ theme: 'light' }, { authenticated: true, firstLogin: true })
    expect(saveProfile).not.toHaveBeenCalled()
    expect(setting.value.value).toBe('light')
  })

  it('connexion suivante, profil vide : la valeur par défaut, le navigateur ne décide plus', async () => {
    stored.set('overfolio-theme', 'dark')
    const setting = mode()
    await setting.applyProfile({ theme: '' }, { authenticated: true, firstLogin: false })
    expect(saveProfile).not.toHaveBeenCalled()
    expect(setting.value.value).toBe('')
  })
})
