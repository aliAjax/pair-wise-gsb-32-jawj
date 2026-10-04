import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './style.css';
import App from './App.vue';
import router from './router';
import { useDayPlanStore } from './stores/dayPlanStore';
import { messages } from './constants/messages';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router).use(ElementPlus);
const recovered = useDayPlanStore(pinia).recoverInterruptedSaves();
if (recovered) console.info(messages.saveRecovered);
app.mount('#app');
