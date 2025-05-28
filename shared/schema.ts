import { pgTable, text, serial, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  walletBalance: numeric("wallet_balance").notNull().default("0"),
  commission: numeric("commission").notNull().default("0"),
  name: text("name"),
  email: text("email"),
  gender: text("gender"),
  state: text("state"),
  city: text("city"),
  address: text("address"),
  isAdmin: boolean("is_admin").default(false),
  isActive: boolean("is_active").default(true),
  mpin: text("mpin"),
  isFirstLogin: boolean("is_first_login").default(true),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralPending: boolean("referral_pending").default(false),
  referralCount: integer("referral_count").default(0),
  referralEarnings: numeric("referral_earnings").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // RECHARGE, ADD_FUND, TRANSFER, REFERRAL, CASHBACK
  amount: numeric("amount").notNull(),
  status: text("status").notNull(), // PENDING, SUCCESS, FAILED
  description: text("description"),
  transactionId: text("transaction_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  operatorId: integer("operator_id").references(() => operators.id),
  recipientId: integer("recipient_id").references(() => users.id),
  ipAddress: text("ip_address"), // Store user's IP address
  deviceInfo: text("device_info"), // Store user's device information
  // Metadata field removed as requested - all info stored in description field
});

export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // MOBILE, DTH
  commission: numeric("commission").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  logo: text("logo"),
});

// Update user schema for referral code validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  gender: true,
  state: true,
  city: true,
  address: true,
  referralCode: true,
  referredBy: true,
}).extend({
  walletBalance: z.string().optional(),
  commission: z.string().optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isFirstLogin: z.boolean().optional(),
  referralPending: z.boolean().optional(),
  referralCount: z.number().optional(),
  referralEarnings: z.string().optional(),
});

// Schema for MPIN
export const mpinSchema = z.object({
  mpin: z.string().length(4).regex(/^\d+$/, "MPIN must be 4 digits"),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  timestamp: true,
}).extend({
  operatorId: z.number().optional().nullable(),
  recipientId: z.union([z.number(), z.array(z.number())]).optional().nullable(),
  ipAddress: z.string().optional(),
  deviceInfo: z.string().optional(),
});

export const insertOperatorSchema = createInsertSchema(operators).omit({
  id: true,
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  type: text("type").notNull(), // RECHARGE, WALLET_CREDIT, WALLET_DEBIT, REFERRAL, ANNOUNCEMENT
  read: boolean("read").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
  // Metadata field removed as requested - all info stored in message field
});

// Add notification schemas
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  timestamp: true,
});

// Setting schema
export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Add notification types
export type User = typeof users.$inferSelect & {
  // Extended properties for dashboard metrics
  transactionCount?: number;
  totalSpent?: number;
  transactionVolume?: number;
  growth?: number;
};
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect & {
  needsRefund?: boolean;
  walletBalanceBefore?: string | number;
  walletBalanceAfter?: string | number;
};
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Operator = typeof operators.$inferSelect;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type MPIN = z.infer<typeof mpinSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;