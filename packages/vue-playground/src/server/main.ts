import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { ProductsController } from "./controllers/products.controller";
import { CustomersController } from "./controllers/customers.controller";
import { OrdersController } from "./controllers/orders.controller";
import { WfDemoController } from "./controllers/wf-demo.controller";

const app = new Moost();
const http = new MoostHttp();
const wf = new MoostWf();
app.adapter(http);
app.adapter(wf);
app.registerControllers(
  ProductsController,
  CustomersController,
  OrdersController,
  WfDemoController,
);

http
  .listen(3100)
  .then(() => app.init())
  .then(() => console.log("\n  🗄️  Moost server ready\n"))
  .catch(console.error);
