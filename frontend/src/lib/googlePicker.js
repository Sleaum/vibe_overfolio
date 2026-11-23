// Sélecteur de fichiers de Google (« Picker ») : mode 3 de la page GoogleSheet.
// La personne choisit sa feuille dans son Google Drive ; Overfolio n'a ensuite accès qu'à ce fichier (scope drive.file).
// Le jeton d'accès vient du serveur (GET /api/auth/google/picker-token/), valable une heure au plus.

const SCRIPT = 'https://apis.google.com/js/api.js'
let loading = null

function loadPickerApi() {
  loading ??= new Promise((resolve, reject) => {
    const fail = () => {
      loading = null // nouvel essai au prochain clic
      reject(new Error('picker_unavailable'))
    }
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => {
      if (!window.gapi?.load) return fail()
      window.gapi.load('picker', { callback: resolve, onerror: fail })
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Ouvre le sélecteur, limité aux feuilles Google Sheets.
 * Renvoie { id, name } de la feuille choisie, ou null si la personne ferme le sélecteur.
 */
export async function pickSpreadsheet({ accessToken, apiKey, appId, locale }) {
  await loadPickerApi()
  const { picker } = window.google
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS).setIncludeFolders(true).setMode(picker.DocsViewMode.LIST)
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setLocale(locale)
      .setOrigin(window.location.origin)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0]
          resolve(doc ? { id: doc.id, name: doc.name ?? '' } : null)
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
      .setVisible(true)
  })
}
