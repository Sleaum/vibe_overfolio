<!--
  Page de connexion (/newpage). Même style que le reste du site : fond blanc, carte à filet fin, bleu d'accent pour
  le bouton et les liens. La connexion est encore une simulation (voir handleLogin) : aucun compte n'est vérifié.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <div class="mx-auto w-full max-w-md">
      <div class="rounded-xl border border-line bg-paper p-6 shadow-soft sm:p-8">
        <header class="text-center">
          <h1 class="text-h2 text-ink">{{ t('pages.login') }}</h1>
          <p class="mt-2 text-ink-2">{{ t('login.lead') }}</p>
        </header>

        <!-- Formulaire -->
        <div class="mt-8 space-y-5">
          <!-- Champ Email -->
          <div>
            <label for="connexion-email" class="block text-sm font-medium text-ink">{{ t('login.email') }}</label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg class="h-5 w-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <input
                id="connexion-email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                class="h-11 w-full rounded-lg border border-line-strong bg-paper pl-10 pr-4 text-[0.9375rem] text-ink placeholder:text-ink-3"
              />
            </div>
          </div>

          <!-- Champ Mot de passe -->
          <div>
            <label for="connexion-mot-de-passe" class="block text-sm font-medium text-ink">{{ t('login.password') }}</label>
            <div class="relative mt-1.5">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg class="h-5 w-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <input
                id="connexion-mot-de-passe"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                class="h-11 w-full rounded-lg border border-line-strong bg-paper pl-10 pr-12 text-[0.9375rem] text-ink placeholder:text-ink-3"
              />
              <button
                type="button"
                @click="togglePasswordVisibility"
                :aria-label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
                :aria-pressed="showPassword"
                class="absolute inset-y-0 right-0 flex items-center rounded-r-lg pr-3 text-ink-3 transition-colors hover:text-ink"
              >
                <svg v-if="!showPassword" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Options -->
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input v-model="rememberMe" type="checkbox" class="h-4 w-4 rounded accent-accent" />
              {{ t('login.remember') }}
            </label>
            <a href="#" class="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
              {{ t('login.forgot') }}
            </a>
          </div>

          <!-- Bouton de connexion -->
          <AppButton block :disabled="isLoading" @click="handleLogin">
            <template v-if="isLoading">
              <span class="h-4 w-4 rounded-full border-2 border-on-accent border-t-transparent motion-safe:animate-spin" aria-hidden="true"></span>
              {{ t('login.signingIn') }}
            </template>
            <template v-else>{{ t('login.signIn') }}</template>
          </AppButton>
        </div>

        <!-- Séparateur -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-line"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="bg-paper px-4 text-ink-3">{{ t('login.or') }}</span>
          </div>
        </div>

        <!-- Connexion Google -->
        <AppButton variant="secondary" block @click="handleGoogleLogin">
          <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {{ t('login.google') }}
        </AppButton>

        <!-- Inscription -->
        <p class="mt-6 text-center text-sm text-ink-2">
          {{ t('login.noAccount') }}
          <a href="#" class="ml-1 font-medium text-accent underline underline-offset-4 hover:text-accent-hover">{{ t('login.signUp') }}</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import AppButton from '../components/ui/AppButton.vue'

const { t } = useI18n()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const rememberMe = ref(false)

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

// Simulation d'une connexion : rien n'est envoyé au serveur
const handleLogin = async () => {
  if (!email.value || !password.value) {
    alert(t('login.fillAll'))
    return
  }

  isLoading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    console.log('Connexion avec:', {
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value,
    })
    alert(t('login.success'))
  } catch (error) {
    console.error('Erreur de connexion:', error)
    alert(t('login.error'))
  } finally {
    isLoading.value = false
  }
}

const handleGoogleLogin = () => {
  console.log('Connexion avec Google')
  alert(t('login.googleTodo'))
  // Ici vous intégreriez l'API Google OAuth
}
</script>
