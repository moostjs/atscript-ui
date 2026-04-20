import { Controller } from "moost";
import { Get } from "@moostjs/event-http";

@Controller()
export class HealthController {
  @Get("ping")
  ping() {
    return { ok: true };
  }
}
