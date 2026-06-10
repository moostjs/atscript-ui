/**
 * ARBAC user attributes for the AtShop demo. Scopes use the upstream
 * `ArbacDbScope` shape from `@aooth/arbac-moost` (`projection` narrows
 * reads + /meta fields, `allowedFields` strips write payloads).
 */
export interface DemoUserAttrs {
  userId: number;
  username: string;
  roleName: "admin" | "manager" | "viewer";
}
