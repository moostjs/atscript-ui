import { hashPassword } from "./auth/password";

export const seedRoles = () => [
  { name: "admin", description: "Full access" },
  { name: "manager", description: "Operational access" },
  { name: "viewer", description: "Read-only" },
];

export const seedUsers = async () => {
  const pw = await hashPassword("demo-password");
  return [
    {
      username: "admin",
      email: "admin@demo.test",
      roleId: 1,
      status: "active",
      mfaEnabled: false,
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "manager",
      email: "manager@demo.test",
      roleId: 2,
      status: "active",
      mfaEnabled: false,
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "viewer",
      email: "viewer@demo.test",
      roleId: 3,
      status: "active",
      mfaEnabled: false,
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "alice",
      email: "alice@demo.test",
      roleId: 2,
      status: "active",
      mfaEnabled: true,
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "bob",
      email: "bob@demo.test",
      roleId: 3,
      status: "pending",
      mfaEnabled: false,
      password: pw.hash,
      salt: pw.salt,
    },
  ];
};

export const seedCategories = () => [
  { name: "Electronics", parentId: null, slug: "electronics" },
  { name: "Laptops", parentId: 1, slug: "laptops" },
  { name: "Phones", parentId: 1, slug: "phones" },
  { name: "Books", parentId: null, slug: "books" },
  { name: "Fiction", parentId: 4, slug: "fiction" },
];

export const seedProducts = () => {
  const rows: Record<string, unknown>[] = [];
  const TAG_POOL = [
    ["new"],
    ["new", "featured"],
    ["sale"],
    ["new", "sale"],
    ["bestseller"],
    ["bestseller", "featured"],
  ];
  for (let i = 1; i <= 2000; i++) {
    rows.push({
      name: `Product ${i}`,
      description: `Description for product ${i}`,
      categoryId: ((i - 1) % 5) + 1,
      createdById: ((i - 1) % 5) + 1,
      sku: `SKU-${String(i).padStart(5, "0")}`,
      price: 10 + ((i * 7) % 990) + (i % 17) / 10,
      tags: TAG_POOL[i % TAG_POOL.length],
      publishedAt: i % 4 === 0 ? undefined : Date.now() - i * 3_600_000,
    });
  }
  return rows;
};

export const seedCustomers = () => {
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= 10; i++) {
    rows.push({
      name: `Customer ${i}`,
      email: `customer${i}@demo.test`,
      address: {
        street: `${i} Demo Rd`,
        city: "Demoville",
        state: "DC",
        zip: "00000",
        country: "US",
      },
      preferences: {
        newsletter: i % 2 === 0,
        channel: i % 3 === 0 ? "sms" : "email",
      },
    });
  }
  return rows;
};

export const seedOrders = () => {
  const rows: Record<string, unknown>[] = [];
  const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
  for (let i = 1; i <= 15; i++) {
    const lines = [
      { productId: ((i - 1) % 20) + 1, quantity: 1 + (i % 3), priceAtTime: 10 + i * 3 },
      { productId: (i % 20) + 1, quantity: 1, priceAtTime: 15 + i },
    ];
    const total = lines.reduce((s, l) => s + l.quantity * l.priceAtTime, 0);
    rows.push({
      customerId: ((i - 1) % 10) + 1,
      assigneeId: (i % 3) + 1,
      status: statuses[i % statuses.length],
      lines,
      total,
      shippedAt: i % 2 === 0 ? Date.now() - i * 3_600_000 : null,
    });
  }
  return rows;
};

/**
 * Synthetic audit-log backfill so window mode has something to scrub through
 * on first boot. Live entries (from action invocations through
 * `auditInterceptor`) accumulate on top via the `desc createdAt` index.
 */
export const seedAuditLog = () => {
  const rows: Record<string, unknown>[] = [];
  const ENTITIES: Array<[string, number]> = [
    // [entityType, id range upper bound — matches seeded counts]
    ["orders", 15],
    ["users", 5],
    ["products", 2000],
    ["customers", 10],
  ];
  const ACTIONS_BY_ENTITY: Record<string, string[]> = {
    orders: ["process", "ship", "mark-delivered", "cancel", "process.rejected", "ship.rejected"],
    users: ["activate", "suspend", "resend-invite", "activate.rejected"],
    products: ["publish", "unpublish", "duplicate", "publish.rejected"],
    customers: [],
  };
  const now = Date.now();
  for (let i = 0; i < 5000; i++) {
    const ent = ENTITIES[i % ENTITIES.length]!;
    const [entityType, max] = ent;
    const pool = ACTIONS_BY_ENTITY[entityType] ?? [];
    if (pool.length === 0) continue;
    const action = pool[i % pool.length]!;
    const entityId = ((i * 31) % max) + 1;
    const actorId = (i % 5) + 1;
    rows.push({
      actorId,
      entityType,
      entityId,
      action,
      changes: JSON.stringify({ seed: true, idx: i }),
      // Spread the timestamps across the last ~30 days, descending with i.
      createdAt: now - i * 60_000 - (i % 17) * 1_000,
    });
  }
  return rows;
};
