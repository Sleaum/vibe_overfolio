// Bouton PDF de l'en-tête : tout le site en un seul PDF, une page web = une page PDF, à sa taille réelle.
//
// Le site parcourt lui-même chaque page (SITE_PAGES), attend qu'elle soit chargée, la photographie en entier telle
// qu'elle s'affiche (html2canvas : mise en page, couleurs et mode sombre gardés, largeur de la fenêtre), puis l'ajoute
// au PDF (jsPDF) sur une page de la même taille : pas de découpage en A4. À la fin, le fichier est téléchargé et la page
// de départ revient. Tout se passe dans le navigateur : rien n'est envoyé au serveur.
// Les deux bibliothèques ne sont chargées qu'au clic. Pendant l'export, les graphiques ne sont pas animés (BaseChart.vue)
// et le bandeau de progression (PdfProgress.vue, data-pdf-ignore) n'apparaît pas dans le PDF.

import { nextTick, reactive } from 'vue'
import { allCharts } from './charts/index.js'

/** Toutes les pages du site, dans l'ordre des menus ; les pages de chaque graphique à la suite de Charts. */
export function sitePages() {
  return [
    '/',
    '/sheet',
    '/portfolio-flow',
    '/portfolio-snapshot',
    '/enveloppes',
    '/strategie',
    '/volatilite',
    ...allCharts().map((chart) => `/graphiques/${chart.slug}`), // Volatility : les périodes choisies
    '/simulation',
    '/modeles',
    '/newpage',
  ]
}

/** État de l'export, lu par le bouton de l'en-tête et le bandeau de progression. */
export const pdfExport = reactive({ running: false, done: 0, total: 0, page: '', error: '', cancelled: false })

const TIMEOUT = 25_000 // une page qui ne finit pas de charger est photographiée quand même
const STABLE = 900 // plus rien en chargement pendant ce temps : les graphiques ont fini de se dessiner
const SCALE = 1.5 // netteté de l'image (1,5 pixel par pixel de la page)
const PT = 0.75 // 1 pixel CSS = 0,75 point PDF

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Attend que la page n'ait plus aucun élément « chargement » (role="status" dans le contenu) pendant STABLE ms. */
async function pageReady() {
  const start = Date.now()
  let calmSince = 0
  while (Date.now() - start < TIMEOUT) {
    const main = document.getElementById('contenu')
    const busy = !main?.childElementCount || main.querySelector('[role="status"]')
    if (busy) calmSince = 0
    else if (!calmSince) calmSince = Date.now()
    else if (Date.now() - calmSince >= STABLE) return
    await wait(200)
  }
}

/** Photographie de toute la page (pas seulement la partie visible). */
async function capture(html2canvas) {
  window.scrollTo(0, 0)
  await nextTick()
  const root = document.getElementById('app')
  const width = document.documentElement.clientWidth
  const height = Math.max(root.scrollHeight, document.documentElement.clientHeight)
  return html2canvas(root, {
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    scale: SCALE,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    useCORS: true,
    logging: false,
    ignoreElements: (node) => node.hasAttribute?.('data-pdf-ignore'),
    // html2canvas dessine le contenu des blocs repliés (<details> fermés, questions fréquentes de l'accueil) :
    // dans la copie photographiée, seul leur titre reste, comme à l'écran
    onclone: (doc) => {
      for (const details of doc.querySelectorAll('details:not([open])')) {
        for (const child of [...details.children]) if (child.tagName !== 'SUMMARY') child.remove()
      }
    },
  })
}

/** Lance l'export ; `router` : le routeur de l'application. */
export async function exportSite(router) {
  if (pdfExport.running) return
  const back = router.currentRoute.value.fullPath
  const pages = sitePages()
  Object.assign(pdfExport, { running: true, done: 0, total: pages.length, page: '', error: '', cancelled: false })
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    let pdf = null
    for (const path of pages) {
      if (pdfExport.cancelled) break
      pdfExport.page = path
      await router.push(path)
      await pageReady()
      const canvas = await capture(html2canvas)
      const width = (canvas.width / SCALE) * PT
      const height = (canvas.height / SCALE) * PT
      const orientation = width > height ? 'landscape' : 'portrait'
      if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [width, height], orientation, compress: true })
      else pdf.addPage([width, height], orientation)
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, width, height, undefined, 'FAST')
      pdfExport.done += 1
    }
    if (pdf && !pdfExport.cancelled) pdf.save(`Overfolio ${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (err) {
    console.error(err)
    pdfExport.error = err?.message || String(err)
  } finally {
    pdfExport.running = false
    await router.push(back).catch(() => {})
  }
}
