export const seedRoles = () => [
  { name: "admin", description: "Full access" },
  { name: "manager", description: "Operational access" },
  { name: "viewer", description: "Read-only" },
];

export const seedUsers = () => [
  {
    username: "admin",
    email: "admin@demo.test",
    roleId: 1,
    status: "active",
    mfaEnabled: false,
    password: "",
    salt: "",
  },
  {
    username: "manager",
    email: "manager@demo.test",
    roleId: 2,
    status: "active",
    mfaEnabled: false,
    password: "",
    salt: "",
  },
  {
    username: "viewer",
    email: "viewer@demo.test",
    roleId: 3,
    status: "active",
    mfaEnabled: false,
    password: "",
    salt: "",
  },
  {
    username: "alice",
    email: "alice@demo.test",
    roleId: 2,
    status: "suspended",
    mfaEnabled: true,
    password: "",
    salt: "",
  },
  {
    username: "bob",
    email: "bob@demo.test",
    roleId: 3,
    status: "pending",
    mfaEnabled: false,
    password: "",
    salt: "",
  },
];

export const seedCategories = () => [
  { name: "Electronics", parentId: null, slug: "electronics" },
  { name: "Laptops", parentId: 1, slug: "laptops" },
  { name: "Phones", parentId: 1, slug: "phones" },
  { name: "Books", parentId: null, slug: "books" },
  { name: "Fiction", parentId: 4, slug: "fiction" },
];

export const seedProducts = () => {
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i <= 20; i++) {
    rows.push({
      name: `Product ${i}`,
      description: `Description for product ${i}`,
      categoryId: ((i - 1) % 5) + 1,
      createdById: 1,
      sku: `SKU-${String(i).padStart(4, "0")}`,
      price: 10 + i * 3,
      tags: i % 2 === 0 ? ["new", "featured"] : ["new"],
      publishedAt: i % 3 === 0 ? null : Date.now() - i * 86_400_000,
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

// audit_log: leave empty — later phases will write entries
