import { Moost, createProvideRegistry } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { MoostArbac, ArbacUserProvider } from "@moostjs/arbac";
import { AuthController, MeController } from "./controllers/auth.controller";
import { UsersController } from "./controllers/users.controller";
import { RolesController } from "./controllers/roles.controller";
import { CategoriesController } from "./controllers/categories.controller";
import { ProductsController } from "./controllers/products.controller";
import { CustomersController } from "./controllers/customers.controller";
import { OrdersController } from "./controllers/orders.controller";
import { AuditLogController } from "./controllers/audit-log.controller";
import { DemoArbacUserProvider } from "./auth/arbac-user.provider";
import { registerDemoRoles } from "./auth/arbac-policy";
import type { DemoScope, DemoUserAttrs } from "./auth/arbac-scope";

const arbac = new MoostArbac<DemoUserAttrs, DemoScope>();
registerDemoRoles(arbac);

const app = new Moost({ globalPrefix: "api" });
app.setProvideRegistry(
  createProvideRegistry(
    [MoostArbac, () => arbac],
    [ArbacUserProvider, () => new DemoArbacUserProvider()],
  ),
);
void app.adapter(new MoostHttp()).listen(3200);
app.adapter(new MoostWf());
app.registerControllers(
  AuthController,
  MeController,
  UsersController,
  RolesController,
  CategoriesController,
  ProductsController,
  CustomersController,
  OrdersController,
  AuditLogController,
);
void app.init();
