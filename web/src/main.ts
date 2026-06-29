import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import './index.css';
import { db } from './firebase';
import { PLAYERS_API, createPlayersApi } from './api/players';
import { INVITATIONS_API, createInvitationsApi } from './api/invitations';
import { OWNER_API, createOwnerApi } from './api/owner';
import { CAN_VIEW_PAST_PLAYERS, createCapabilities } from './api/session';
import { useSession } from './composables/useSession';

const app = createApp(App);
const capabilities = createCapabilities();
const { capabilities: sessionCapabilities } = useSession();

watch(
  () => sessionCapabilities.value.canViewPastPlayers,
  (val) => {
    capabilities.canViewPastPlayers.value = val;
  },
  { immediate: true }
);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);
app.provide(PLAYERS_API, createPlayersApi(db));
app.provide(INVITATIONS_API, createInvitationsApi());
app.provide(OWNER_API, createOwnerApi());
app.provide(CAN_VIEW_PAST_PLAYERS, capabilities.canViewPastPlayers);

app.mount('#app');
