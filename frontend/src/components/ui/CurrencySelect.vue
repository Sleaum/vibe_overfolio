<!--
  Devise d'affichage des pages Charts et Simulation (en-tête, entre le menu et le bouton PDF ; dans le menu burger
  sur mobile). Menu natif du navigateur, accessible au clavier et aux lecteurs d'écran : la liste donne le code et le
  nom de chaque devise dans la langue active ; fermé, le menu ne montre que le code (texte posé par-dessus le menu
  rendu transparent). Liste, choix et enregistrement : lib/displayCurrency.js.
-->
<template>
  <div
    class="relative inline-flex h-11 items-center"
    :class="variant === 'mobile' ? 'w-full justify-between rounded-lg px-3 hover:bg-wash' : ''"
    :title="t('displayCurrency.title')"
  >
    <span v-if="variant === 'mobile'" class="text-base font-medium text-ink-2" aria-hidden="true">{{ t('displayCurrency.label') }}</span>
    <!-- Ce qui se voit : icône pièces et code ; le menu transparent est posé dessus et reçoit le clic et le clavier -->
    <span
      class="pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.9375rem] font-medium tabular-nums text-ink-2 transition-colors has-[+select:hover]:bg-wash"
      :class="focused ? 'outline outline-2 outline-offset-2 outline-accent-ring' : ''"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="9" cy="7" rx="6" ry="3" />
        <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
        <path d="M9 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3" />
      </svg>
      {{ displayCurrency }}
    </span>
    <select
      :value="displayCurrency"
      :aria-label="t('displayCurrency.label')"
      data-testid="display-currency"
      class="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      @change="setDisplayCurrency($event.target.value)"
      @focus="focused = isKeyboard()"
      @blur="focused = false"
    >
      <option v-for="item in options" :key="item.code" :value="item.code">{{ item.code }} · {{ item.name }}</option>
    </select>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { intlLocale } from '../../i18n/index.js'
import { currencyList, displayCurrency, setDisplayCurrency } from '../../lib/displayCurrency.js'

defineProps({
  variant: { type: String, default: 'header' }, // 'header' (en-tête) ou 'mobile' (menu burger)
})

const { t, locale } = useI18n()

// Le menu est transparent : son contour de focus clavier est dessiné sur le texte visible
const focused = ref(false)
const isKeyboard = () => {
  try {
    return document.querySelector(':focus-visible') !== null
  } catch {
    return true
  }
}

// Nom de chaque devise dans la langue active (« baht thaïlandais », « Thai Baht », « บาทไทย »)
const options = computed(() => {
  void locale.value // refait au changement de langue
  let names = null
  try {
    names = new Intl.DisplayNames([intlLocale()], { type: 'currency' })
  } catch {
    names = null
  }
  const list = currencyList.value.some((item) => item.code === displayCurrency.value)
    ? currencyList.value
    : [{ code: displayCurrency.value }, ...currencyList.value] // choix gardé, liste pas encore chargée
  return list.map(({ code }) => {
    const name = names?.of(code) ?? code
    return { code, name: name.charAt(0).toLocaleUpperCase(intlLocale()) + name.slice(1) }
  })
})
</script>
