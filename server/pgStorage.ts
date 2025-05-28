import { 
  users, User, InsertUser, 
  transactions, Transaction, InsertTransaction, 
  operators, Operator, InsertOperator,
  notifications, Notification, InsertNotification
} from "@shared/schema";
import { db, query } from "./db";
import { eq, desc, and, or, sql, count, sum, gte, lte, inArray } from "drizzle-orm";
import { formatCurrency, generateRandomId } from "../client/src/lib/utils";

// Helper function to normalize transaction types
function normalizeTransactionType(type: string): string {
  if (!type) return "UNKNOWN";
  
  const upperType = type.toUpperCase();
  
  if (upperType.includes("RECHARGE")) return "RECHARGE";
  if (upperType.includes("ADD") && upperType.includes("FUND")) return "ADD_FUND";
  if (upperType.includes("TRANSFER")) return "TRANSFER";
  if (upperType.includes("REFERRAL")) return "REFERRAL";
  if (upperType.includes("CASHBACK")) return "CASHBACK";
  
  return upperType;
}

// Database storage implementation
export class PgStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    
    // For each user, calculate totalSpent from SUCCESS transactions only
    const usersWithStats = await Promise.all(
      allUsers.map(async (user) => {
        // Calculate transaction stats
        const userTransactions = await db
          .select({
            count: count(transactions.id),
            total: sum(sql<number>`CAST(${transactions.amount} AS NUMERIC)`)
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              eq(transactions.status, 'SUCCESS')
            )
          );
        
        const totalAmount = userTransactions[0]?.total ? 
                           parseFloat(userTransactions[0].total.toString()) : 0;
        const transactionCount = userTransactions[0]?.count || 0;
        
        // Return user with transaction stats as User type
        return {
          ...user,
          totalSpent: totalAmount as number, // Force as number type
          transactionCount: transactionCount,
          transactionVolume: totalAmount as number, // Add this field too
          growth: 0 // Default growth to 0
        } as User;
      })
    );
    
    return usersWithStats;
  }
  
  async getTopUsersByTransactionType(type: string, limit: number = 10): Promise<User[]> {
    try {
      // First get user IDs with transaction statistics
      const userStats: Array<{userId: number, count: number, volume: number}> = [];
      
      if (type === 'ALL') {
        // Direct SQL for more reliable aggregation
        const result = await query(
          `SELECT "user_id", COUNT(*) as count, SUM(CAST(amount AS NUMERIC)) as volume 
           FROM transactions 
           WHERE status = 'SUCCESS' 
           GROUP BY "user_id" 
           ORDER BY volume DESC 
           LIMIT $1`,
          [limit]
        );
        
        // Map the result to our expected format
        userStats.push(...result.rows.map(row => ({
          userId: row.user_id,
          count: parseInt(row.count),
          volume: parseFloat(row.volume)
        })));
      } else if (type === 'CASHBACK') {
        // For cashback (commission) - get users with the highest commission values
        const result = await query(
          `SELECT id as user_id, 0 as count, CAST(commission AS NUMERIC) as volume 
           FROM users 
           WHERE is_active = true 
           ORDER BY CAST(commission AS NUMERIC) DESC 
           LIMIT $1`,
          [limit]
        );
        
        // Map the result to our expected format
        userStats.push(...result.rows.map(row => ({
          userId: row.user_id,
          count: parseInt(row.count || '0'),
          volume: parseFloat(row.volume || '0')
        })));
      } else {
        // For specific transaction types
        const result = await query(
          `SELECT "user_id", COUNT(*) as count, SUM(CAST(amount AS NUMERIC)) as volume 
           FROM transactions 
           WHERE status = 'SUCCESS' AND type = $1
           GROUP BY "user_id" 
           ORDER BY volume DESC 
           LIMIT $2`,
          [type, limit]
        );
        
        // Map the result to our expected format
        userStats.push(...result.rows.map(row => ({
          userId: row.user_id,
          count: parseInt(row.count),
          volume: parseFloat(row.volume)
        })));
      }
      
      // Get the user details for these users
      const topUsers: User[] = [];
      
      // Get all transactions from past 30 days for growth calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      for (const item of userStats) {
        const user = await this.getUser(item.userId);
        if (user) {
          // Calculate actual growth instead of using random number
          // Get transaction volume for current month (last 30 days)
          const currentMonthResult = await query(
            `SELECT SUM(CAST(amount AS NUMERIC)) as volume 
             FROM transactions 
             WHERE "user_id" = $1 AND status = 'SUCCESS' AND timestamp > $2`,
            [item.userId, thirtyDaysAgo.toISOString()]
          );
          
          // Get transaction volume for previous month (30-60 days ago)
          const previousMonthResult = await query(
            `SELECT SUM(CAST(amount AS NUMERIC)) as volume 
             FROM transactions 
             WHERE "user_id" = $1 AND status = 'SUCCESS' AND timestamp > $2 AND timestamp < $3`,
            [item.userId, sixtyDaysAgo.toISOString(), thirtyDaysAgo.toISOString()]
          );
          
          const currentVolume = parseFloat(currentMonthResult.rows[0]?.volume || '0');
          const previousVolume = parseFloat(previousMonthResult.rows[0]?.volume || '0');
          
          // Calculate growth percentage
          let growthPercentage = 0;
          if (previousVolume > 0) {
            growthPercentage = Math.round(((currentVolume - previousVolume) / previousVolume) * 100);
          } else if (currentVolume > 0) {
            growthPercentage = 100; // 100% growth if there was no previous activity
          }
          
          topUsers.push({
            ...user,
            // Add transaction statistics to the user object
            transactionCount: item.count,
            totalSpent: item.volume,
            transactionVolume: item.volume,
            growth: growthPercentage
          });
        }
      }
      
      return topUsers;
    } catch (error) {
      console.error('Error fetching top users by transaction type:', error);
      return [];
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Generate a unique referral code if none was provided
    if (!userData.referralCode) {
      userData.referralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    const [user] = await db.insert(users).values({
      ...userData,
      walletBalance: userData.walletBalance || "0",
      commission: userData.commission || "0",
      isAdmin: userData.isAdmin || false,
      isActive: true,
      isFirstLogin: true,
      referralPending: userData.referredBy ? true : false,
      referralCount: 0,
      referralEarnings: "0",
      createdAt: new Date()
    }).returning();

    // If referredBy is provided, update the referrer's data
    if (userData.referredBy) {
      const referrer = await this.getUserByReferralCode(userData.referredBy);
      if (referrer) {
        // Increment referral count
        const newCount = (referrer.referralCount || 0) + 1;
        // Add referral earnings (50 units per referral)
        const newEarnings = (parseFloat(referrer.referralEarnings) + 50).toString();
        
        await db.update(users)
          .set({ 
            referralCount: newCount,
            referralEarnings: newEarnings
          })
          .where(eq(users.id, referrer.id));
        
        // Add notification for referrer
        await this.createNotification({
          userId: referrer.id,
          message: `You earned ₹50 from a new referral: ${userData.username} [User ID: ${newUser.id}]`,
          type: 'REFERRAL',
          read: false
        });
      }
    }
    
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.count > 0;
  }

  // Transaction operations
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.timestamp));
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.timestamp));
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    // Generate a transaction ID if not provided
    if (!transactionData.transactionId) {
      transactionData.transactionId = generateRandomId();
    }

    // Normalize transaction type
    const normalizedType = normalizeTransactionType(transactionData.type);

    const [transaction] = await db.insert(transactions).values({
      ...transactionData,
      type: normalizedType, // Use normalized type
      timestamp: new Date(),
      operatorId: transactionData.operatorId || null,
      recipientId: transactionData.recipientId || null,
      ipAddress: transactionData.ipAddress || null,
      deviceInfo: transactionData.deviceInfo || null
    }).returning();

    // Only handle TRANSFER transactions' recipient updates, but don't modify wallet balance
    if (normalizedType === 'TRANSFER' && transaction.recipientId && transaction.status === 'SUCCESS') {
      const user = await this.getUser(transaction.userId);
      const recipient = await this.getUser(transaction.recipientId);
      
      if (recipient && user) {
        console.log(`Processing recipient notification for TRANSFER transaction ${transaction.id}`);
        
        // Create notification for recipient only
        await this.createNotification({
          userId: recipient.id,
          message: `You received ₹${transaction.amount} from User #${user.id} [Transaction ID: ${transaction.transactionId}]`,
          type: 'WALLET_CREDIT',
          read: false
        });
        console.log(`Created notification for recipient ${recipient.id}`);
      } else {
        console.log(`Recipient ${transaction.recipientId} not found for TRANSFER transaction ${transaction.id}`);
      }
    }
    
    return transaction;
  }

  async updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction> {
    // Normalize transaction type if it's being updated
    if (transactionData.type) {
      transactionData.type = normalizeTransactionType(transactionData.type);
    }
    
    // Get the current transaction to compare before updating
    const [currentTransaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
      
    if (!currentTransaction) {
      throw new Error(`Transaction with ID ${id} not found`);
    }
    
    const [updatedTransaction] = await db
      .update(transactions)
      .set(transactionData)
      .where(eq(transactions.id, id))
      .returning();
    
    // Only create notifications for TRANSFER recipient when status changes to SUCCESS
    if (currentTransaction.status !== 'SUCCESS' && updatedTransaction.status === 'SUCCESS' && 
        normalizeTransactionType(updatedTransaction.type) === 'TRANSFER' && updatedTransaction.recipientId) {
      
      const user = await this.getUser(updatedTransaction.userId);
      const recipient = await this.getUser(updatedTransaction.recipientId);
      
      if (recipient && user) {
        console.log(`Creating notification for recipient of TRANSFER transaction ${updatedTransaction.id}`);
        
        // Create notification for recipient
        await this.createNotification({
          userId: recipient.id,
          message: `You received ₹${updatedTransaction.amount} from User #${user.id} [Transaction ID: ${updatedTransaction.transactionId}]`,
          type: 'WALLET_CREDIT',
          read: false
        });
        console.log(`Created notification for recipient ${recipient.id}`);
      }
    }
    
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id));
    return result.count > 0;
  }

  // Operator operations
  async getOperator(id: number): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.id, id));
    return operator;
  }

  async getOperators(): Promise<Operator[]> {
    return await db.select().from(operators);
  }

  async getOperatorByCode(code: string): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.code, code));
    return operator;
  }

  async createOperator(operatorData: InsertOperator): Promise<Operator> {
    const [operator] = await db.insert(operators).values({
      ...operatorData,
      isEnabled: operatorData.isEnabled ?? true,
      logo: operatorData.logo || null
    }).returning();
    return operator;
  }

  async updateOperator(id: number, operatorData: Partial<Operator>): Promise<Operator> {
    const [updatedOperator] = await db
      .update(operators)
      .set(operatorData)
      .where(eq(operators.id, id))
      .returning();
    return updatedOperator;
  }

  async deleteOperator(id: number): Promise<boolean> {
    const result = await db.delete(operators).where(eq(operators.id, id));
    return result.count > 0;
  }

  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).orderBy(desc(notifications.timestamp));
  }

  async getNotificationsByUserId(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.timestamp));
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({
      ...notificationData,
      timestamp: new Date(),
      read: notificationData.read ?? false
      // metadata removed as requested
    }).returning();
    return notification;
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification> {
    const [updatedNotification] = await db
      .update(notifications)
      .set(notificationData)
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id));
    return result.count > 0;
  }

  // Helper method to get a user by referral code
  private async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referralCode));
    return user;
  }

  // Dashboard statistics
  async getDashboardStats(dateRange?: { startDate?: Date, endDate?: Date }): Promise<any> {
    // Current period date range
    const currentStartDate = dateRange?.startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const currentEndDate = dateRange?.endDate || new Date();
    
    // Previous period date range (same duration as current period, just earlier)
    const periodDuration = currentEndDate.getTime() - currentStartDate.getTime();
    const previousStartDate = new Date(currentStartDate.getTime() - periodDuration);
    const previousEndDate = new Date(currentEndDate.getTime() - periodDuration);
    
    // Get users stats for current period
    const userStats = await db
      .select({
        total: count(users.id),
        active: count(sql`CASE WHEN ${users.isActive} = true THEN 1 ELSE NULL END`),
        admins: count(sql`CASE WHEN ${users.isAdmin} = true THEN 1 ELSE NULL END`),
        totalWalletBalance: sum(sql<number>`CAST(${users.walletBalance} AS NUMERIC)`),
        totalCommission: sum(sql<number>`CAST(${users.commission} AS NUMERIC)`)
      })
      .from(users);
    
    // Get previous period user stats with proper date filtering
    // For comparison, use users who were active during the previous period
    // Get user activity from transactions in the previous period
    const usersActiveInPreviousPeriod = await db
      .select({ userId: transactions.userId })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${previousStartDate}`,
          sql`${transactions.timestamp} <= ${previousEndDate}`
        )
      )
      .groupBy(transactions.userId);
      
    // Get stats for these users
    const previousUserIds = usersActiveInPreviousPeriod.map(u => u.userId);
    
    const previousUserStats = await db
      .select({
        total: count(users.id),
        totalWalletBalance: sum(sql<number>`CAST(${users.walletBalance} AS NUMERIC)`),
        totalCommission: sum(sql<number>`CAST(${users.commission} AS NUMERIC)`)
      })
      .from(users)
      .where(
        // If we have active users in the previous period, filter by them
        // Otherwise, include all users (fallback)
        previousUserIds.length > 0 
        ? inArray(users.id, previousUserIds) 
        : sql`1=1`
      );
      
    // Get transactions stats for current period
    const transactionStats = await db
      .select({
        total: count(transactions.id),
        successful: count(sql`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN 1 ELSE NULL END`),
        pending: count(sql`CASE WHEN ${transactions.status} = 'Pending' OR ${transactions.status} = 'PENDING' THEN 1 ELSE NULL END`),
        failed: count(sql`CASE WHEN ${transactions.status} = 'Failed' OR ${transactions.status} = 'FAILED' THEN 1 ELSE NULL END`),
        refund: count(sql`CASE WHEN UPPER(${transactions.status}) = 'REFUND' THEN 1 ELSE NULL END`),
        volume: sum(sql<number>`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        pendingVolume: sum(sql<number>`CASE WHEN ${transactions.status} = 'Pending' OR ${transactions.status} = 'PENDING' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        failedVolume: sum(sql<number>`CASE WHEN ${transactions.status} = 'Failed' OR ${transactions.status} = 'FAILED' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        refundVolume: sum(sql<number>`CASE WHEN UPPER(${transactions.status}) = 'REFUND' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        rechargeVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Recharge' OR ${transactions.type} = 'RECHARGE' OR ${transactions.type} = 'Mobile Recharge') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        addFundVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Fund Add' OR ${transactions.type} = 'ADD_FUND' OR ${transactions.type} = 'Add Fund' OR ${transactions.type} = 'ADDFUND') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        transferVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Transfer' OR ${transactions.type} = 'TRANSFER' OR ${transactions.type} = 'Money Transfer') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        cashbackVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Cashback' OR ${transactions.type} = 'CASHBACK' OR ${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${currentStartDate}`,
          sql`${transactions.timestamp} <= ${currentEndDate}`
        )
      );
      
    // Get previous period transaction stats
    const previousTransactionStats = await db
      .select({
        total: count(transactions.id),
        volume: sum(sql<number>`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        rechargeVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Recharge' OR ${transactions.type} = 'RECHARGE' OR ${transactions.type} = 'Mobile Recharge') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        addFundVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Fund Add' OR ${transactions.type} = 'ADD_FUND' OR ${transactions.type} = 'Add Fund' OR ${transactions.type} = 'ADDFUND') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        transferVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Transfer' OR ${transactions.type} = 'TRANSFER' OR ${transactions.type} = 'Money Transfer') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
        cashbackVolume: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Cashback' OR ${transactions.type} = 'CASHBACK' OR ${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${previousStartDate}`,
          sql`${transactions.timestamp} <= ${previousEndDate}`
        )
      );
    
    // Get transaction type distribution
    const typeDistribution = await db
      .select({
        type: transactions.type,
        count: count(transactions.id)
      })
      .from(transactions)
      .groupBy(transactions.type);
    
    // Get referral stats for current period - using both transactions and users table
    const referralTransactions = await db
      .select({
        totalReferrals: count(transactions.id),
        totalEarnings: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${currentStartDate}`,
          sql`${transactions.timestamp} <= ${currentEndDate}`,
          or(
            eq(transactions.type, 'Referral'),
            eq(transactions.type, 'REFERRAL')
          )
        )
      );
      
    // Calculate total referral earnings from users table
    const userReferralEarnings = await db
      .select({
        totalReferralEarnings: sum(sql<number>`CAST(COALESCE(${users.referralEarnings}, '0') AS NUMERIC)`)
      })
      .from(users);
      
    // Get previous period referral stats - using transactions
    const previousReferralTransactions = await db
      .select({
        totalReferrals: count(transactions.id),
        totalEarnings: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${previousStartDate}`,
          sql`${transactions.timestamp} <= ${previousEndDate}`,
          or(
            eq(transactions.type, 'Referral'),
            eq(transactions.type, 'REFERRAL')
          )
        )
      );
    
    // Get recent transactions filtered by date range
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${currentStartDate}`,
          sql`${transactions.timestamp} <= ${currentEndDate}`
        )
      )
      .orderBy(desc(transactions.timestamp))
      .limit(5);
    
    // Get active users during the period and sort by wallet balance
    const activeUserIds = await db
      .select({ userId: transactions.userId })
      .from(transactions)
      .where(
        and(
          sql`${transactions.timestamp} >= ${currentStartDate}`,
          sql`${transactions.timestamp} <= ${currentEndDate}`
        )
      )
      .groupBy(transactions.userId);
      
    const activeUserIdList = activeUserIds.map(u => u.userId);
    
    // Get top users by wallet balance, filtering for active users if we have any
    const topUsers = await db
      .select()
      .from(users)
      .where(
        // If we have active users in the period, filter by them
        // Otherwise, include all users (fallback)
        activeUserIdList.length > 0 
        ? inArray(users.id, activeUserIdList) 
        : sql`1=1`
      )
      .orderBy(desc(sql<number>`CAST(${users.walletBalance} AS NUMERIC)`))
      .limit(5);
    
    // Get top operators and calculate success rate with proper date filtering
    const allOperators = await db.select().from(operators);
    const operatorPerformance = [];
    
    for (const operator of allOperators) {
      // Use date range filters in the operator transaction query
      const operatorTransactions = await db
        .select({
          total: count(transactions.id),
          successful: count(sql`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN 1 ELSE NULL END`),
          volume: sum(sql<number>`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.operatorId, operator.id),
            sql`${transactions.timestamp} >= ${currentStartDate}`,
            sql`${transactions.timestamp} <= ${currentEndDate}`
          )
        );
      
      // Calculate success rate based on filtered transactions
      const successRate = operatorTransactions[0].total > 0 
        ? parseFloat(((operatorTransactions[0].successful / operatorTransactions[0].total) * 100).toFixed(2)) 
        : 0;
      
      // Include volume information for the operator during this period
      const volume = parseFloat(operatorTransactions[0].volume?.toString() || '0');
      
      operatorPerformance.push({
        ...operator,
        successRate,
        volume,
        transactionCount: operatorTransactions[0].total
      });
    }
    
    // Generate trend data
    const dailyTrends = await this.getTransactionTrends('day', 7);
    const weeklyTrends = await this.getTransactionTrends('week', 4);
    const monthlyTrends = await this.getTransactionTrends('month', 6);
    
    // Calculate average transaction amount - only for successful transactions, display with 2 decimal places
    const avgTransaction = transactionStats[0].successful > 0 
      ? parseFloat((transactionStats[0].volume / transactionStats[0].successful).toFixed(2))
      : 0;
    
    // Calculate success rate - display with 2 decimal places
    const successRate = transactionStats[0].total > 0 
      ? parseFloat((transactionStats[0].successful / transactionStats[0].total * 100).toFixed(2))
      : 0;
    
    // Format transaction types for chart - normalize types to avoid duplicates
    const colors = ['#1976D2', '#2E7D32', '#FF5722', '#9C27B0'];
    
    // Create a map to normalize and combine transaction types
    const normalizedTypes = new Map();
    
    // Use our global normalizeTransactionType function, but format for display
    const normalizeTypeName = (type: string): string => {
      // First use our global normalizer to ensure consistent base types
      const normalizedType = normalizeTransactionType(type);
      
      // Format for display (capitalize first letter, space out words)
      switch (normalizedType) {
        case 'RECHARGE': return 'Recharge';
        case 'ADD_FUND': return 'Add Fund';
        case 'TRANSFER': return 'Transfer';
        case 'CASHBACK': return 'Cashback';
        case 'REFERRAL': return 'Referral';
        default:
          // Default - use original with first letter capitalized
          return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      }
    };
    
    // Normalize and combine counts for similar transaction types
    typeDistribution.forEach(item => {
      const normalizedName = normalizeTypeName(item.type);
      
      if (normalizedTypes.has(normalizedName)) {
        normalizedTypes.set(normalizedName, normalizedTypes.get(normalizedName) + item.count);
      } else {
        normalizedTypes.set(normalizedName, item.count);
      }
    });
    
    // Convert to array format needed for chart
    const transactionTypes = Array.from(normalizedTypes.entries()).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length]
    }));
    
    // Helper function to calculate growth percentage
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0; // If previous was 0, and we now have values, that's 100% growth
      }
      
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };
    
    // Calculate growth percentages for main metrics
    const userGrowth = calculateGrowth(
      userStats[0].total, 
      previousUserStats[0].total || 0
    );
    
    const transactionGrowth = calculateGrowth(
      transactionStats[0].total, 
      previousTransactionStats[0].total || 0
    );
    
    const revenueGrowth = calculateGrowth(
      transactionStats[0].volume || 0, 
      previousTransactionStats[0].volume || 0
    );
    
    // Calculate referral metrics combining transaction data and user table data
    const currentReferralCount = Number(referralTransactions[0].totalReferrals || 0);
    
    // For referral earnings, we should use transaction data when date filtering is applied
    // Only use the users table total for "All Time" view (when no date range is specified)
    let currentReferralEarnings = 0;
    if (!dateRange?.startDate && !dateRange?.endDate) {
      // No date range specified - use users table total (global total) as it's more accurate for "All Time"
      const userTableReferralEarnings = parseFloat((userReferralEarnings[0].totalReferralEarnings?.toString() || '0'));
      currentReferralEarnings = userTableReferralEarnings;
    } else {
      // Date range is specified - use transaction-based total for the specified period
      const transactionReferralEarnings = parseFloat((referralTransactions[0].totalEarnings?.toString() || '0'));
      currentReferralEarnings = transactionReferralEarnings;
    }
    const previousReferralCount = Number(previousReferralTransactions[0].totalReferrals || 0);
    const previousReferralEarnings = parseFloat((previousReferralTransactions[0].totalEarnings?.toString() || '0'));
    
    // Compute growth percentages
    const referralCountGrowth = calculateGrowth(currentReferralCount, previousReferralCount);
    const referralEarningsGrowth = calculateGrowth(currentReferralEarnings, previousReferralEarnings);
    
    // Calculate cashback amount from transactions when date range is applied
    // For cashback, we need to consider both Cashback and Referral transaction types
    let currentCashback = 0;
    let previousCashback = 0;
    
    if (!dateRange?.startDate && !dateRange?.endDate) {
      // No date filtering - use the total commission from users table for "All Time" view
      currentCashback = parseFloat(userStats[0].totalCommission?.toString() || '0');
      previousCashback = parseFloat(previousUserStats[0].totalCommission?.toString() || '0');
    } else {
      // Date range is specified - calculate from transactions within that range
      // Using the same date variables that were defined earlier in the function
      const cashbackTransactions = await db
        .select({
          total: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Cashback' OR ${transactions.type} = 'CASHBACK' OR ${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
        })
        .from(transactions)
        .where(
          and(
            sql`${transactions.timestamp} >= ${currentStartDate}`,
            sql`${transactions.timestamp} <= ${currentEndDate}`
          )
        );
        
      const previousCashbackTransactions = await db
        .select({
          total: sum(sql<number>`CASE WHEN (${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS') AND (${transactions.type} = 'Cashback' OR ${transactions.type} = 'CASHBACK' OR ${transactions.type} = 'Referral' OR ${transactions.type} = 'REFERRAL') THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
        })
        .from(transactions)
        .where(
          and(
            sql`${transactions.timestamp} >= ${previousStartDate}`,
            sql`${transactions.timestamp} <= ${previousEndDate}`
          )
        );
        
      // Set currentCashback and previousCashback from transaction data
      currentCashback = parseFloat(cashbackTransactions[0].total?.toString() || '0');
      previousCashback = parseFloat(previousCashbackTransactions[0].total?.toString() || '0');
    }
    
    const cashbackGrowth = calculateGrowth(currentCashback, previousCashback);
    
    // Calculate wallet balance growth
    const currentWalletBalance = parseFloat(userStats[0].totalWalletBalance?.toString() || '0');
    const previousWalletBalance = parseFloat(previousUserStats[0].totalWalletBalance?.toString() || '0');
    const walletBalanceGrowth = calculateGrowth(currentWalletBalance, previousWalletBalance);
    
    // Transform user data for top users section
    const topUsersWithStats = await Promise.all(
      topUsers.map(async (user) => {
        const userTransactions = await db
          .select({
            count: count(transactions.id),
            total: sum(sql<number>`CAST(${transactions.amount} AS NUMERIC)`)
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              eq(transactions.status, 'SUCCESS')
            )
          );
          
        // Get previous period transactions for this user
        const previousUserTransactions = await db
          .select({
            count: count(transactions.id),
            total: sum(sql<number>`CAST(${transactions.amount} AS NUMERIC)`)
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              eq(transactions.status, 'SUCCESS'),
              sql`${transactions.timestamp} >= ${previousStartDate}`,
              sql`${transactions.timestamp} <= ${previousEndDate}`
            )
          );
        
        // Calculate user growth
        const currentTotal = userTransactions[0].total || 0;
        const previousTotal = previousUserTransactions[0].total || 0;
        const userTransactionGrowth = calculateGrowth(currentTotal, previousTotal);
        
        return {
          ...user,
          totalSpent: currentTotal,
          transactionCount: userTransactions[0].count || 0,
          growth: userTransactionGrowth
        };
      })
    );
    
    return {
      metrics: {
        users: {
          total: userStats[0].total,
          active: userStats[0].active,
          inactive: userStats[0].total - userStats[0].active,
          admins: userStats[0].admins,
          regularUsers: userStats[0].total - userStats[0].admins,
          totalWalletBalance: parseFloat(userStats[0].totalWalletBalance?.toString() || '0'),
          walletBalanceGrowth: walletBalanceGrowth,
          growth: userGrowth
        },
        transactions: {
          total: transactionStats[0].total,
          successful: transactionStats[0].successful,
          pending: transactionStats[0].pending,
          failed: transactionStats[0].failed,
          refund: transactionStats[0].refund,
          pendingAmount: parseFloat(transactionStats[0].pendingVolume?.toString() || '0'),
          failedAmount: parseFloat(transactionStats[0].failedVolume?.toString() || '0'),
          refundAmount: parseFloat(transactionStats[0].refundVolume?.toString() || '0'),
          growth: transactionGrowth
        },
        revenue: {
          total: transactionStats[0].volume || 0,
          growth: revenueGrowth
        },
        referrals: {
          total: currentReferralCount,
          earnings: currentReferralEarnings,
          growth: referralEarningsGrowth
        },
        transactionTypes: {
          recharge: parseFloat(transactionStats[0].rechargeVolume?.toString() || '0'),
          addFund: parseFloat(transactionStats[0].addFundVolume?.toString() || '0'), 
          transfer: parseFloat(transactionStats[0].transferVolume?.toString() || '0'),
          cashback: currentCashback
        },
        cashback: {
          total: currentCashback,
          growth: cashbackGrowth
        }
      },
      chartData: {
        daily: dailyTrends,
        weekly: weeklyTrends,
        monthly: monthlyTrends
      },
      transactionVolume: transactionStats[0].volume || 0,
      successRate,
      avgTransaction,
      transactionTypes,
      transactions: recentTransactions,
      users: topUsersWithStats,
      operators: operatorPerformance.slice(0, 5)
    };
  }

  // Helper method to get transaction trends
  private async getTransactionTrends(
    interval: 'day' | 'week' | 'month', 
    limit: number
  ): Promise<any[]> {
    const result = [];
    const now = new Date();
    
    for (let i = 0; i < limit; i++) {
      const date = new Date(now);
      let startDate, endDate;
      
      if (interval === 'day') {
        date.setDate(date.getDate() - i);
        startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      } else if (interval === 'week') {
        date.setDate(date.getDate() - (i * 7));
        startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        const endDateTemp = new Date(startDate);
        endDateTemp.setDate(endDateTemp.getDate() + 6);
        endDate = new Date(endDateTemp.getFullYear(), endDateTemp.getMonth(), endDateTemp.getDate(), 23, 59, 59, 999);
      } else if (interval === 'month') {
        date.setMonth(date.getMonth() - i);
        startDate = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      
      let transactionResults = { successAmount: 0, pendingAmount: 0, failedAmount: 0, refundAmount: 0 };
      
      // If we have transactions in our database, query them
      if (startDate && endDate) {
        const query = db
          .select({
            successAmount: sum(sql<number>`CASE WHEN ${transactions.status} = 'Successful' OR ${transactions.status} = 'SUCCESS' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
            pendingAmount: sum(sql<number>`CASE WHEN ${transactions.status} = 'Pending' OR ${transactions.status} = 'PENDING' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
            failedAmount: sum(sql<number>`CASE WHEN ${transactions.status} = 'Failed' OR ${transactions.status} = 'FAILED' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`),
            refundAmount: sum(sql<number>`CASE WHEN UPPER(${transactions.status}) = 'REFUND' THEN CAST(${transactions.amount} AS NUMERIC) ELSE 0 END`)
          })
          .from(transactions)
          .where(
            and(
              sql`${transactions.timestamp} >= ${startDate}`,
              sql`${transactions.timestamp} <= ${endDate}`
            )
          );
        
        const queryResults = await query;
        if (queryResults[0]) {
          transactionResults = {
            successAmount: queryResults[0].successAmount || 0,
            pendingAmount: queryResults[0].pendingAmount || 0,
            failedAmount: queryResults[0].failedAmount || 0,
            refundAmount: queryResults[0].refundAmount || 0
          };
        }
      }
      
      // Format the label based on the interval
      let name = '';
      if (interval === 'day' && startDate) {
        name = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (interval === 'week' && startDate && endDate) {
        name = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      } else if (interval === 'month' && startDate) {
        name = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        // Fallback
        name = `Period ${i + 1}`;
      }
      
      result.push({
        name,
        amount: transactionResults.successAmount,
        successAmount: transactionResults.successAmount,
        pendingAmount: transactionResults.pendingAmount,
        failedAmount: transactionResults.failedAmount,
        refundAmount: transactionResults.refundAmount
      });
    }
    
    // Return in chronological order
    return result.reverse();
  }

  async getReferralStats(dateRange?: { startDate?: Date, endDate?: Date }, timeFrame: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<any> {
    const allUsers = await this.getUsers();
    let transactions = await this.getTransactions();
    
    // Filter transactions by date range if provided
    if (dateRange) {
      if (dateRange.startDate) {
        const startDateObj = new Date(dateRange.startDate);
        transactions = transactions.filter(t => new Date(t.timestamp) >= startDateObj);
      }
      if (dateRange.endDate) {
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999); // End of the day
        transactions = transactions.filter(t => new Date(t.timestamp) <= endDate);
      }
    }
    
    // Filter to only referral transactions - using our global normalization function
    const normalizeTypeName = (type: string): string => {
      // First use our global normalizer to ensure consistent base types
      const normalizedType = normalizeTransactionType(type);
      
      // Format for display (capitalize first letter, space out words)
      switch (normalizedType) {
        case 'RECHARGE': return 'Recharge';
        case 'ADD_FUND': return 'Add Fund';
        case 'CASHBACK': return 'Cashback';
        case 'TRANSFER': return 'Transfer';
        case 'REFERRAL': return 'Referral';
        default:
          // Default - use original with first letter capitalized
          return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      }
    };
    
    const referralTransactions = transactions.filter(t => normalizeTypeName(t.type) === 'Referral');
    
    // Calculate total referrals
    const totalReferrals = allUsers.reduce((sum, user) => sum + (user.referralCount || 0), 0);
    
    // Calculate total earnings
    const totalEarnings = allUsers.reduce((sum, user) => sum + parseFloat(user.referralEarnings || '0'), 0);
    
    // Calculate average earnings per referral
    const averageEarningsPerReferral = totalReferrals > 0 ? totalEarnings / totalReferrals : 0;
    
    // Generate time-based stats based on the selected timeFrame
    let timeStats = [];
    const now = new Date();
    
    // Helper function to format date based on timeFrame
    const formatPeriod = (date: Date): string => {
      if (timeFrame === 'daily') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timeFrame === 'weekly') {
        // Get the week number
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        return `Week ${weekNum}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short' });
      }
    };
    
    // Calculate how many periods to show
    const periodsToShow = timeFrame === 'daily' ? 14 : timeFrame === 'weekly' ? 8 : 6;
    
    // Generate stat periods
    for (let i = periodsToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      let periodStart, periodEnd;
      
      if (timeFrame === 'daily') {
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setHours(23, 59, 59, 999);
      } else if (timeFrame === 'weekly') {
        // Go back i weeks
        date.setDate(date.getDate() - (i * 7));
        // Set to the beginning of the week (Sunday)
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
      } else {
        // Monthly
        date.setMonth(date.getMonth() - i);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        periodStart = new Date(date);
        periodEnd = new Date(date);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(0); // Last day of the month
        periodEnd.setHours(23, 59, 59, 999);
      }
      
      const periodTransactions = referralTransactions.filter(t => {
        const txDate = new Date(t.timestamp);
        return txDate >= periodStart! && txDate <= periodEnd!;
      });
      
      const referrals = periodTransactions.length;
      const earnings = periodTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      timeStats.push({
        period: formatPeriod(periodStart),
        referrals,
        earnings
      });
    }
    
    // Create referral relationships
    const users = await Promise.all(
      allUsers.map(async (user) => {
        const referredUsers = allUsers.filter(u => u.referredBy === user.referralCode);
        const totalEarnings = parseFloat(user.referralEarnings || '0');
        
        return {
          ...user,
          referredUsers,
          totalEarnings
        };
      })
    );
    
    // Sort by number of referrals (highest first)
    const sortedUsers = users.sort((a, b) => 
      (b.referralCount || 0) - (a.referralCount || 0)
    );
    
    return {
      totalReferrals,
      totalEarnings,
      averageEarningsPerReferral,
      timeStats,
      timeFrame,
      users: sortedUsers
    };
  }
}

export const pgStorage = new PgStorage();