import { bigint, index, integer, pgSequence, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const meliOrderNumberSequence = pgSequence("meli_order_number_seq", { startWith: 1 });

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  tableCode: text("table_code"),
  orderType: text("order_type").notNull().default("dine_in"),
  source: text("source").notNull().default("customer_qr"),
  status: text("status").notNull().default("new"),
  customerName: text("customer_name").notNull().default(""),
  note: text("note").notNull().default(""),
  total: integer("total").notNull(),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_orders_status_created").on(table.status, table.createdAt),
  index("idx_orders_table_status").on(table.tableCode, table.status),
]);

export const orderItems = pgTable("order_items", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id"),
  itemName: text("item_name").notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("idx_order_items_order_id").on(table.orderId)]);
