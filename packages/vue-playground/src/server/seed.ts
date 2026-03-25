const categories = ["electronics", "clothing", "food", "books", "toys", "other"];

export function seedProducts() {
  const products = [];
  for (let i = 1; i <= 5000; i++) {
    products.push({
      name: `Product ${i}`,
      description: `Description for product ${i}. This is a sample product in the ${categories[(i - 1) % categories.length]} category.`,
      price: Math.round((Math.random() * 500 + 5) * 100) / 100,
      inStock: Math.random() > 0.2,
      category: categories[(i - 1) % categories.length]!,
      sku: `SKU-${String(i).padStart(4, "0")}`,
    });
  }
  return products;
}

const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
  "Kate",
  "Leo",
  "Mia",
  "Noah",
  "Olivia",
  "Paul",
  "Quinn",
  "Ruby",
  "Sam",
  "Tina",
  "Uma",
  "Victor",
  "Wendy",
  "Xavier",
  "Yara",
  "Zack",
  "Anna",
  "Ben",
  "Clara",
  "David",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Anderson",
  "Taylor",
  "Thomas",
  "Hernandez",
  "Moore",
  "Martin",
  "Jackson",
  "Thompson",
  "White",
  "Lopez",
  "Lee",
  "Gonzalez",
  "Harris",
  "Clark",
  "Lewis",
  "Robinson",
  "Walker",
  "Perez",
  "Hall",
  "Young",
];

const cities = [
  "New York",
  "London",
  "Berlin",
  "Tokyo",
  "Paris",
  "Sydney",
  "Toronto",
  "Amsterdam",
  "Barcelona",
  "Singapore",
];

const countries = [
  "USA",
  "UK",
  "Germany",
  "Japan",
  "France",
  "Australia",
  "Canada",
  "Netherlands",
  "Spain",
  "Singapore",
];

const statuses = ["pending", "shipped", "delivered", "cancelled"];

export function seedOrders() {
  const orders = [];
  for (let i = 1; i <= 200; i++) {
    const customerId = ((i - 1) % 30) + 1;
    const productId = ((i - 1) % 100) + 1;
    const quantity = Math.floor(Math.random() * 5) + 1;
    const price = Math.round((Math.random() * 200 + 10) * 100) / 100;
    orders.push({
      customerId,
      productId,
      quantity,
      total: Math.round(price * quantity * 100) / 100,
      status: statuses[(i - 1) % statuses.length]!,
    });
  }
  return orders;
}

export function seedCustomers() {
  const customers = [];
  for (let i = 0; i < 30; i++) {
    const first = firstNames[i]!;
    const last = lastNames[i]!;
    customers.push({
      firstName: first,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone:
        Math.random() > 0.3
          ? `+1-555-${String(1000 + i).slice(1)}-${String(1000 + i * 3).slice(1)}`
          : undefined,
      city: cities[i % cities.length],
      country: countries[i % countries.length],
      active: Math.random() > 0.15,
    });
  }
  return customers;
}
