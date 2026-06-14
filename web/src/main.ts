import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import './index.css';
import { db } from './firebase';
import { PLAYERS_API, createPlayersApi } from './api/players';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(VueQueryPlugin);
app.provide(PLAYERS_API, createPlayersApi(db));

app.mount('#app');
