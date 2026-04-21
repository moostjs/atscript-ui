import { installDynamicResolver } from "@atscript/ui-fns";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "@unocss/reset/tailwind.css";
import "virtual:uno.css";
import "./styles/app.css";

installDynamicResolver();
createApp(App).use(router).mount("#app");
