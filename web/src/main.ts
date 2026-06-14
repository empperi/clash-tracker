import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import './index.css';
import { db } from './firebase';
import { PLAYERS_API, createPlayersApi } from './api/players';
import { CAN_VIEW_PAST_PLAYERS, createCapabilities } from './api/session';

const app = createApp(App);
const capabilities = createCapabilities();

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);
app.provide(PLAYERS_API, createPlayersApi(db));
app.provide(CAN_VIEW_PAST_PLAYERS, capabilities.canViewPastPlayers);

app.mount('#app');
