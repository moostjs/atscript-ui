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
    // Eve: status: 'invited' so the Resend-invite action path (gated on
    // `status === 'invited'`) is reachable. Kept FK-orphan — neither
    // products.createdById (cycles 1..5) nor orders.assigneeId (cycles
    // 1..3) reference user 6 — so DELETE-on-eve scenarios stay open
    // without seeding a fresh user via raw HTTP.
    {
      username: "eve",
      email: "eve@demo.test",
      roleId: 3,
      status: "invited",
      mfaEnabled: false,
      profile: { firstName: "Eve", lastName: "East" },
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

/** Dictionary rows behind the `@ui.valueHelp` bindings (products' colour / size). */
export const seedAttributeValues = () => [
  { attribute: "color", value: "red", label: "Red", active: true },
  { attribute: "color", value: "blue", label: "Blue", active: true },
  { attribute: "color", value: "green", label: "Green", active: true },
  { attribute: "color", value: "black", label: "Black", active: true },
  { attribute: "size", value: "S", label: "Small", active: true },
  { attribute: "size", value: "M", label: "Medium", active: true },
  { attribute: "size", value: "L", label: "Large", active: true },
  { attribute: "size", value: "XL", label: "Extra large", active: false },
  { attribute: "material", value: "cotton", label: "Cotton", active: true },
  { attribute: "team", value: "support", label: "Support", active: true },
  { attribute: "team", value: "sales", label: "Sales", active: true },
];

const COLORS = ["red", "blue", "green", "black"];
const SIZES = ["S", "M", "L", "XL"];

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
      color: COLORS[i % COLORS.length],
      size: SIZES[(i >> 2) % SIZES.length],
      // 130 distinct values over 2000 rows: de-duplicated, paged by the distinct picker
      brand: `Brand ${String((i % 130) + 1).padStart(3, "0")}`,
    });
  }
  return rows;
};

// 5-step cycle including a null slot: [Email, Phone, Postal, null, Email].
const pickPrimaryContact = (i: number): Record<string, unknown> | undefined => {
  switch ((i - 1) % 5) {
    case 0:
    case 4:
      return { email: `primary-${i}@example.com`, htmlNewsletter: i % 2 === 0 };
    case 1:
      return { phone: `+1-555-01${String(i).padStart(2, "0")}` };
    case 2:
      return { street: `${i} Oak Street`, city: "Springfield" };
    default:
      return undefined;
  }
};

const CITIES = ["Berlin", "Bonn", "Boston", "Berlin", "Austin", "Bonn", "Chicago", "Berlin"];

export const seedCustomers = () => {
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= 10; i++) {
    rows.push({
      name: `Customer ${i}`,
      email: `customer${i}@demo.test`,
      // customers 9 and 10 have no city: the NULL group is never offered
      city: i <= CITIES.length ? CITIES[i - 1] : undefined,
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
      primaryContact: pickPrimaryContact(i),
    });
  }
  return rows;
};

// 4-step cycle Card -> Bank -> Invoice -> null.
const pickPaymentMethod = (i: number): Record<string, unknown> | undefined => {
  switch ((i - 1) % 4) {
    case 0:
      return { kind: "card", last4: "4242" };
    case 1:
      return { kind: "bank", iban: `DE89370400440532013${String(i).padStart(3, "0")}` };
    case 2:
      return {
        kind: "invoice",
        invoiceNumber: `INV-${String(i).padStart(4, "0")}`,
        netDays: 30,
      };
    default:
      return undefined;
  }
};

// 3-step cycle string[] -> { author, body } -> null.
const pickNote = (i: number): unknown => {
  switch ((i - 1) % 3) {
    case 0:
      return [`urgent`, `priority`, `customer-${i}`];
    case 1:
      return { author: `agent${i}`, body: `Reviewed order ${i}. All good.` };
    default:
      return undefined;
  }
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
      paymentMethod: pickPaymentMethod(i),
      note: pickNote(i),
    });
  }
  return rows;
};

// 12-step status cycle: 3 open, 3 in-progress, 4 done, 2 archived → over 60
// tasks that is 15 / 15 / 20 / 10. Interleaved so every page mixes statuses.
const TASK_STATUS_CYCLE = [
  "open",
  "in-progress",
  "done",
  "open",
  "done",
  "in-progress",
  "done",
  "archived",
  "open",
  "done",
  "in-progress",
  "archived",
] as const;
const TASK_VERBS = ["Review", "Update", "Fix", "Draft", "Plan", "Test"] as const;
const TASK_SUBJECTS = [
  "release notes",
  "billing page",
  "search ranking",
  "onboarding email",
  "API docs",
  "invoice export",
  "login flow",
  "dashboard charts",
  "data backup",
  "mobile layout",
] as const;

/**
 * 60 deterministic tasks for the query-target / view-delegation showcase.
 * Assignees cycle users 1..5 with every 7th task unassigned (left join →
 * empty `assignee` on the board); eve (user 6) stays FK-orphan.
 */
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const TASK_LABEL_SETS = [["bug"], ["feature"], ["bug", "feature"], ["chore"]];

export const seedTasks = () => {
  const rows: Record<string, unknown>[] = [];
  const priorities = ["low", "normal", "high"] as const;
  const now = Date.now();
  for (let i = 1; i <= 60; i++) {
    const verb = TASK_VERBS[i % TASK_VERBS.length];
    const subject = TASK_SUBJECTS[i % TASK_SUBJECTS.length];
    rows.push({
      title: `${verb} ${subject} #${i}`,
      status: TASK_STATUS_CYCLE[(i - 1) % TASK_STATUS_CYCLE.length],
      priority: priorities[(i * 7) % priorities.length],
      assigneeId: i % 7 === 0 ? null : ((i - 1) % 5) + 1,
      // Hours; `remaining` (task-board, computed) = estimate - spent goes
      // negative for over-budget tasks.
      estimate: (i % 8) + 1,
      spent: (i * 3) % 7,
      // Calendar days (`string.date`) and ISO date-times (`string.isoDate`): task 1
      // is due 2026-10-01, one more day per task; every 5th has no due date.
      dueOn: i % 5 === 0 ? undefined : isoDay(Date.UTC(2026, 9, i)),
      reviewedAt:
        i % 4 === 0 ? undefined : new Date(Date.UTC(2026, 9, 1 + (i % 28), i % 24)).toISOString(),
      createdAt: now - i * 3_600_000,
      // Arrays of a literal union (`@ui.literalLabel` labels): task 1 is a bug, 2 a feature,
      // 3 both, 4 a chore; every 5th has none.
      labels: i % 5 === 0 ? undefined : TASK_LABEL_SETS[(i - 1) % TASK_LABEL_SETS.length],
    });
  }
  return rows;
};

// 4-step cycle Login -> Logout -> Note -> null, indexed by 1-based seeded-row
// position (= PK, since `insertMany` honours array order).
const pickAuditPayload = (i: number): Record<string, unknown> | undefined => {
  switch ((i - 1) % 4) {
    case 0:
      return { type: "login", ip: `10.0.0.${(i % 254) + 1}` };
    case 1:
      return { type: "logout", sessionId: `sess-${i}` };
    case 2:
      return { type: "note", text: `Audit note for row ${i}` };
    default:
      return undefined;
  }
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
  let rowIndex = 0;
  for (let i = 0; i < 5000; i++) {
    const ent = ENTITIES[i % ENTITIES.length]!;
    const [entityType, max] = ent;
    const pool = ACTIONS_BY_ENTITY[entityType] ?? [];
    if (pool.length === 0) continue;
    const action = pool[i % pool.length]!;
    const entityId = ((i * 31) % max) + 1;
    const actorId = (i % 5) + 1;
    rowIndex++;
    rows.push({
      actorId,
      entityType,
      entityId,
      action,
      changes: JSON.stringify({ seed: true, idx: i }),
      // Spread the timestamps across the last ~30 days, descending with i.
      createdAt: now - i * 60_000 - (i % 17) * 1_000,
      // `rowIndex` (post-`continue`) ≠ `i`; the cycle keys off the seeded-row PK.
      payload: pickAuditPayload(rowIndex),
    });
  }
  return rows;
};
