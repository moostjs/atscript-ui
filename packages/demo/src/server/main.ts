import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { HealthController } from "./controllers/health.controller";

const app = new Moost({ globalPrefix: "api" });
void app.adapter(new MoostHttp()).listen(3200);
app.adapter(new MoostWf());
app.registerControllers(HealthController);
void app.init();
