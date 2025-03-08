import { useThemeService } from './services/themeService'
import { createApp } from "vue";
import { loader } from "@guolao/vue-monaco-editor";
import '@fortawesome/fontawesome-free/css/all.css';
import router from "./router";
import App from "./App.vue"
import './style.css'
import { createPinia } from 'pinia';

const { initializeTheme } = useThemeService();
initializeTheme();

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(pinia);
app.mount("#app");
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs',
    },
})
