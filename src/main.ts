import { createApp } from "vue";
import { loader } from "@guolao/vue-monaco-editor";
import '@fortawesome/fontawesome-free/css/all.css';
import router from "./router";
import App from "./App.vue"
import './style.css'

const app = createApp(App);
app.use(router);
app.mount("#app");
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs',
    },
})
