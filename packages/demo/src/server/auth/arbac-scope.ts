/**
 * ARBAC scope/attribute types for the AtShop demo.
 *
 * A `DemoScope` optionally narrows column access via `columns` — when
 * undefined, the scope grants access to all columns of the resource.
 */
export interface DemoScope {
  columns?: string[];
}

export interface DemoUserAttrs {
  userId: number;
  username: string;
  roleName: "admin" | "manager" | "viewer";
}
