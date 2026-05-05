import { hashPassword } from "./auth/password";

export const seedRoles = () => [
  { name: "admin", description: "Full access" },
  { name: "manager", description: "Operational access" },
  { name: "viewer", description: "Read-only" },
];

export const seedUsers = async () => {
  const pw = await hashPassword("demo-password");
  const now = Date.now();
  const day = 86_400_000;
  return [
    {
      username: "admin",
      email: "admin@demo.test",
      roleId: 1,
      status: "active",
      mfaEnabled: false,
      profile: { firstName: "Admin", lastName: "Root" },
      lastLoginAt: now - 5 * 60_000, // 5 minutes ago
      birthday: Date.UTC(1985, 2, 14), // 1985-03-14
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "manager",
      email: "manager@demo.test",
      roleId: 2,
      status: "active",
      mfaEnabled: false,
      profile: { firstName: "Morgan", lastName: "Lee" },
      lastLoginAt: now - 2 * 3_600_000, // 2 hours ago
      birthday: Date.UTC(1990, 6, 1), // 1990-07-01
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "viewer",
      email: "viewer@demo.test",
      roleId: 3,
      status: "active",
      mfaEnabled: false,
      profile: { firstName: "Vera", lastName: "Smith" },
      lastLoginAt: now - 26 * 3_600_000, // yesterday-ish
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "alice",
      email: "alice@demo.test",
      roleId: 2,
      status: "active",
      mfaEnabled: true,
      profile: { firstName: "Alice", lastName: "Adams" },
      lastLoginAt: now - 3 * day, // 3 days ago
      birthday: Date.UTC(1992, 10, 23), // 1992-11-23
      password: pw.hash,
      salt: pw.salt,
    },
    {
      username: "bob",
      email: "bob@demo.test",
      roleId: 3,
      status: "pending",
      mfaEnabled: false,
      profile: { firstName: "Bob", lastName: "Brown" },
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
    // `decimal` columns serialize as strings on the wire; pre-format so the
    // seed shape matches what the adapter writes and reads back.
    const price = (10 + ((i * 7) % 990) + (i % 17) / 10).toFixed(2);
    const weight = ((i % 50) + 1 + (i % 7) / 10).toFixed(2);
    rows.push({
      name: `Product ${i}`,
      description: `Description for product ${i}`,
      categoryId: ((i - 1) % 5) + 1,
      createdById: ((i - 1) % 5) + 1,
      sku: `SKU-${String(i).padStart(5, "0")}`,
      price,
      weight,
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
  const currencies = ["USD", "EUR", "GBP"] as const;
  for (let i = 1; i <= 15; i++) {
    // `decimal` columns (top-level + inside `@db.json`) round-trip as strings;
    // compute as numbers then `.toFixed(2)` at the boundary.
    const lineNums = [
      { productId: ((i - 1) % 20) + 1, quantity: 1 + (i % 3), priceAt: 10 + i * 3 },
      { productId: (i % 20) + 1, quantity: 1, priceAt: 15 + i },
    ];
    const lines = lineNums.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      priceAtTime: l.priceAt.toFixed(2),
    }));
    const total = lineNums.reduce((s, l) => s + l.quantity * l.priceAt, 0).toFixed(2);
    rows.push({
      customerId: ((i - 1) % 10) + 1,
      assigneeId: (i % 3) + 1,
      status: statuses[i % statuses.length],
      currency: currencies[i % currencies.length],
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
