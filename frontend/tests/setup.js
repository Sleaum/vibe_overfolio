// Node expose `navigator.language` (souvent en-US) : sans ce réglage, la langue des messages dépendrait de la machine.
import { setLocale } from '../src/i18n/index.js'

setLocale('fr')
