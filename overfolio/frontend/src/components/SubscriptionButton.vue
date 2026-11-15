<!--
  Bouton « S'abonner » : demande une session de paiement au backend, puis envoie la personne chez Stripe.
  - L'erreur s'affiche sous le bouton (plus d'alert()), annoncée aux lecteurs d'écran.
  - Adresse de l'API : VITE_API_URL si elle est définie, sinon la même adresse que le site (nginx / proxy de Vite).
  - Chemin de l'API : VITE_CHECKOUT_PATH si défini, sinon celui que Django expose aujourd'hui.
-->
<template>
  <div>
    <AppButton
      :variant="variant"
      :size="size"
      :block="block"
      :disabled="loading"
      :aria-busy="loading"
      @click="subscribe"
    >
      {{ loading ? 'Redirection vers le paiement…' : label }}
    </AppButton>
    <!-- Zone toujours présente : les lecteurs d'écran annoncent le texte dès qu'il apparaît -->
    <p role="alert" class="text-sm text-danger" :class="error ? 'mt-3' : ''">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { loadStripe } from '@stripe/stripe-js'
import AppButton from './ui/AppButton.vue'

const props = defineProps({
  label: { type: String, default: 'S’abonner' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  block: { type: Boolean, default: false },
  // Adresse de la personne connectée, quand les comptes existeront. Vide : Stripe la demande lui-même.
  email: { type: String, default: '' },
})

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const CHECKOUT_PATH = import.meta.env.VITE_CHECKOUT_PATH || '/api/stripe/api/create-checkout-session/'

const loading = ref(false)
const error = ref('')

async function subscribe() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  let redirecting = false

  try {
    const response = await fetch(`${API_BASE_URL}${CHECKOUT_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(props.email ? { email: props.email } : {}),
    })
    if (!response.ok) throw new Error(`Session de paiement refusée (HTTP ${response.status})`)

    const data = await response.json()

    // Cas courant : le backend renvoie l'adresse de la page de paiement Stripe
    if (data.checkout_url) {
      redirecting = true
      window.location.assign(data.checkout_url)
      return
    }

    // Secours : ancien flux avec Stripe.js (redirectToCheckout n'existe plus dans les versions récentes)
    const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY)
    if (!stripe || typeof stripe.redirectToCheckout !== 'function') throw new Error('Stripe non initialisé')
    await stripe.redirectToCheckout({ sessionId: data.session_id })
  } catch (err) {
    console.error('Erreur abonnement :', err)
    error.value = 'Le paiement n’a pas pu démarrer. Réessaie dans un instant.'
  } finally {
    // Pendant la redirection, le bouton reste bloqué pour éviter un second clic
    if (!redirecting) loading.value = false
  }
}
</script>
