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
import { OrdersActionsController } from "./controllers/orders-actions.controller";
import { AuditLogController } from "./controllers/audit-log.controller";
import { WorkflowsController } from "./controllers/workflows.controller";
import { LoginWorkflow } from "./workflows/auth/login.workflow";
import { RegisterWorkflow } from "./workflows/auth/register.workflow";
import { ChangePasswordWorkflow } from "./workflows/security/change-password.workflow";
import { EditProfileWorkflow } from "./workflows/profile/edit.workflow";
import { InviteWorkflow } from "./workflows/users/invite.workflow";
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
  WorkflowsController,
  LoginWorkflow,
  RegisterWorkflow,
  ChangePasswordWorkflow,
  EditProfileWorkflow,
  InviteWorkflow,
  UsersController,
  RolesController,
  CategoriesController,
  ProductsController,
  CustomersController,
  OrdersController,
  OrdersActionsController,
  AuditLogController,
);
void app.init();
