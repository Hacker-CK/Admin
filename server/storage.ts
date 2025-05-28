import { 
  users, User, InsertUser, 
  transactions, Transaction, InsertTransaction, 
  operators, Operator, InsertOperator,
  notifications, Notification, InsertNotification
} from "@shared/schema";

// Comprehensive storage interface with CRUD operations for all entities
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<boolean>;

  // Transaction operations
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByUserId(userId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<boolean>;

  // Operator operations
  getOperator(id: number): Promise<Operator | undefined>;
  getOperators(): Promise<Operator[]>;
  getOperatorByCode(code: string): Promise<Operator | undefined>;
  createOperator(operator: InsertOperator): Promise<Operator>;
  updateOperator(id: number, operatorData: Partial<Operator>): Promise<Operator>;
  deleteOperator(id: number): Promise<boolean>;

  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotifications(): Promise<Notification[]>;
  getNotificationsByUserId(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification>;
  deleteNotification(id: number): Promise<boolean>;

  // Dashboard statistics
  getDashboardStats(): Promise<any>;
  getReferralStats(): Promise<any>;
}

// Export the PostgreSQL storage implementation
import { pgStorage } from './pgStorage';
export const storage = pgStorage;