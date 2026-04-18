import { installDynamicResolver } from "@atscript/ui-fns";
import { Client } from "@atscript/db-client";
import { setDefaultClientFactory } from "@atscript/vue-table";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "virtual:uno.css";
import "./styles/app.css";

installDynamicResolver();
setDefaultClientFactory((url) => new Client(url));
createApp(App).use(router).mount("#app");
