<!--
  Compte (en-tête, entre PDF et langue).
  Non connecté : lien « Connexion » vers /newpage (retour ensuite sur la page en cours).
  Connecté : photo Google (ou initiale), qui ouvre un menu avec le nom, l'e-mail et « Se déconnecter ».
  Menu accessible : aria-expanded, Échap et clic à l'extérieur le ferment, le focus revient au bouton.
  variant="mobile" : même chose en liste, dans le menu burger des petits écrans (l'en-tête n'a pas la place).
  État de la connexion : lib/auth.js.
-->
<template>
  <!-- Petit écran : dans le menu burger (Header.vue), en liste -->
  <div v-if="variant === 'mobile'" class="border-t border-line pt-3">
    <router-link
      v-if="session.loaded && !session.authenticated"
      :to="loginTarget"
      class="flex h-12 items-center gap-2 rounded-lg px-3 text-base font-medium text-ink-2 hover:bg-wash hover:text-ink"
      data-testid="account-sign-in-mobile"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      {{ t('account.signIn') }}
    </router-link>
    <div v-else-if="session.authenticated" class="px-3">
      <p class="truncate text-sm text-ink-2">{{ email }}</p>
      <button
        type="button"
        class="mt-1 flex h-12 w-full items-center rounded-lg text-left text-base font-medium text-ink-2 hover:text-ink disabled:opacity-50"
        :disabled="busy"
        :aria-busy="busy"
        data-testid="account-sign-out-mobile"
        @click="signOutNow"
      >
        {{ t('account.signOut') }}
      </button>
      <p v-if="error" role="alert" class="pb-2 text-xs text-danger">{{ error }}</p>
    </div>
  </div>

  <div v-else ref="root" class="relative">
    <!-- Avant la réponse du serveur : place réservée, pour que l'en-tête ne bouge pas -->
    <span v-if="!session.loaded" class="inline-block h-11 w-11" aria-hidden="true" />

    <router-link
      v-else-if="!session.authenticated"
      :to="loginTarget"
      class="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink"
      :title="t('account.signIn')"
      data-testid="account-sign-in"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      <span class="hidden sm:inline">{{ t('account.signIn') }}</span>
      <span class="sr-only sm:hidden">{{ t('account.signIn') }}</span>
    </router-link>

    <template v-else>
      <button
        ref="button"
        type="button"
        class="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-wash"
        aria-haspopup="true"
        aria-controls="account-menu"
        :aria-expanded="open"
        :aria-label="t('account.menu', { email })"
        :title="email"
        data-testid="account-button"
        @click="open = !open"
      >
        <img
          v-if="picture && !pictureFailed"
          :src="picture"
          alt=""
          referrerpolicy="no-referrer"
          class="h-8 w-8 rounded-full object-cover"
          @error="pictureFailed = true"
        />
        <span v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent" aria-hidden="true">
          {{ initial }}
        </span>
      </button>

      <div
        v-show="open"
        id="account-menu"
        class="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-paper p-2 shadow-soft"
      >
        <div class="px-3 py-2">
          <p v-if="name" class="truncate font-semibold text-ink">{{ name }}</p>
          <p class="truncate text-sm text-ink-2" data-testid="account-email">{{ email }}</p>
        </div>
        <p class="px-3 pb-2 text-xs text-ink-3">{{ t('account.synced') }}</p>
        <button
          type="button"
          class="flex h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-ink-2 hover:bg-wash hover:text-ink disabled:opacity-50"
          :disabled="busy"
          :aria-busy="busy"
          data-testid="account-sign-out"
          @click="signOutNow"
        >
          {{ t('account.signOut') }}
        </button>
        <p v-if="error" role="alert" class="px-3 pt-1 text-xs text-danger">{{ error }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { session, signOut } from '../lib/auth.js'

defineProps({
  variant: { type: String, default: 'header' }, // 'header' | 'mobile'
})

const { t } = useI18n()
const route = useRoute()

const open = ref(false)
const busy = ref(false)
const error = ref('')
const pictureFailed = ref(false)
const root = ref(null)
const button = ref(null)

const email = computed(() => session.user?.email ?? '')
const name = computed(() => session.user?.name ?? '')
const picture = computed(() => session.user?.picture ?? '')
const initial = computed(() => (name.value || email.value || '?').trim().charAt(0).toUpperCase())

// Après la connexion, retour sur la page en cours (sauf depuis la page de connexion elle-même)
const loginTarget = computed(() =>
  route.path === '/newpage' ? { path: '/newpage' } : { path: '/newpage', query: { next: route.fullPath } },
)

async function signOutNow() {
  busy.value = true
  error.value = ''
  try {
    await signOut() // recharge la page
    open.value = false
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}

function close(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) nextTick(() => button.value?.focus())
}

function onKeydown(event) {
  if (event.key === 'Escape') close(true)
}

function onPointerDown(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})

watch(
  () => route.fullPath,
  () => close(),
)
watch(picture, () => {
  pictureFailed.value = false
})
</script>
