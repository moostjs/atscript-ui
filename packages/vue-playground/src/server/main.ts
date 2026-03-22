import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { ProductsController } from "./controllers/products.controller";
import { CustomersController } from "./controllers/customers.controller";

const app = new Moost();
const http = new MoostHttp();
app.adapter(http);
app.registerControllers(ProductsController, CustomersController);

http
  .listen(3100)
  .then(() => app.init())
  .then(() => console.log("\n  🗄️  Moost server ready\n"))
  .catch(console.error);
