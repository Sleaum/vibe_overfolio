<!--
  Page de connexion (/newpage). Connexion avec un compte Google seulement (backend/accounts, lib/auth.js) :
  le bouton part chez Google, qui revient ensuite sur la page demandée (?next=/page).
  En cas d'échec, Google renvoie ici avec ?error=<code> : le message est traduit (rubrique apiErrors).
  Sans réglages Google sur le serveur (.env), le bouton est grisé et le site reste utilisable sans compte.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <div class="mx-auto w-full max-w-md">
      <div class="rounded-xl border border-line bg-paper p-6 shadow-soft sm:p-8">
        <header class="text-center">
          <h1 class="text-h2 text-ink">{{ t('pages.login') }}</h1>
          <p class="mt-2 text-ink-2">{{ t('login.lead') }}</p>
        </header>

        <div v-if="errorMessage" role="alert" class="mt-6 rounded-lg border border-danger-line bg-danger-wash p-4" data-testid="login-error">
          <p class="font-semibold text-danger">{{ t('login.failed') }}</p>
          <p class="mt-1 text-sm text-ink">{{ errorMessage }}</p>
        </div>

        <!-- Connecté -->
        <div v-if="session.authenticated" class="mt-8 space-y-4 text-center">
          <p class="text-ink" data-testid="login-connected">{{ t('login.connected', { email: session.user?.email ?? '' }) }}</p>
          <AppButton block to="/graphiques">{{ t('login.openCharts') }}</AppButton>
          <AppButton variant="secondary" block :disabled="busy" :aria-busy="busy" @click="signOutNow">
            {{ t('account.signOut') }}
          </AppButton>
        </div>

        <!-- Non connecté -->
        <div v-else class="mt-8">
          <AppButton
            variant="secondary"
            block
            :disabled="!session.loaded || !session.configured"
            :aria-describedby="session.loaded && !session.configured ? 'login-unavailable' : undefined"
            data-testid="login-google"
            @click="signIn(next)"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {{ t('login.google') }}
          </AppButton>
          <p v-if="session.loaded && !session.configured" id="login-unavailable" class="mt-3 text-sm text-ink-3" data-testid="login-unavailable">
            {{ t('login.notConfigured') }}
          </p>
          <p v-if="session.error" role="alert" class="mt-3 text-sm text-danger">{{ session.error }}</p>
          <p class="mt-6 text-sm text-ink-2">{{ t('login.saved') }}</p>
          <p class="mt-3 text-sm text-ink-3">{{ t('login.privacy') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/ui/AppButton.vue'
import { apiMessage } from '../lib/api.js'
import { safeNext, session, signIn, signOut } from '../lib/auth.js'
import { loadProfile } from '../lib/profile.js'

const { t } = useI18n()
const route = useRoute()

const busy = ref(false)
const signOutError = ref('')

// Page où revenir après la connexion
const next = computed(() => safeNext(typeof route.query.next === 'string' ? route.query.next : '/'))

// Échec renvoyé par le serveur au retour de Google, ou échec de la déconnexion
const errorMessage = computed(() => {
  if (signOutError.value) return signOutError.value
  const code = typeof route.query.error === 'string' ? route.query.error : ''
  return code ? apiMessage(code, {}, t('login.error')) : ''
})

async function signOutNow() {
  busy.value = true
  signOutError.value = ''
  try {
    await signOut()
    await loadProfile()
  } catch (failure) {
    signOutError.value = failure.message
  } finally {
    busy.value = false
  }
}
</script>
