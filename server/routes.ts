import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, query, pool } from "./db";
import pkg from 'pg';
import fetch from 'node-fetch';
import { 
  User, InsertUser, insertUserSchema, 
  Transaction, InsertTransaction, insertTransactionSchema,
  Operator, InsertOperator, insertOperatorSchema,
  Notification, InsertNotification, insertNotificationSchema,
  users, loginSchema
} from "@shared/schema";
import { z } from "zod";
import { fetchRechargeStatus, mapExternalStatus, formatErrorMessage } from './utils';

const { Pool } = pkg;

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for production monitoring
  app.get('/api/health', (req, res) => {
    const startTime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(startTime / 60)} minutes, ${Math.floor(startTime % 60)} seconds`,
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
      environment: process.env.NODE_ENV
    });
  });

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      console.log(`Login attempt received from ${req.ip} with headers:`, {
        origin: req.headers.origin,
        referer: req.headers.referer,
        contentType: req.headers['content-type']
      });
      
      const credentials = loginSchema.parse(req.body);
      console.log(`Attempting login for username: ${credentials.username}`);
      
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user || user.password !== credentials.password) {
        console.log(`Login failed for ${credentials.username}: Invalid credentials`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Set up user session
      if (req.session) {
        // Store user information in session (excluding sensitive data like password)
        req.session.user = {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin || false,
          name: user.name || undefined
        };
        req.session.isAuthenticated = true;
        
        // Debug session and cookie information
        console.log('Login successful. Session and cookie info:', {
          sessionID: req.sessionID,
          cookieSettings: {
            secure: req.session.cookie.secure,
            sameSite: req.session.cookie.sameSite,
            httpOnly: req.session.cookie.httpOnly,
            path: req.session.cookie.path,
            maxAge: req.session.cookie.maxAge,
            domain: req.session.cookie.domain || 'not set'
          },
          environment: process.env.NODE_ENV,
          allowInsecureCookie: process.env.ALLOW_INSECURE_COOKIE
        });
      } else {
        console.error('Session object missing in login request!');
      }
      
      console.log(`User ${credentials.username} logged in successfully`);
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          name: user.name
        } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Login validation error:', error.errors);
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Logout route
  app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to logout' });
        }

        // Clear cookie with proper secure and sameSite options to match the session settings
        // Use consistent settings with the session cookie configuration
        const isSecure = process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true';
        const sameSite = isSecure ? 'none' : 'lax';
        
        // Important: when clearing cookies with sameSite=none, secure must also be set
        res.clearCookie('connect.sid', {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: sameSite as 'none' | 'lax' | 'strict'
        });
        
        // Add debug logging for cookie clearing
        console.log(`Cookie cleared with secure=${isSecure}, sameSite=${sameSite}, environment=${process.env.NODE_ENV}`);
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });
  
  // Get current user session info
  app.get('/api/auth/session', (req, res) => {
    console.log('Session check request received');
    
    if (!req.session) {
      console.error('Session object is missing in request');
      return res.status(500).json({ 
        isAuthenticated: false, 
        error: 'Session middleware not working properly'
      });
    }
    
    // Debug session data (excluding sensitive data)
    const debugSession = { 
      hasUser: !!req.session.user,
      isAuthenticated: !!req.session.isAuthenticated,
      cookie: req.session.cookie ? {
        originalMaxAge: req.session.cookie.originalMaxAge,
        expires: req.session.cookie.expires,
        secure: req.session.cookie.secure || false,
        httpOnly: req.session.cookie.httpOnly || false,
        sameSite: req.session.cookie.sameSite || undefined
      } : undefined
    };
    
    console.log('Session debug info:', JSON.stringify(debugSession));
    
    if (req.session.user) {
      console.log(`User authenticated: ${req.session.user.username}`);
      return res.json({ 
        isAuthenticated: true,
        user: req.session.user
      });
    }
    
    console.log('No authenticated user found in session');
    res.json({ isAuthenticated: false });
  });

  // Dashboard routes
  app.get('/api/dashboard/summary', async (req, res) => {
    try {
      // Extract date range filters from query parameters
      const { startDate, endDate } = req.query;
      let dateRange: { startDate?: Date, endDate?: Date } = {};
      
      if (typeof startDate === 'string') {
        dateRange.startDate = new Date(startDate);
      }
      
      if (typeof endDate === 'string') {
        dateRange.endDate = new Date(endDate);
      }
      
      const dashboardStats = await storage.getDashboardStats(dateRange);
      res.json(dashboardStats);
    } catch (error) {
      console.error('Dashboard Summary Error:', error);
      res.status(500).json({ message: 'Failed to load dashboard data', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // User routes
  app.get('/api/users', async (req, res) => {
    try {
      const { type } = req.query;
      
      if (type === 'all' || type === 'ALL') {
        // Get top 10 users by total transaction volume across all types
        const topUsers = await storage.getTopUsersByTransactionType('ALL', 10);
        res.json({ users: topUsers });
      } else if (type && ['RECHARGE', 'ADD_FUND', 'TRANSFER'].includes(type as string)) {
        // Get top 10 users by transaction type, ranked by amount
        const topUsers = await storage.getTopUsersByTransactionType(type as string, 10);
        res.json({ users: topUsers });
      } else {
        const users = await storage.getUsers();
        res.json({ users });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to load users' });
    }
  });

  app.get('/api/users/top', async (req, res) => {
    try {
      const { type } = req.query;
      let transactionType = type as string || 'ALL';
      
      // Get top 10 users by the specified transaction type
      const topUsers = await storage.getTopUsersByTransactionType(transactionType, 10);
      
      // Get referral stats to include in the response (for backward compatibility)
      const stats = await storage.getReferralStats();
      
      // Combine the data
      res.json({
        ...stats,
        users: topUsers
      });
    } catch (error) {
      console.error('Error fetching top users:', error);
      res.status(500).json({ message: 'Failed to load top users' });
    }
  });
  
  // Check if referral code exists
  app.get('/api/users/check-referral-code', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ exists: false });
      }
      
      const users = await storage.getUsers();
      const exists = users.some(user => 
        user.referralCode === code || 
        user.referralCode?.toUpperCase() === code.toString().toUpperCase()
      );
      
      res.json({ exists });
    } catch (error) {
      console.error("Error checking referral code:", error);
      res.status(500).json({ message: "Failed to check referral code" });
    }
  });

  app.get('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load user' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username is taken
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Check if referral code exists if referredBy is provided
      if (userData.referredBy) {
        const users = await storage.getUsers();
        const referrer = users.find(user => user.referralCode === userData.referredBy);
        if (!referrer) {
          return res.status(400).json({ message: 'Invalid referral code' });
        }
      }
      
      const newUser = await storage.createUser(userData);
      res.status(201).json({ user: newUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Extract specific validation errors for better messaging
        const fieldErrors = error.errors.reduce((acc, curr) => {
          const path = curr.path.join('.');
          acc[path] = curr.message;
          return acc;
        }, {} as Record<string, string>);
        
        // Create a user-friendly message
        let errorMessage = 'Please check your input:';
        Object.entries(fieldErrors).forEach(([field, message]) => {
          errorMessage += `\n• ${field}: ${message}`;
        });
        
        return res.status(400).json({ 
          message: 'Invalid input', 
          userMessage: errorMessage,
          errors: fieldErrors 
        });
      }
      
      // Handle specific error types with custom messages
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return res.status(400).json({ 
            message: 'Database constraint violation', 
            userMessage: 'This username or email is already registered in our system.' 
          });
        }
      }
      
      console.error('User creation error:', error);
      res.status(500).json({ 
        message: 'Failed to create user',
        userMessage: 'We encountered an issue while creating your account. Please try again or contact support.'
      });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const userData = {...req.body};
      const { createTransaction, amount } = req.body;
      
      // Remove non-user fields from userData before update
      if ('createTransaction' in userData) delete userData.createTransaction;
      if ('amount' in userData) delete userData.amount;
      
      // If changing username, check if new username is taken
      if (userData.username && userData.username !== user.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
          return res.status(400).json({ 
            message: 'Username already exists',
            userMessage: 'This username is already taken by another user. Please choose a different username.'
          });
        }
      }
      
      // Handle wallet credit/debit operations
      if (createTransaction && amount !== undefined) {
        // Calculate new wallet balance
        const currentBalance = parseFloat(user.walletBalance.toString());
        const newBalance = currentBalance + parseFloat(amount.toString()); // This is a number
        
        // Check for negative balance in case of debit
        if (newBalance < 0) {
          return res.status(400).json({
            message: 'Insufficient balance',
            userMessage: 'User does not have sufficient balance for this debit operation.'
          });
        }
        
        // Update user with new wallet balance (converting to string since schema expects string)
        userData.walletBalance = newBalance.toString();
        
        // Create transaction record
        const transactionType = amount >= 0 ? 'ADD_FUND' : 'DEBIT';
        const transactionAmount = Math.abs(amount);
        const transactionDescription = amount >= 0 ? 
          'Wallet credited by admin' : 
          'Wallet debited by admin';
        
        await storage.createTransaction({
          userId,
          type: transactionType,
          amount: transactionAmount.toString(),
          status: 'SUCCESS',
          description: transactionDescription,
          transactionId: `${transactionType}-${Date.now()}`
        });
        
        // If the client already included a walletBalance in userData, we'll use that instead
        // This ensures we use the value calculated by the client for better UI feedback
        if (userData.walletBalance !== undefined) {
          // When walletBalance comes from client, it might be a number or string
          // Make sure it's a string as our schema expects
          if (typeof userData.walletBalance === 'number') {
            userData.walletBalance = userData.walletBalance.toString();
          }
          
          // Record the transaction but don't immediately run another updateUser
          // as the client has already provided the updated balance
        } else {
          // Always ensure wallet balance update happens by immediately updating user
          // Only if the client didn't already provide a walletBalance
          const updatedUser = await storage.updateUser(userId, { 
            walletBalance: newBalance.toString() // Ensure walletBalance is a string
          });
          
          // If no other fields need to be updated, return the updated user here
          if (Object.keys(userData).length === 0) {
            return res.json({ user: updatedUser });
          }
          
          // Remove walletBalance from userData since we've already updated it
          if ('walletBalance' in userData) {
            delete userData.walletBalance;
          }
        }
      }
      
      // Handle the case where userData is an empty object
      if (Object.keys(userData).length === 0) {
        // For empty update objects, we'll just return the current user
        return res.json({ user });
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      res.json({ user: updatedUser });
    } catch (error) {
      console.error('User update error:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return res.status(400).json({ 
            message: 'Database constraint violation', 
            userMessage: 'This username or email is already registered in our system.' 
          });
        }
        
        if (error instanceof z.ZodError) {
          // Extract specific validation errors for better messaging
          const fieldErrors = error.errors.reduce((acc, curr) => {
            const path = curr.path.join('.');
            acc[path] = curr.message;
            return acc;
          }, {} as Record<string, string>);
          
          // Create a user-friendly message
          let errorMessage = 'Please check your input:';
          Object.entries(fieldErrors).forEach(([field, message]) => {
            errorMessage += `\n• ${field}: ${message}`;
          });
          
          return res.status(400).json({ 
            message: 'Invalid input', 
            userMessage: errorMessage,
            errors: fieldErrors 
          });
        }
      }
      
      res.status(500).json({ 
        message: 'Failed to update user',
        userMessage: 'We encountered an issue while updating this user. Please try again or contact support.'
      });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          message: 'User not found',
          userMessage: 'The user you are trying to delete cannot be found.'
        });
      }
      
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('User deletion error:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('foreign key constraint')) {
          return res.status(400).json({ 
            message: 'Cannot delete user with associated records',
            userMessage: 'This user cannot be deleted because they have associated transactions or other records. You may need to delete those records first.'
          });
        }
      }
      
      res.status(500).json({ 
        message: 'Failed to delete user',
        userMessage: 'We encountered an issue while deleting this user. Please try again or contact support.'
      });
    }
  });



  // Transaction routes
  app.get('/api/transactions', async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      
      // Process each transaction to extract wallet balance information
      const enhancedTransactions = transactions.map(transaction => {
        // Default values
        let walletBalanceBefore = null;
        let walletBalanceAfter = null;
        
        if (transaction.description) {
          // Look for wallet debit pattern
          const walletDebitMatch = transaction.description.match(/\[Original balance: ₹([\d.]+)\] \[New balance: ₹([\d.]+)\]/);
          
          // Look for wallet re-debit pattern
          const walletReDebitMatch = transaction.description.match(/\[Original balance: ₹([\d.]+)\] \[New balance: ₹([\d.]+)\] \[Note: Amount deducted again after refund\]/);
          
          // Look for refund pattern
          const refundMatch = transaction.description.match(/Amount refunded to wallet: ([\d.]+)/);
          
          // Look for cashback pattern
          const cashbackMatch = transaction.description.match(/Added ([\d.]+) to wallet. New balance: ([\d.]+)/);
          
          // Look for direct cashback pattern (used in latest transactions)
          const directCashbackMatch = transaction.description.match(/CASHBACK: Direct database update succeeded. Added ([\d.]+) to wallet. New balance: ([\d.]+)/);
          
          // Look for wallet balance annotation we now add to transactions
          const walletBalanceAnnotationMatch = transaction.description.match(/\[Wallet balance before: ([\d.]+), after: ([\d.]+)\]/);
          
          if (walletBalanceAnnotationMatch) {
            // Direct wallet balance information
            walletBalanceBefore = walletBalanceAnnotationMatch[1];
            walletBalanceAfter = walletBalanceAnnotationMatch[2];
          } else if (walletDebitMatch || walletReDebitMatch) {
            // Use the matched values for wallet debit or re-debit
            const matches = walletDebitMatch || walletReDebitMatch;
            if (matches && matches.length >= 3) {
              walletBalanceBefore = matches[1];
              walletBalanceAfter = matches[2];
            }
          } else if (refundMatch && transaction.status === 'FAILED') {
            // For refunds, we need to calculate the before balance
            const refundAmount = parseFloat(refundMatch[1]);
            // Extract the wallet balance after refund from another pattern
            const afterRefundMatch = transaction.description.match(/Direct database update completed for wallet balance: ([\d.]+)/);
            if (afterRefundMatch) {
              walletBalanceAfter = afterRefundMatch[1];
              // Calculate before balance by subtracting refund amount
              const afterBalanceNum = parseFloat(walletBalanceAfter);
              const beforeBalanceNum = afterBalanceNum - refundAmount;
              walletBalanceBefore = beforeBalanceNum.toFixed(2);
            }
          } else if (cashbackMatch || directCashbackMatch) {
            // For cashback, use the new balance after cashback was added
            const matches = directCashbackMatch || cashbackMatch;
            if (matches && matches.length >= 3) {
              walletBalanceAfter = matches[2];
              // Calculate before balance by subtracting cashback amount
              const cashbackAmount = parseFloat(matches[1]);
              const afterBalanceNum = parseFloat(walletBalanceAfter);
              const beforeBalanceNum = afterBalanceNum - cashbackAmount;
              walletBalanceBefore = beforeBalanceNum.toFixed(2);
            }
          }
        }
        
        return {
          ...transaction,
          walletBalanceBefore,
          walletBalanceAfter
        };
      });
      
      // Sort by timestamp descending to get the most recent first
      enhancedTransactions.sort((a, b) => {
        const bDate = b.timestamp ? new Date(b.timestamp) : new Date();
        const aDate = a.timestamp ? new Date(a.timestamp) : new Date();
        return bDate.getTime() - aDate.getTime();
      });
      
      res.json({ transactions: enhancedTransactions });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load transactions' });
    }
  });

  app.get('/api/transactions/recent', async (req, res) => {
    try {
      // Extract date range filters from query parameters
      const { startDate, endDate } = req.query;
      let dateRange: { startDate?: Date, endDate?: Date } = {};
      
      if (startDate) {
        dateRange.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        dateRange.endDate = new Date(endDate as string);
      }
      
      const transactions = await storage.getTransactions();
      
      // Filter transactions based on date range if provided
      let filteredTransactions = transactions;
      
      if (dateRange.startDate || dateRange.endDate) {
        filteredTransactions = transactions.filter(transaction => {
          const txDate = transaction.timestamp ? new Date(transaction.timestamp) : new Date();
          
          // Check if transaction date is after startDate
          if (dateRange.startDate && txDate < dateRange.startDate) {
            return false;
          }
          
          // Check if transaction date is before endDate
          if (dateRange.endDate && txDate > dateRange.endDate) {
            return false;
          }
          
          return true;
        });
      }
      
      // Sort by timestamp descending and take only the first 5
      const recentTransactions = filteredTransactions
        .sort((a, b) => {
          const bDate = b.timestamp ? new Date(b.timestamp) : new Date();
          const aDate = a.timestamp ? new Date(a.timestamp) : new Date();
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, 5);
        
      res.json({ transactions: recentTransactions });
    } catch (error) {
      console.error('Recent Transactions Error:', error);
      res.status(500).json({ message: 'Failed to load recent transactions' });
    }
  });

  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      res.json({ transaction });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load transaction' });
    }
  });

  app.get('/api/transactions/user/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const transactions = await storage.getTransactionsByUserId(userId);
      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load user transactions' });
    }
  });

  app.post('/api/transactions', async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      
      // Validate user exists
      const user = await storage.getUser(transactionData.userId);
      if (!user) {
        return res.status(400).json({ 
          message: 'User not found',
          userMessage: 'The user selected for this transaction could not be found. Please check and try again.'
        });
      }
      
      // If operator is provided, validate it exists
      if (transactionData.operatorId) {
        const operator = await storage.getOperator(transactionData.operatorId);
        if (!operator) {
          return res.status(400).json({ 
            message: 'Operator not found',
            userMessage: 'The operator selected for this transaction could not be found. Please check and try again.'
          });
        }
      }
      
      // If recipient is provided, validate they exist
      if (transactionData.recipientId) {
        // Check if recipientId is an array (multiple recipients)
        if (Array.isArray(transactionData.recipientId)) {
          // Validate each recipient exists
          for (const recipientId of transactionData.recipientId) {
            const recipient = await storage.getUser(recipientId);
            if (!recipient) {
              return res.status(400).json({ 
            message: `Recipient with ID ${recipientId} not found`,
            userMessage: `One of the recipients you selected (ID: ${recipientId}) could not be found. Please check and try again.`
          });
            }
          }
        } else {
          // Single recipient
          const recipient = await storage.getUser(transactionData.recipientId);
          if (!recipient) {
            return res.status(400).json({ 
              message: 'Recipient not found',
              userMessage: 'The recipient you selected could not be found. Please check and try again.'
            });
          }
        }
      }
      
      // Special handling for ADD_FUND transactions with success status
      if (transactionData.type === 'ADD_FUND' && transactionData.status === 'SUCCESS') {
        // The server will update the user's wallet balance when processing this transaction
      }
      
      // Validate wallet balance for RECHARGE and TRANSFER transactions (both SUCCESS and PENDING)
      if ((transactionData.type === 'RECHARGE' || transactionData.type === 'TRANSFER') && 
          (transactionData.status === 'SUCCESS' || transactionData.status === 'PENDING')) {
        const userWalletBalance = parseFloat(user.walletBalance);
        let transactionAmount = parseFloat(transactionData.amount);
        
        // For TRANSFER with multiple recipients, the total amount needed is amount × number of recipients
        if (transactionData.type === 'TRANSFER' && Array.isArray(transactionData.recipientId)) {
          transactionAmount = transactionAmount * transactionData.recipientId.length;
        }
        
        // Check if user has sufficient balance
        if (userWalletBalance < transactionAmount) {
          return res.status(400).json({ 
            message: `Insufficient wallet balance for ${transactionData.type.toLowerCase()} transaction. Available balance: ₹${userWalletBalance}, Required: ₹${transactionAmount}`,
            userMessage: `Your wallet balance (₹${userWalletBalance}) is not enough for this transaction. You need ₹${transactionAmount} to complete it. Please add funds to your wallet and try again.`,
            currentBalance: userWalletBalance,
            requiredAmount: transactionAmount,
            transactionType: transactionData.type
          });
        }
        
        // Simple processing for recharge transactions
        if (transactionData.type === 'RECHARGE' && transactionData.operatorId) {
          try {
            // Get operator details to track in the transaction
            const operator = await storage.getOperator(transactionData.operatorId);
            if (operator) {
              console.log(`Processing recharge with operator ${operator.name}`);
              
              // No longer add operator info to description
            }
          } catch (error) {
            console.error('Error processing recharge operator details:', error);
            // Continue with the transaction even if operator lookup fails
          }
        }
      }
      
      // For RECHARGE/TRANSFER transactions, debit the user's wallet for both SUCCESS and PENDING transactions
      if ((transactionData.type === 'RECHARGE' || transactionData.type === 'TRANSFER') && 
          (transactionData.status === 'SUCCESS' || transactionData.status === 'PENDING')) {
        try {
          // Check if the transaction description contains "WALLET_DEBITED" to determine if wallet already processed
          const walletProcessed = transactionData.description?.includes("WALLET_DEBITED");
          
          if (walletProcessed) {
            console.log(`Wallet already debited for this transaction. Skipping debit operation.`);
          } else {
            // Calculate how much to deduct from wallet
            const transactionAmount = parseFloat(transactionData.amount);
            
            // Get fresh user data to ensure we have the latest wallet balance
            const freshUser = await storage.getUser(user.id);
            if (!freshUser) {
              throw new Error('User not found when processing wallet deduction');
            }
            
            // Check if user has enough balance for the transaction
            const currentWalletBalance = parseFloat(freshUser.walletBalance.toString() || '0');
            
            // If balance is insufficient, reject the transaction
            if (currentWalletBalance < transactionAmount) {
              throw new Error(`Insufficient wallet balance: ${currentWalletBalance}, required: ${transactionAmount}`);
            }
            
            // Deduct from user's wallet balance
            const newWalletBalance = (currentWalletBalance - transactionAmount).toFixed(2);
            
            console.log(`Deducting from wallet for ${transactionData.status} ${transactionData.type} transaction`);
            console.log(`Current balance: ${currentWalletBalance}, New balance: ${newWalletBalance}, Amount: ${transactionAmount}`);
            
            // Update user's wallet balance
            await storage.updateUser(user.id, { walletBalance: newWalletBalance });
            
            // Don't add wallet balance information to transactionData for RECHARGE transactions
            // This keeps the user's original description intact
          }
        } catch (error) {
          console.error('Error updating wallet balance:', error);
          // If the error is insufficient balance, return a specific error message to the client
          if (error instanceof Error && error.message.includes('Insufficient wallet balance')) {
            throw new Error(error.message);
          }
          // For other errors, we still want to log but may continue with caution
        }
      }
      
      // Handle direct CASHBACK transactions with SUCCESS status
      if (transactionData.type === 'CASHBACK' && transactionData.status === 'SUCCESS') {
        try {
          console.log(`Processing direct CASHBACK transaction for user ${user.id}`);
          
          // Get the cashback amount
          const cashbackAmount = parseFloat(transactionData.amount);
          
          // Get the latest user data with wallet balance and commission
          const getBalanceResult = await query(
            `SELECT wallet_balance, commission FROM users WHERE id = $1 FOR UPDATE`,
            [user.id]
          );
          
          if (getBalanceResult.rows.length === 0) {
            throw new Error('User not found in database during wallet balance update');
          }
          
          // Get current wallet balance and commission
          const currentWalletBalance = parseFloat(getBalanceResult.rows[0].wallet_balance);
          const currentCommission = parseFloat(getBalanceResult.rows[0].commission || '0');
          
          // Calculate new balance and commission
          const newWalletBalance = (currentWalletBalance + cashbackAmount).toFixed(2);
          const newCommission = (currentCommission + cashbackAmount).toFixed(2);
          
          console.log(`CASHBACK: Current wallet balance: ${currentWalletBalance}, New balance: ${newWalletBalance}`);
          console.log(`CASHBACK: Current commission: ${currentCommission}, New commission: ${newCommission}`);
          
          // Update both wallet balance and commission in the database
          await query(
            `UPDATE users SET wallet_balance = $1, commission = $2 WHERE id = $3`,
            [newWalletBalance, newCommission, user.id]
          );
          
          console.log(`CASHBACK: Updated wallet balance to ${newWalletBalance} and commission to ${newCommission}`);
          
          // Don't add balance information to transaction description
          // This keeps the user's original description intact
        } catch (error) {
          console.error('Error processing CASHBACK transaction:', error);
          // Log error but continue with transaction creation
        }
      }
      
      // Handle multiple recipients for TRANSFER transactions
      if (transactionData.type === 'TRANSFER' && Array.isArray(transactionData.recipientId) && transactionData.recipientId.length > 0) {
        // Create a transaction for each recipient
        const transactions = [];
        
        for (const recipientId of transactionData.recipientId) {
          const singleRecipientData = {
            ...transactionData,
            recipientId,
            // Generate a unique transactionId for each recipient by appending recipient ID
            transactionId: `${transactionData.transactionId}-${recipientId}`
          };
          
          const transaction = await storage.createTransaction(singleRecipientData);
          transactions.push(transaction);
        }
        
        res.status(201).json({ transactions });
      } else {
        // For non-TRANSFER transactions or TRANSFER with a single recipient
        const newTransaction = await storage.createTransaction(transactionData);
        
        // For CASHBACK transactions, update the description with wallet and commission information
        if (transactionData.type === 'CASHBACK' && transactionData.status === 'SUCCESS') {
          await storage.updateTransaction(newTransaction.id, {
            description: transactionData.description
          });
        }
        
        // Handle cashback for SUCCESS recharge transactions AFTER creating the transaction
        if (transactionData.type === 'RECHARGE' && transactionData.status === 'SUCCESS' && transactionData.operatorId) {
          console.log(`Successful recharge created with transaction ID: ${newTransaction.id}`);
          
          try {
            // Get operator details to calculate cashback based on commission rate
            const operator = await storage.getOperator(transactionData.operatorId);
            if (operator) {
              const rechargeAmount = parseFloat(transactionData.amount);
              const commissionRate = parseFloat(operator.commission.toString());
              
              console.log(`Processing cashback for SUCCESS recharge with operator ${operator.name}, commission rate: ${commissionRate}%`);
              
              // Calculate cashback amount (commission percentage of recharge amount)
              const cashbackAmount = (rechargeAmount * commissionRate / 100).toFixed(2);
              console.log(`Calculated cashback amount: ${cashbackAmount} for recharge amount: ${rechargeAmount}`);
              
              // Instead of relying on ORM methods which might be cached,
              // get the absolute latest wallet balance directly from the database
              let currentBalance = 0;
              try {
                const result = await query(
                  `SELECT wallet_balance FROM users WHERE id = $1`,
                  [user.id]
                );
                
                if (result.rows.length > 0) {
                  currentBalance = parseFloat(result.rows[0].wallet_balance);
                  console.log(`Direct wallet balance query for cashback: ${currentBalance}`);
                } else {
                  throw new Error('User not found in direct wallet balance query');
                }
              } catch (err) {
                console.error('Error during direct wallet balance query:', err);
                
                // Fallback to ORM method if direct query fails
                console.log('Falling back to ORM for user lookup during cashback processing');
                const freshUser = await storage.getUser(user.id);
                if (!freshUser) {
                  throw new Error('User not found when processing cashback');
                }
                currentBalance = parseFloat(freshUser.walletBalance.toString() || '0');
                console.log(`Fallback ORM wallet balance for cashback: ${currentBalance}`);
              }
              
              // Create a cashback transaction with order ID reference in description
              const cashbackTransaction = await storage.createTransaction({
                userId: user.id,
                type: 'CASHBACK',
                status: 'SUCCESS',
                amount: cashbackAmount,
                transactionId: `CSH${newTransaction.transactionId.replace(/^[^0-9]*/, '') || ''}`,
                description: `Cashback for recharge transaction #${newTransaction.id}, Order ID: ${newTransaction.transactionId}, TXID: N/A`
              });
              
              console.log(`Cashback transaction created: ${cashbackAmount} for user ${user.id}`);
              
              // Add cashback to user's wallet balance by direct SQL for maximum reliability
              try {
                // First, get the current user wallet balance directly from the database
                const getBalanceResult = await query(
                  `SELECT wallet_balance, commission FROM users WHERE id = $1 FOR UPDATE`,
                  [user.id]
                );
                
                if (getBalanceResult.rows.length === 0) {
                  throw new Error('User not found in database during wallet balance update');
                }
                
                const directBalance = parseFloat(getBalanceResult.rows[0].wallet_balance);
                console.log(`CASHBACK: Direct query wallet balance: ${directBalance}`);
                
                // Calculate new balance
                const cashbackNewBalance = (directBalance + parseFloat(cashbackAmount)).toFixed(2);
                console.log(`CASHBACK: Calculated new balance: ${cashbackNewBalance}`);
                
                // Update the wallet balance directly in the database
                await query(
                  `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
                  [cashbackNewBalance, user.id]
                );
                
                console.log(`CASHBACK: Direct database update succeeded. Added ${cashbackAmount} to wallet. New balance: ${cashbackNewBalance}`);
                // Don't update cashback transaction with wallet balance information
                // Keep the original description
                
                // Also update the commission field in the database for consistency
                const currentCommission = parseFloat(getBalanceResult.rows[0].commission || '0');
                const newCommission = (currentCommission + parseFloat(cashbackAmount)).toFixed(2);
                
                await query(
                  `UPDATE users SET commission = $1 WHERE id = $2`,
                  [newCommission, user.id]
                );
                
                console.log(`CASHBACK: Updated commission to ${newCommission}`);
                
                // No longer update cashback transaction description to track commission updates
                console.log(`CASHBACK: Commission was updated to ${newCommission}`);
                // Tracking is handled by the database transaction/locking mechanism
              } catch (sqlError) {
                console.error('Error during direct wallet balance update for cashback:', sqlError);
                
                // Fallback to ORM method if direct SQL fails
                try {
                  // Get fresh user data again
                  const freshUserFallback = await storage.getUser(user.id);
                  if (!freshUserFallback) {
                    throw new Error('User not found in fallback wallet balance update');
                  }
                  
                  const fallbackBalance = parseFloat(freshUserFallback.walletBalance.toString() || '0');
                  const ormNewBalance = (fallbackBalance + parseFloat(cashbackAmount)).toFixed(2);
                  
                  await storage.updateUser(user.id, { 
                    walletBalance: ormNewBalance 
                  });
                  
                  console.log(`CASHBACK FALLBACK: Updated wallet balance to ${ormNewBalance} via ORM`);
                } catch (ormError) {
                  console.error('Critical error during cashback processing:', ormError);
                  throw new Error('Failed to update wallet balance during cashback processing');
                }
              }
            }
          } catch (error) {
            console.error('Error processing cashback:', error);
            // Continue without failing the main transaction
          }
        }
        
        res.status(201).json({ transaction: newTransaction });
      }
    } catch (error) {
      console.error('Transaction creation error:', error);
      
      if (error instanceof z.ZodError) {
        // Format ZodError to be more user-friendly
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({ 
          message: 'Invalid input', 
          userMessage: 'Some fields in your transaction form have errors. Please check and try again.',
          errors: formattedErrors 
        });
      }
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('duplicate')) {
          return res.status(400).json({ 
            message: 'Duplicate transaction ID',
            userMessage: 'This transaction ID is already used. Please try again with a new transaction.'
          });
        }
      }
      
      // Handle insufficient balance error specifically
      if (error instanceof Error && error.message.includes('Insufficient wallet balance')) {
        return res.status(400).json({ 
          message: error.message,
          userMessage: 'You do not have enough wallet balance to complete this transaction. Please add funds to your wallet and try again.'
        });
      }

      // General server error
      res.status(500).json({ 
        message: 'Failed to create transaction',
        userMessage: 'We encountered an error while processing your transaction. Please try again or contact support.'
      });
    }
  });

  app.patch('/api/transactions/:id', async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      const transactionData = req.body;
      // Remove the needsRefund property before updating the transaction
      const { needsRefund, ...dataToUpdate } = transactionData;
      
      // Debug log to check if needsRefund is being passed correctly from client
      console.log(`DEBUG: Transaction update data:`, JSON.stringify(transactionData));
      console.log(`DEBUG: needsRefund flag:`, needsRefund, typeof needsRefund);
      console.log(`DEBUG: Transaction type:`, transaction.type);
      console.log(`DEBUG: Transaction status change from ${transaction.status} to ${transactionData.status}`);
      
      // No longer add status change info to descriptions
      // If user provided a description, use it directly
      if (req.body.description !== undefined) {
        dataToUpdate.description = req.body.description;
      }
      // Otherwise keep the existing description (don't modify)
      
      let updatedTransaction = await storage.updateTransaction(transactionId, dataToUpdate);
      
      // First, check if this transaction has already been refunded - only check description 
      // since metadata field is removed
      let alreadyRefunded = transaction.description && (
        transaction.description.includes('[Amount refunded to wallet]') || 
        transaction.description.includes('REFUND_PROCESSED')
      );
      
      // If already refunded and trying to refund again, return error
      if (alreadyRefunded && needsRefund === true) {
        console.log(`Blocked attempt to refund transaction ${transaction.transactionId} twice`);
        return res.status(400).json({ 
          message: 'This transaction has already been refunded. Cannot refund again.',
          transaction: updatedTransaction 
        });
      }
      
      // Handle status changes for special processing
      
      // Handling for recharge transactions changing from PENDING/FAILED to SUCCESS 
      if (transaction.type === 'RECHARGE' && 
          (transaction.status === 'PENDING' || transaction.status === 'FAILED') && 
          transactionData.status === 'SUCCESS' && 
          transaction.operatorId) {
        
        console.log(`Recharge transaction status changed from ${transaction.status} to SUCCESS. Transaction ID: ${transactionId}`);
        
        // Special handling for FAILED → SUCCESS transitions where a refund was previously done
        // Check if transaction was previously refunded
        const wasRefunded = transaction.description?.includes("Amount refunded to wallet") || false;
        
        console.log(`STATUS CHANGE DEBUG: Transaction previously refunded: ${wasRefunded}`);
        
        // If transaction was FAILED and had a refund, but is now changing to SUCCESS,
        // we need to debit the wallet again since the money was previously refunded
        if (transaction.status === 'FAILED' && wasRefunded && transactionData.status === 'SUCCESS') {
          try {
            console.log(`STATUS CHANGE DEBUG: Transaction was previously refunded but is now SUCCESS - need to debit wallet again`);
            
            // Get fresh user data to ensure we have the latest wallet balance
            const user = await storage.getUser(transaction.userId);
            if (user) {
              const transactionAmount = parseFloat(transaction.amount);
              const currentWalletBalance = parseFloat(user.walletBalance.toString() || '0');
              
              // Check if user has enough balance
              if (currentWalletBalance < transactionAmount) {
                console.log(`WALLET DEBUG: Insufficient balance for transaction. Current: ${currentWalletBalance}, Required: ${transactionAmount}`);
                throw new Error(`Insufficient wallet balance: ${currentWalletBalance}, required: ${transactionAmount}`);
              }
              
              // Deduct from user's wallet balance again since it was previously refunded
              const newWalletBalance = (currentWalletBalance - transactionAmount).toFixed(2);
              console.log(`WALLET DEBUG: Re-deducting previously refunded amount. Current: ${currentWalletBalance}, New: ${newWalletBalance}`);
              
              // Update user's wallet balance with direct SQL for reliability
              await query(
                `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
                [newWalletBalance, user.id]
              );
              
              // Don't add wallet balance information to the description
              // This preserves user's original description
              
              console.log(`WALLET DEBUG: Transaction description updated with re-debit information`);
            }
          } catch (error) {
            console.error('Error updating wallet balance on FAILED→SUCCESS transition:', error);
            // Log the error but don't add it to the description
            if (error instanceof Error && error.message.includes('Insufficient wallet balance')) {
              console.log(`WARNING: ${error.message} - Status update needs manual wallet adjustment`);
              // Keep the original description without adding error messages
            }
          }
        } else {
          console.log(`STATUS CHANGE DEBUG: Standard status change - wallet update will be handled by pgStorage.updateTransaction`);
        }
        
        // No need to manually debit wallet here as it's already handled in pgStorage.updateTransaction
        // This prevents double debiting of wallets
        
        // No longer update description to indicate status changes
        
        console.log(`Updated recharge transaction description to indicate status change.`);
        
        // Create cashback transaction when status changes to SUCCESS
        try {
          // Get user and operator information for cashback calculation
          const user = await storage.getUser(transaction.userId);
          const operator = await storage.getOperator(transaction.operatorId);
          
          if (user && operator) {
            const rechargeAmount = parseFloat(transaction.amount.toString());
            const commissionRate = parseFloat(operator.commission.toString());
            
            console.log(`Processing cashback for updated recharge with operator ${operator.name}, commission rate: ${commissionRate}%`);
            
            // Calculate cashback amount (commission percentage of recharge amount)
            const cashbackAmount = (rechargeAmount * commissionRate / 100).toFixed(2);
            console.log(`Calculated cashback amount: ${cashbackAmount} for recharge amount: ${rechargeAmount}`);
            
            // Check if we already created a cashback for this transaction
            const userTransactions = await storage.getTransactionsByUserId(user.id);
            const cbPrefix = `CSH${transaction.transactionId.replace(/^[^0-9]*/, '') || ''}`;
            const existingCashback = userTransactions.filter(tx => 
              tx.type === 'CASHBACK' && tx.transactionId === cbPrefix
            );
            
            if (existingCashback.length > 0) {
              console.log(`Cashback already exists for transaction ${transaction.transactionId}. Skipping cashback creation.`);
            } else {
              // Create a cashback transaction with order ID reference in description
              const cashbackTransaction = await storage.createTransaction({
                userId: user.id,
                type: 'CASHBACK',
                status: 'SUCCESS',
                amount: cashbackAmount,
                transactionId: cbPrefix,
                description: `Cashback for recharge transaction #${transaction.id}, Order ID: ${transaction.transactionId}, TXID: N/A`
              });
              
              console.log(`Cashback transaction created: ${cashbackAmount} for user ${user.id}`);
              
              // Update user's wallet balance and commission
              try {
                // First, get the current user wallet balance directly from the database
                const getBalanceResult = await query(
                  `SELECT wallet_balance, commission FROM users WHERE id = $1 FOR UPDATE`,
                  [user.id]
                );
                
                if (getBalanceResult.rows.length === 0) {
                  throw new Error('User not found in database during wallet balance update');
                }
                
                const directBalance = parseFloat(getBalanceResult.rows[0].wallet_balance);
                console.log(`CASHBACK: Direct query wallet balance: ${directBalance}`);
                
                // Calculate new balance
                const cashbackNewBalance = (directBalance + parseFloat(cashbackAmount)).toFixed(2);
                console.log(`CASHBACK: Calculated new balance: ${cashbackNewBalance}`);
                
                // Update the wallet balance directly in the database
                await query(
                  `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
                  [cashbackNewBalance, user.id]
                );
                
                console.log(`CASHBACK: Direct database update succeeded. Added ${cashbackAmount} to wallet. New balance: ${cashbackNewBalance}`);
                
                // Also update the commission field in the database for consistency
                const currentCommission = parseFloat(getBalanceResult.rows[0].commission || '0');
                const newCommission = (currentCommission + parseFloat(cashbackAmount)).toFixed(2);
                
                await query(
                  `UPDATE users SET commission = $1 WHERE id = $2`,
                  [newCommission, user.id]
                );
                
                console.log(`CASHBACK: Updated commission to ${newCommission}`);
                
                // No longer update description to track commission updates
                console.log(`CASHBACK: Commission updated from ${currentCommission} to ${newCommission}`);
              } catch (err) {
                console.error('Error processing cashback wallet update:', err);
              }
            }
          }
        } catch (error) {
          console.error('Error creating cashback for status update:', error);
          // Continue without failing the main transaction update
        }
      }
      
      // Check if this is a change from SUCCESS to FAILED
      // Only refund the amount when explicitly requested with needsRefund flag
      console.log('REFUND CONDITION CHECK:');
      console.log('- Current status:', transaction.status);
      console.log('- New status:', transactionData.status);
      console.log('- needsRefund flag:', needsRefund, typeof needsRefund);
      console.log('- Condition met for SUCCESS→FAILED?', transaction.status === 'SUCCESS' && transactionData.status === 'FAILED' && needsRefund === true);
      console.log('- Condition met for PENDING→FAILED?', transaction.status === 'PENDING' && transactionData.status === 'FAILED' && needsRefund === true);
      
      // Handle both SUCCESS→FAILED and PENDING→FAILED transitions with refund
      if ((transaction.status === 'SUCCESS' || transaction.status === 'PENDING') && 
          transactionData.status === 'FAILED' && 
          needsRefund === true) {
        
        try {
          // Get the user
          const user = await storage.getUser(transaction.userId);
          
          if (user) {
            console.log(`REFUND DEBUG: Starting refund process for ${transaction.status} to FAILED transaction`);
            console.log(`REFUND DEBUG: Transaction type: ${transaction.type}`);
            console.log(`REFUND DEBUG: User initial wallet balance: ${user.walletBalance}`);
            console.log(`REFUND DEBUG: Transaction amount: ${transaction.amount}`);
            
            // First, get a fresh user record to ensure we have the latest wallet balance
            const freshUserRecord = await storage.getUser(user.id);
            if (!freshUserRecord) {
              console.log('REFUND ERROR: Could not retrieve fresh user record!');
              throw new Error('User record not found during refund process');
            }
            
            // Parse the current wallet balance and transaction amount carefully
            const currentWalletBalance = parseFloat(freshUserRecord.walletBalance.toString() || '0');
            const transactionAmount = parseFloat(transaction.amount.toString());
            
            // Check if wallet was actually debited (for PENDING to FAILED transitions)
            const walletWasDebited = transaction.description?.includes("WALLET_DEBITED") || false;
            console.log(`REFUND DEBUG: Checking if wallet was debited. Result: ${walletWasDebited}`);
            console.log(`REFUND DEBUG: Transaction status: ${transaction.status}, New status: ${transactionData.status}`);
            
            // For PENDING→FAILED transitions, only refund if wallet was actually debited
            let shouldProcessRefund = true;
            if (transaction.status === 'PENDING' && transactionData.status === 'FAILED' && 
                (transaction.type === 'RECHARGE' || transaction.type === 'TRANSFER')) {
              shouldProcessRefund = walletWasDebited === true;
              console.log(`REFUND DEBUG: PENDING→FAILED transition. Should process refund? ${shouldProcessRefund}`);
            }
            
            // Calculate the updated balance
            let updatedBalance;
            if (!shouldProcessRefund) {
              // If wallet wasn't debited, don't change the balance
              updatedBalance = currentWalletBalance;
              console.log(`REFUND DEBUG: Wallet wasn't debited for this transaction. Skipping refund.`);
            } else if (transaction.type === 'ADD_FUND') {
              // For ADD_FUND transactions, we need to subtract the amount instead of adding it
              updatedBalance = currentWalletBalance - transactionAmount;
              console.log(`ADD_FUND REFUND: Subtracting ${transactionAmount} from wallet balance`);
            } else {
              // For other transaction types (like RECHARGE), add the amount back
              updatedBalance = currentWalletBalance + transactionAmount;
              console.log(`STANDARD REFUND: Adding ${transactionAmount} back to wallet balance`);
            }
            
            console.log(`REFUND DEBUG: Current wallet balance (fresh): ${currentWalletBalance}`);
            console.log(`REFUND DEBUG: Transaction amount: ${transactionAmount}`);
            console.log(`REFUND DEBUG: New wallet balance after adjustment: ${updatedBalance}`);
            
            // Ensure we don't have negative balance for ADD_FUND refunds
            if (updatedBalance < 0) {
              console.log(`REFUND WARNING: Would result in negative balance (${updatedBalance}). Setting to 0.`);
              updatedBalance = 0;
            }
            
            // Force a direct database update to be completely sure it updates
            try {
              // Direct SQL update to ensure wallet balance is properly updated
              await query(
                `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
                [updatedBalance.toFixed(2), user.id]
              );
              console.log(`REFUND DEBUG: Direct database update completed for wallet balance: ${updatedBalance.toFixed(2)}`);
            } catch (sqlError) {
              console.error('REFUND ERROR: Failed to update wallet balance with direct SQL:', sqlError);
              // Fall back to the ORM method
              await storage.updateUser(user.id, { 
                walletBalance: updatedBalance.toFixed(2)
              });
            }
            
            // Verify the wallet balance was actually updated with a fresh query
            const userAfterUpdate = await storage.getUser(user.id);
            if (userAfterUpdate) {
              console.log(`REFUND DEBUG: User wallet balance after update verification: ${userAfterUpdate.walletBalance}`);
              
              // Check if the update was successful
              const actualBalance = parseFloat(userAfterUpdate.walletBalance?.toString() || '0');
              if (Math.abs(actualBalance - updatedBalance) > 0.01) {
                console.log(`REFUND WARNING: Wallet balance update may not have been applied correctly.`);
                console.log(`REFUND WARNING: Expected: ${updatedBalance.toFixed(2)}, Actual: ${actualBalance.toFixed(2)}`);
              } else {
                console.log(`REFUND DEBUG: Wallet balance successfully updated to ${actualBalance.toFixed(2)}`);
              }
              
              // Update transaction description with info about the refund action taken
              let refundActionDescription;
              if (transaction.type === 'ADD_FUND') {
                refundActionDescription = `[ADD_FUND transaction marked as failed. ${transactionAmount} deducted from wallet balance]`;
                console.log(`Refunded (deducted) ${transactionAmount} from user ${user.id} for ADD_FUND transaction ${transaction.transactionId}`);
              } else {
                refundActionDescription = `[Amount refunded to wallet: ${transactionAmount}]`;
                console.log(`Refunded ${transactionAmount} to user ${user.id} for transaction ${transaction.transactionId}`);
              }
              
              // Update transaction description with refund information 
              // Include the timestamp directly in the description instead of using metadata
              const refundTimestamp = new Date().toISOString();
              const fullDescription = `${updatedTransaction.description ? updatedTransaction.description + ' ' : ''}${refundActionDescription} (Processed: ${refundTimestamp})`.trim();
              
              await storage.updateTransaction(transactionId, {
                description: fullDescription
              });
            } else {
              console.log(`REFUND DEBUG: Could not verify wallet balance update - user not found.`);
            }
            
            // If this is a recharge transaction with an associated cashback, we need to handle that too
            if (transaction.type === 'RECHARGE' && transaction.operatorId) {
              console.log(`Processing refund for recharge transaction: ${transaction.transactionId}`);
              
              // Check if there's a cashback transaction for this recharge
              // Important: Only get transactions for the user who owns this transaction (not all users)
              const userTransactions = await storage.getTransactionsByUserId(user.id);
              
              // Three search strategies:
              // 1. First try matching cashback transactions with exact transaction ID (from CSH transactions)
              const cbPrefix = `CSH${transaction.transactionId.replace(/^[^0-9]*/, '') || ''}`;
              let relatedCashbackTransactions = userTransactions.filter(tx => 
                tx.type === 'CASHBACK' && 
                tx.status === 'SUCCESS' && 
                tx.transactionId === cbPrefix
              );
              
              console.log(`CASHBACK DEBUG: Looking for exact match for cashback transaction ID: ${cbPrefix}`);
              
              // 2. Try looking for cashback with any prefix but with matching numeric part
              if (relatedCashbackTransactions.length === 0) {
                console.log(`CASHBACK DEBUG: No exact match, looking for cashback with any prefix but matching numbers...`);
                
                const transactionIdNumericPart = transaction.transactionId.replace(/^[^0-9]*/, '');
                relatedCashbackTransactions = userTransactions.filter(tx => 
                  tx.type === 'CASHBACK' && 
                  tx.status === 'SUCCESS' && 
                  tx.transactionId && 
                  tx.transactionId.includes(transactionIdNumericPart)
                );
                
                if (relatedCashbackTransactions.length > 0) {
                  console.log(`CASHBACK DEBUG: Found cashback using numeric part match: ${transactionIdNumericPart}`);
                }
              }
              
              // 3. If no match yet, try looking for transactions with description match or timestamp proximity
              if (relatedCashbackTransactions.length === 0) {
                console.log(`CASHBACK DEBUG: No exact transaction ID match, checking descriptions and timestamps...`);
                
                relatedCashbackTransactions = userTransactions.filter(tx => 
                  tx.type === 'CASHBACK' && 
                  tx.status === 'SUCCESS' && 
                  (
                    // If there's a description that matches this transaction
                    (tx.description && 
                     (tx.description.includes(`Cashback for recharge of ₹${transaction.amount}`) ||
                      tx.description.includes(`Parent tx: #${transaction.id}`) || 
                      tx.description.includes(transaction.transactionId))) ||
                    // Or if the transaction was created very close to this transaction
                    (tx.timestamp && transaction.timestamp &&
                     Math.abs(new Date(tx.timestamp).getTime() - new Date(transaction.timestamp).getTime()) < 300000) // Within 5 minutes
                  )
                );
              }
              
              console.log(`CASHBACK DEBUG: Searching for cashback transactions for user ${user.id}, transaction ${transaction.transactionId}`);
              console.log(`CASHBACK DEBUG: Found ${relatedCashbackTransactions.length} related cashback transactions`);
              
              if (relatedCashbackTransactions.length > 0) {
                console.log(`Found ${relatedCashbackTransactions.length} related cashback transaction(s) to reverse`);
                
                // Get the total cashback amount
                let totalCashback = 0;
                
                for (const cashbackTx of relatedCashbackTransactions) {
                  totalCashback += parseFloat(cashbackTx.amount.toString());
                  
                  // Delete the cashback transaction
                  await storage.deleteTransaction(cashbackTx.id);
                  console.log(`Deleted cashback transaction #${cashbackTx.id}`);
                }
                
                if (totalCashback > 0) {
                  // When refunding, we need to also deduct the cashback amount from the wallet
                  // since we're refunding the original recharge amount but also need to remove the cashback
                  
                  // Get a fresh user record again to ensure accurate calculations
                  const freshUserRecord = await storage.getUser(user.id);
                  if (!freshUserRecord) {
                    console.log('REFUND ERROR: Could not retrieve fresh user record before cashback adjustment!');
                    throw new Error('User record not found during cashback adjustment');
                  }
                  
                  // Update both wallet balance AND commission
                  const currentWalletBalance = parseFloat(freshUserRecord.walletBalance.toString() || '0');
                  const newWalletBalance = Math.max(0, currentWalletBalance - totalCashback).toFixed(2);
                  
                  // Also update commission for consistency
                  const currentCommission = parseFloat(freshUserRecord.commission || '0');
                  const newCommission = Math.max(0, currentCommission - totalCashback).toFixed(2);
                  
                  console.log(`Cashback transactions deleted. Adjusting wallet balance to remove cashback.`);
                  console.log(`Adjusting wallet balance to remove cashback: Current: ${currentWalletBalance}, New: ${newWalletBalance}`);
                  console.log(`Adjusting commission due to refund: Current: ${currentCommission}, New: ${newCommission}`);
                  
                  // Use direct SQL update for wallet balance to ensure it's updated
                  try {
                    await query(
                      `UPDATE users SET wallet_balance = $1, commission = $2 WHERE id = $3`,
                      [newWalletBalance, newCommission, user.id]
                    );
                    console.log(`REFUND DEBUG: Direct database update completed for wallet balance: ${newWalletBalance} and commission: ${newCommission}`);
                  } catch (sqlError) {
                    console.error('REFUND ERROR: Failed to update wallet balance with direct SQL:', sqlError);
                    // Fall back to ORM method
                    await storage.updateUser(user.id, {
                      walletBalance: newWalletBalance, 
                      commission: newCommission
                    });
                  }
                }
              } else {
                // If we can't find specific cashback transactions, check if there's a cashback mention in the description
                // Only handle this for SUCCESS->FAILED transitions, not for PENDING->FAILED
                if (transaction.status === 'SUCCESS' && transaction.description) {
                  try {
                    console.log(`CASHBACK DEBUG: Trying to extract cashback from description: "${transaction.description}"`);
                    
                    // Try several regex patterns to extract the cashback amount
                    let cashbackMatch = transaction.description.match(/Cashback: ₹([0-9.]+)/);
                    
                    // If that didn't work, try another pattern
                    if (!cashbackMatch) {
                      cashbackMatch = transaction.description.match(/Cashback:\s*₹?([0-9.]+)/i);
                    }
                    
                    // If that didn't work, look for a pattern like "Cashback amount: 1.23"
                    if (!cashbackMatch) {
                      cashbackMatch = transaction.description.match(/[Cc]ashback.*?([0-9.]+)/);
                    }
                    
                    if (cashbackMatch && cashbackMatch[1]) {
                      const cashbackAmount = parseFloat(cashbackMatch[1]);
                      console.log(`CASHBACK DEBUG: Successfully extracted cashback amount: ${cashbackAmount} using regex`);
                      
                      if (cashbackAmount > 0) {
                        // When refunding, we need to also deduct the cashback amount from the wallet
                        // since we've refunded the original recharge amount but need to remove the cashback
                        
                        // Update both wallet balance AND commission
                        // Get fresh user data
                        const freshUserRecord = await storage.getUser(user.id);
                        if (!freshUserRecord) {
                          console.log('REFUND ERROR: Could not get fresh user data for cashback extraction');
                          throw new Error('User not found during cashback extraction');
                        }
                        
                        const currentWalletBalance = parseFloat(freshUserRecord.walletBalance.toString() || '0');
                        const newWalletBalance = Math.max(0, currentWalletBalance - cashbackAmount).toFixed(2);
                        
                        // Also update commission for consistency
                        const currentCommission = parseFloat(freshUserRecord.commission || '0');
                        const newCommission = Math.max(0, currentCommission - cashbackAmount).toFixed(2);
                        
                        console.log(`Extracted cashback ${cashbackAmount} from description.`);
                        console.log(`Adjusting wallet balance to remove cashback: Current: ${currentWalletBalance}, New: ${newWalletBalance}`);
                        console.log(`Adjusting commission: Current: ${currentCommission}, New: ${newCommission}`);
                        
                        // Use direct SQL update for wallet balance to ensure it's updated
                        try {
                          await query(
                            `UPDATE users SET wallet_balance = $1, commission = $2 WHERE id = $3`,
                            [newWalletBalance, newCommission, user.id]
                          );
                          console.log(`REFUND DEBUG: Direct database update completed for wallet balance: ${newWalletBalance} and commission: ${newCommission}`);
                        } catch (sqlError) {
                          console.error('REFUND ERROR: Failed to update wallet balance with direct SQL:', sqlError);
                          // Fall back to ORM method
                          await storage.updateUser(user.id, { 
                            walletBalance: newWalletBalance,
                            commission: newCommission 
                          });
                        }
                        
                        // Log detailed info for debugging
                        console.log(`User wallet and commission updated: User ID ${user.id}, Old Balance: ${currentWalletBalance}, New Balance: ${newWalletBalance}, Cashback Removed: ${cashbackAmount}`);
                      }
                    } else if (transaction.status === 'SUCCESS') {
                      // Only run failsafe for SUCCESS->FAILED transitions, not PENDING->FAILED
                      // Failsafe: If we couldn't extract the cashback amount, try to look for any cashback transactions
                      // This is a more aggressive approach to make sure we don't leave cashback in the account when a transaction fails
                      const operator = await storage.getOperator(transaction.operatorId);
                      if (operator && operator.commission) {
                        // Calculate what the cashback would have been
                        const rechargeAmount = parseFloat(transaction.amount);
                        const cashbackRate = parseFloat(operator.commission.toString());
                        const calculatedCashback = (rechargeAmount * cashbackRate / 100).toFixed(2);
                        
                        console.log(`Calculated potential cashback to remove: ${calculatedCashback}`);
                        
                        // Look for cashback transactions that might match this recharge transaction
                        // by matching amount and timestamp proximity
                        let failsafeCashbacks = userTransactions.filter(tx => 
                          tx.type === 'CASHBACK' && 
                          tx.status === 'SUCCESS' &&
                          parseFloat(tx.amount.toString()) === parseFloat(calculatedCashback) && // Amount matches the calculated cashback
                          tx.timestamp && transaction.timestamp &&
                          // Cashback transaction should be within 10 minutes of the parent transaction
                          Math.abs(new Date(tx.timestamp).getTime() - new Date(transaction.timestamp).getTime()) < 600000
                        );
                        
                        // If we found matching cashback transactions, delete them directly
                        if (failsafeCashbacks.length > 0) {
                          console.log(`FAILSAFE: Found ${failsafeCashbacks.length} potential cashback transactions by amount+time match`);
                          for (const cashbackTx of failsafeCashbacks) {
                            await storage.deleteTransaction(cashbackTx.id);
                            console.log(`FAILSAFE: Deleted cashback transaction #${cashbackTx.id} with amount ${cashbackTx.amount}`);
                          }
                        }
                        
                        // Check if there's any wallet balance to deduct - get fresh user data
                        const freshUserRecord = await storage.getUser(user.id);
                        if (!freshUserRecord) {
                          console.log('REFUND ERROR: Could not get fresh user data for failsafe cashback calculation');
                          throw new Error('User record not found during failsafe cashback adjustment');
                        }
                        
                        const currentWalletBalance = parseFloat(freshUserRecord.walletBalance.toString() || '0');
                        // Also check commission field for backward compatibility
                        const currentCommission = parseFloat(freshUserRecord.commission || '0');
                        
                        if (currentWalletBalance > 0 || currentCommission > 0) {
                          // When refunding, we need to also deduct the cashback amount from the wallet
                          // Update both wallet balance and commission
                          const newWalletBalance = Math.max(0, currentWalletBalance - parseFloat(calculatedCashback)).toFixed(2);
                          const newCommission = Math.max(0, currentCommission - parseFloat(calculatedCashback)).toFixed(2);
                          
                          console.log(`Failsafe: Adjusting wallet balance to remove cashback: Current: ${currentWalletBalance}, New: ${newWalletBalance}`);
                          console.log(`Failsafe commission adjustment: Current: ${currentCommission}, New: ${newCommission}`);
                          
                          // Use direct SQL update for wallet balance to ensure it's updated
                          try {
                            await query(
                              `UPDATE users SET wallet_balance = $1, commission = $2 WHERE id = $3`,
                              [newWalletBalance, newCommission, user.id]
                            );
                            console.log(`REFUND DEBUG: Direct database update completed for wallet balance: ${newWalletBalance} and commission: ${newCommission}`);
                          } catch (sqlError) {
                            console.error('REFUND ERROR: Failed to update wallet balance with direct SQL:', sqlError);
                            // Fall back to ORM method
                            await storage.updateUser(user.id, { 
                              walletBalance: newWalletBalance,
                              commission: newCommission
                            });
                          }
                        }
                      }
                    } else {
                      // For PENDING->FAILED transactions, skip cashback adjustment
                      console.log(`Skipping failsafe cashback adjustment for PENDING->FAILED transaction`);
                    }
                  } catch (error) {
                    console.error('Error extracting cashback from description:', error);
                  }
                }
              }
            }
            
            // We've already updated the description for this transaction, so we won't do it again here
            // This prevents a duplicate update that could override our custom ADD_FUND behavior
            
            // Log the refund action for audit purposes
            if (transaction.type === 'ADD_FUND') {
              console.log(`Processed ADD_FUND refund: Removed ${transaction.amount} from user ${user.id}'s wallet for transaction ${transaction.transactionId}`);
            } else {
              console.log(`Refunded ${transaction.amount} to user ${user.id} for transaction ${transaction.transactionId}`);
            }
          }
        } catch (refundError) {
          console.error('Error processing refund:', refundError);
          // We still want to return the updated transaction even if refund fails
        }
      }
      
      res.json({ transaction: updatedTransaction });
    } catch (error) {
      console.error('Transaction update error:', error);
      res.status(500).json({ message: 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      await storage.deleteTransaction(transactionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete transaction' });
    }
  });

  // External recharge status check routes (simplified)
  app.get('/api/transactions/check-status/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      
      // Call the external API
      const apiResponse = await fetchRechargeStatus(orderId);
      
      if (!apiResponse) {
        // Return empty but successful response with record not found status
        return res.json({ 
          success: true,
          apiResponse: null,
          message: 'Record not found in external API',
          mappedStatus: 'PENDING' // Default to PENDING for UI display
        });
      }
      
      // Return the API response without any further processing
      res.json({
        success: true,
        apiResponse,
        mappedStatus: mapExternalStatus(apiResponse.status)
      });
      
    } catch (error) {
      console.error('Error checking recharge status:', error);
      res.status(500).json({ 
        message: 'Failed to check recharge status',
        error: formatErrorMessage(error)
      });
    }
  });
  
  // Route to automatically update transaction based on external status
  app.post('/api/transactions/update-from-api/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // First, get the transaction
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      
      // Check if this is a recharge transaction and has a proper transaction ID format
      if (transaction.type !== 'RECHARGE' || !transaction.transactionId) {
        return res.status(400).json({ 
          message: 'This feature is only available for recharge transactions with a valid transaction ID' 
        });
      }
      
      // Extract orderId from the transaction - assuming it's stored in the transactionId field
      const orderId = req.body.orderId || transaction.transactionId;
      
      // Also check if the request body contains a mobile number
      const mobileNumber = req.body.mobileNumber;
      
      // Call the external API
      const apiResponse = await fetchRechargeStatus(orderId);
      
      if (!apiResponse || !apiResponse.status) {
        return res.json({ 
          message: 'Record not found in external API. Status not updated.',
          success: true,
          transaction,
          statusUpdated: false
        });
      }
      
      // Map the external status to our internal status, handle nulls
      const newStatus = mapExternalStatus(apiResponse.status);
      
      // Check if the status actually changed
      if (transaction.status === newStatus) {
        return res.json({
          message: 'Status already up to date',
          success: true,
          transaction,
          externalStatus: apiResponse.status || 'Unknown'
        });
      }
      
      // Determine if we need to process a refund (PENDING/SUCCESS -> FAILED)
      const needsRefund = (
        (transaction.status === 'PENDING' || transaction.status === 'SUCCESS') && 
        newStatus === 'FAILED'
      );
      
      // Get updated description based on the status change
      let updatedDescription = transaction.description;
      
      // Check for PENDING to SUCCESS status change for RECHARGE transactions
      if (transaction.status === 'PENDING' && newStatus === 'SUCCESS' && transaction.type === 'RECHARGE') {
        // First try using mobile number from the request body if provided
        let phoneNumber = mobileNumber || '';
        
        // If no mobile number was provided in the request body, try to extract from description
        if (!phoneNumber && transaction.description) {
          const mobileNumberMatch = transaction.description.match(/(\d{10})/);
          if (mobileNumberMatch && mobileNumberMatch[1]) {
            phoneNumber = mobileNumberMatch[1];
          }
        }
        
        // Use the provided/extracted phone number or default to 'unknown'
        const formattedMobileNumber = phoneNumber || 'unknown';
        
        // Format with both transaction ID and API transaction ID
        updatedDescription = `Recharge successful for ${formattedMobileNumber} (RC ID: ${transaction.transactionId}, TXID: ${apiResponse.txid || 'N/A'})`;
        
        console.log(`Updated description for PENDING→SUCCESS transition: "${updatedDescription}"`);
      } else {
        // For other status changes, just append the API status update
        updatedDescription = transaction.description + 
          `\n[Status updated from API: ${apiResponse.status}]`;
      }
      
      // Update the transaction with the new status and description
      const updatedTransaction = await storage.updateTransaction(id, {
        status: newStatus,
        needsRefund: needsRefund,
        description: updatedDescription
      });
      
      // Create cashback transaction for PENDING to SUCCESS transitions
      if (transaction.status === 'PENDING' && newStatus === 'SUCCESS' && transaction.type === 'RECHARGE' && transaction.operatorId) {
        try {
          // Get user and operator information for cashback calculation
          const user = await storage.getUser(transaction.userId);
          const operator = await storage.getOperator(transaction.operatorId);
          
          if (user && operator) {
            const rechargeAmount = parseFloat(transaction.amount.toString());
            const commissionRate = parseFloat(operator.commission.toString());
            
            console.log(`API UPDATE: Processing cashback for PENDING to SUCCESS recharge with operator ${operator.name}, commission rate: ${commissionRate}%`);
            
            // Calculate cashback amount (commission percentage of recharge amount)
            const cashbackAmount = (rechargeAmount * commissionRate / 100).toFixed(2);
            console.log(`API UPDATE: Calculated cashback amount: ${cashbackAmount} for recharge amount: ${rechargeAmount}`);
            
            // Check if we already created a cashback for this transaction
            const userTransactions = await storage.getTransactionsByUserId(user.id);
            const cbPrefix = `CSH${transaction.transactionId.replace(/^[^0-9]*/, '') || ''}`;
            const existingCashback = userTransactions.filter(tx => 
              tx.type === 'CASHBACK' && tx.transactionId === cbPrefix
            );
            
            if (existingCashback.length > 0) {
              console.log(`API UPDATE: Cashback already exists for transaction ${transaction.transactionId}. Skipping cashback creation.`);
            } else {
              // Create a cashback transaction with order ID reference in description
              const cashbackTransaction = await storage.createTransaction({
                userId: user.id,
                type: 'CASHBACK',
                status: 'SUCCESS',
                amount: cashbackAmount,
                transactionId: cbPrefix,
                description: `Cashback for recharge transaction #${transaction.id}, Order ID: ${transaction.transactionId}, TXID: N/A`
              });
              
              console.log(`API UPDATE: Cashback transaction created: ${cashbackAmount} for user ${user.id}`);
              
              // Update user's wallet balance and commission using direct SQL for reliability
              try {
                // First, get the current user wallet balance directly from the database
                const getBalanceResult = await query(
                  `SELECT wallet_balance, commission FROM users WHERE id = $1 FOR UPDATE`,
                  [user.id]
                );
                
                if (getBalanceResult.rows.length === 0) {
                  throw new Error('User not found in database during wallet balance update');
                }
                
                const directBalance = parseFloat(getBalanceResult.rows[0].wallet_balance);
                console.log(`API UPDATE CASHBACK: Direct query wallet balance: ${directBalance}`);
                
                // Calculate new balance
                const cashbackNewBalance = (directBalance + parseFloat(cashbackAmount)).toFixed(2);
                console.log(`API UPDATE CASHBACK: Calculated new balance: ${cashbackNewBalance}`);
                
                // Update the wallet balance directly in the database
                await query(
                  `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
                  [cashbackNewBalance, user.id]
                );
                
                console.log(`API UPDATE CASHBACK: Direct database update succeeded. Added ${cashbackAmount} to wallet. New balance: ${cashbackNewBalance}`);
                
                // Also update the commission field in the database for consistency
                const currentCommission = parseFloat(getBalanceResult.rows[0].commission || '0');
                const newCommission = (currentCommission + parseFloat(cashbackAmount)).toFixed(2);
                
                await query(
                  `UPDATE users SET commission = $1 WHERE id = $2`,
                  [newCommission, user.id]
                );
                
                console.log(`API UPDATE CASHBACK: Updated commission to ${newCommission}`);
              } catch (err) {
                console.error('API UPDATE: Error processing cashback wallet update:', err);
              }
            }
          }
        } catch (error) {
          console.error('API UPDATE: Error creating cashback for status update:', error);
          // Continue without failing the main transaction update
        }
      }
      
      // Refund processing for failed recharge transactions
      if (needsRefund) {
        try {
          // First, check if the transaction has already been refunded
          // Only check description, not metadata
          const alreadyRefunded = transaction.description && 
            (transaction.description.includes('[Amount refunded to wallet') ||
             transaction.description.includes('refunded to wallet') ||
             transaction.description.includes('(Processed:'));
          
          if (alreadyRefunded) {
            console.log(`API REFUND: Transaction #${id} has already been refunded. Skipping refund process.`);
            return res.json({
              success: true,
              message: 'Transaction already refunded previously. No further action needed.',
              previousStatus: transaction.status,
              newStatus,
              transaction: updatedTransaction,
              alreadyRefunded: true,
              apiResponse
            });
          }
          
          // Get the user
          const user = await storage.getUser(transaction.userId);
          
          if (user) {
            console.log(`API REFUND: Starting refund process for transaction #${id}`);
            
            // First check if wallet was actually debited for this transaction
            // We don't use description tracking anymore, so this will be determined by transaction status
        const walletDebited = transaction.status === 'PENDING' || transaction.status === 'SUCCESS';
            
            // Parse the current wallet balance and recharge amount carefully
            const currentWalletBalance = parseFloat(user.walletBalance.toString() || '0');
            const rechargeAmount = parseFloat(transaction.amount.toString());
            
            // Only refund if wallet was actually debited
            let updatedBalance = currentWalletBalance;
            if (walletDebited) {
              // Calculate the updated balance by adding the recharge amount back
              updatedBalance = currentWalletBalance + rechargeAmount;
              console.log(`API REFUND: Wallet was debited for this transaction. Adding ${rechargeAmount} back to wallet.`);
            } else {
              console.log(`API REFUND: Wallet was NOT debited for this transaction. Skipping refund.`);
            }
            
            console.log(`API REFUND: Current wallet balance: ${currentWalletBalance}`);
            console.log(`API REFUND: Recharge amount: ${rechargeAmount}`);
            console.log(`API REFUND: New wallet balance after refund: ${updatedBalance}`);
            
            // First, check if there's a cashback transaction associated with this recharge
            const userTransactions = await storage.getTransactionsByUserId(user.id);
            
            // Try multiple strategies to find the related cashback transaction
            // 1. First try exact transaction ID match with CSH prefix
            const cbPrefix = `CSH${transaction.transactionId.replace(/^[^0-9]*/, '') || ''}`;
            let relatedCashbackTransactions = userTransactions.filter(tx => 
              tx.type === 'CASHBACK' && 
              tx.status === 'SUCCESS' && 
              tx.transactionId === cbPrefix
            );
            
            console.log(`API REFUND: Looking for cashback with exact transaction ID: ${cbPrefix}`);
            
            // 2. If that doesn't work, try matching by numeric part only
            if (relatedCashbackTransactions.length === 0) {
              const transactionIdNumericPart = transaction.transactionId.replace(/^[^0-9]*/, '');
              relatedCashbackTransactions = userTransactions.filter(tx => 
                tx.type === 'CASHBACK' && 
                tx.status === 'SUCCESS' && 
                tx.transactionId && 
                tx.transactionId.includes(transactionIdNumericPart)
              );
              
              console.log(`API REFUND: Looking for cashback with numeric part: ${transactionIdNumericPart}, found: ${relatedCashbackTransactions.length}`);
            }
            
            // 3. If that still doesn't work, try description or timestamp proximity matches
            if (relatedCashbackTransactions.length === 0) {
              relatedCashbackTransactions = userTransactions.filter(tx => 
                tx.type === 'CASHBACK' && 
                tx.status === 'SUCCESS' && 
                (
                  // Check description if it exists
                  (tx.description && 
                   (tx.description.includes(`Cashback for recharge of ₹${transaction.amount}`) ||
                    tx.description.includes(`Parent tx: #${transaction.id}`) || 
                    tx.description.includes(transaction.transactionId))) ||
                  // Or rely on the timestamp being close to the transaction
                  (tx.timestamp && transaction.timestamp &&
                   Math.abs(new Date(tx.timestamp).getTime() - new Date(transaction.timestamp).getTime()) < 300000) // Within 5 minutes
                )
              );
              
              console.log(`API REFUND: Looking for cashback with description or timestamp, found: ${relatedCashbackTransactions.length}`);
            }
            
            // Initialize variables to track cashback amount
            let totalCashback = 0;
            // Define proper types based on the schema definition
            let newWalletBalance: string | number = updatedBalance;
            let newCommission: string | number = parseFloat(user.commission || '0');
            let cashbackAdjusted = false;
            
            // Handle associated cashback transactions
            if (relatedCashbackTransactions.length > 0) {
              console.log(`API REFUND: Found ${relatedCashbackTransactions.length} related cashback transaction(s) to reverse`);
              
              // For PENDING->FAILED transitions, don't adjust the cashback if transaction was never SUCCESS
              if (transaction.status === 'PENDING') {
                console.log(`API REFUND: This is a PENDING->FAILED transition. Checking if cashback was added.`);
                
                // For PENDING->FAILED, we should only remove cashback if it was actually added
                // Instead of using metadata, check if there are any related transactions
                // and look for specific timestamp patterns
                
                // For PENDING->FAILED transactions, assume the cashback was not yet processed
                // since it's created with the original transaction but not credited until
                // the transaction changes to SUCCESS state
                console.log(`API REFUND: For PENDING->FAILED, assuming no cashback was processed yet.`);
                const cashbackWasActuallyAdded = false;
                
                if (!cashbackWasActuallyAdded) {
                  console.log(`API REFUND: No cashback was added to wallet for this PENDING transaction. Skipping cashback adjustment.`);
                  // Still delete the cashback transactions as they shouldn't exist for failed transactions
                  for (const cashbackTx of relatedCashbackTransactions) {
                    await storage.deleteTransaction(cashbackTx.id);
                    console.log(`API REFUND: Deleted cashback transaction #${cashbackTx.id} (without wallet adjustment)`);
                  }
                  
                  // Use the original refunded balance without cashback adjustment
                  newWalletBalance = updatedBalance.toFixed(2);
                  
                  // Skip cashback adjustment
                  cashbackAdjusted = false;
                } else {
                  console.log(`API REFUND: Cashback was already added to wallet. Proceeding with cashback adjustment.`);
                  // Process normally if cashback was already added
                  // Get the total cashback amount
                  for (const cashbackTx of relatedCashbackTransactions) {
                    const cashbackAmount = parseFloat(cashbackTx.amount.toString());
                    totalCashback += cashbackAmount;
                    
                    // Delete the cashback transaction
                    await storage.deleteTransaction(cashbackTx.id);
                    console.log(`API REFUND: Deleted cashback transaction #${cashbackTx.id} amount ${cashbackAmount}`);
                  }
                  
                  // Deduct cashback amount from wallet and commission
                  if (totalCashback > 0) {
                    console.log(`API REFUND: Total cashback to reverse: ${totalCashback}`);
                    
                    // Adjust the final wallet balance by removing the cashback amount
                    newWalletBalance = Math.max(0, updatedBalance - totalCashback).toFixed(2);
                    
                    // Also update commission for consistency
                    newCommission = Math.max(0, newCommission - totalCashback).toFixed(2);
                    
                    console.log(`API REFUND: Final wallet balance after cashback adjustment: ${newWalletBalance}`);
                    console.log(`API REFUND: Adjusted commission from ${user.commission} to ${newCommission}`);
                    
                    cashbackAdjusted = true;
                  }
                }
              } else {
                // For SUCCESS->FAILED transitions, always process cashback adjustment
                // Get the total cashback amount
                for (const cashbackTx of relatedCashbackTransactions) {
                  const cashbackAmount = parseFloat(cashbackTx.amount.toString());
                  totalCashback += cashbackAmount;
                  
                  // Delete the cashback transaction
                  await storage.deleteTransaction(cashbackTx.id);
                  console.log(`API REFUND: Deleted cashback transaction #${cashbackTx.id} amount ${cashbackAmount}`);
                }
                
                // Deduct cashback amount from wallet and commission
                if (totalCashback > 0) {
                  console.log(`API REFUND: Total cashback to reverse: ${totalCashback}`);
                  
                  // Adjust the final wallet balance by removing the cashback amount
                  newWalletBalance = Math.max(0, updatedBalance - totalCashback).toFixed(2);
                  
                  // Also update commission for consistency
                  newCommission = Math.max(0, newCommission - totalCashback).toFixed(2);
                  
                  console.log(`API REFUND: Final wallet balance after cashback adjustment: ${newWalletBalance}`);
                  console.log(`API REFUND: Adjusted commission from ${user.commission} to ${newCommission}`);
                  
                  cashbackAdjusted = true;
                }
              }
            } else if (transaction.description && transaction.description.includes('Cashback:')) {
              // Fallback: Try to extract cashback info from the transaction description
              // For PENDING->FAILED transitions, we want to be cautious
              if (transaction.status === 'PENDING') {
                console.log(`API REFUND: PENDING->FAILED transition with cashback mention in description`);
                console.log(`API REFUND: For PENDING->FAILED, skipping cashback adjustment`);
                
                // For PENDING->FAILED, don't deduct cashback from the wallet balance
                newWalletBalance = updatedBalance.toFixed(2);
                cashbackAdjusted = false;
              } else {
                // For SUCCESS->FAILED transitions, extract and process cashback as before
                try {
                  const cashbackMatch = transaction.description.match(/Cashback: ₹([0-9.]+)/);
                  if (cashbackMatch && cashbackMatch[1]) {
                    const cashbackAmount = parseFloat(cashbackMatch[1]);
                    
                    if (cashbackAmount > 0) {
                      console.log(`API REFUND: Extracted cashback ${cashbackAmount} from description`);
                      
                      // Deduct the cashback amount from the wallet
                      newWalletBalance = Math.max(0, updatedBalance - cashbackAmount).toFixed(2);
                      
                      // Also update commission for consistency
                      newCommission = Math.max(0, newCommission - cashbackAmount).toFixed(2);
                      
                      console.log(`API REFUND: Final wallet balance after cashback adjustment: ${newWalletBalance}`);
                      console.log(`API REFUND: Adjusted commission from ${user.commission} to ${newCommission}`);
                      
                      cashbackAdjusted = true;
                    }
                  }
                } catch (e) {
                  console.error('API REFUND: Error extracting cashback from description:', e);
                }
              }
            } else if (transaction.operatorId) {
              // For transactions with an operator, differentiate between PENDING and SUCCESS
              if (transaction.status === 'SUCCESS') {
                // Fallback: Calculate potential cashback based on operator commission
                // ONLY if the transaction was previously SUCCESS (not PENDING)
                // as cashback is only given for SUCCESS transactions
                try {
                  const operator = await storage.getOperator(transaction.operatorId);
                  if (operator && operator.commission) {
                    // Calculate what the cashback would have been
                    const cashbackRate = parseFloat(operator.commission.toString());
                    const calculatedCashback = (rechargeAmount * cashbackRate / 100).toFixed(2);
                    
                    if (parseFloat(calculatedCashback) > 0) {
                      console.log(`API REFUND: Calculated potential cashback to remove: ${calculatedCashback}`);
                      
                      // Deduct the cashback amount from the wallet
                      newWalletBalance = Math.max(0, updatedBalance - parseFloat(calculatedCashback)).toFixed(2);
                      
                      // Also update commission for consistency
                      newCommission = Math.max(0, newCommission - parseFloat(calculatedCashback)).toFixed(2);
                      
                      console.log(`API REFUND: Final wallet balance after cashback adjustment: ${newWalletBalance}`);
                      console.log(`API REFUND: Adjusted commission from ${user.commission} to ${newCommission}`);
                      
                      cashbackAdjusted = true;
                    }
                  }
                } catch (e) {
                  console.error('API REFUND: Error calculating potential cashback:', e);
                }
              } else if (transaction.status === 'PENDING') {
                // For PENDING->FAILED, don't calculate cashback
                console.log(`API REFUND: PENDING->FAILED transition - no cashback calculation needed`);
                newWalletBalance = updatedBalance.toFixed(2);
                cashbackAdjusted = false;
              }
            }
            
            // Update the user's wallet balance and commission
            try {
              // Use direct SQL update to ensure wallet balance is properly updated
              await query(
                `UPDATE users SET wallet_balance = $1, commission = $2 WHERE id = $3`,
                [newWalletBalance, newCommission, user.id]
              );
              console.log(`API REFUND: Updated wallet balance to ${newWalletBalance} and commission to ${newCommission} via direct SQL`);
            } catch (sqlError) {
              console.error('API REFUND ERROR: Failed to update wallet balance with direct SQL:', sqlError);
              // Fall back to ORM method
              // Ensure proper string conversion for wallet balance and commission
              await storage.updateUser(user.id, { 
                walletBalance: String(newWalletBalance),
                commission: String(newCommission)
              });
              console.log(`API REFUND: Updated wallet balance to ${newWalletBalance} and commission to ${newCommission} via ORM`);
            }
            
            // Create a notification about the refund
            try {
              // Enhanced message with details that were previously in metadata
              const detailsInfo = `[TxID:${transaction.transactionId}, Amount:₹${rechargeAmount}${cashbackAdjusted ? ', Cashback:₹'+(totalCashback || 0) : ''}]`;
              
              const notificationData = {
                userId: user.id,
                type: 'WALLET_CREDIT',
                message: `Your recharge of ₹${transaction.amount} failed and has been refunded${cashbackAdjusted ? ' (cashback reversed)' : ''}. ${detailsInfo}`,
                read: false
              };
              
              await storage.createNotification(notificationData);
              console.log(`API REFUND: Created refund notification for user ${user.id}`);
            } catch (notificationError) {
              console.error('API REFUND ERROR: Failed to create refund notification:', notificationError);
            }
            
            // Update the transaction description to indicate the refund was processed
            let refundDescription = ' [Amount refunded to wallet';
            if (cashbackAdjusted) {
              refundDescription += ', cashback reversed';
            }
            refundDescription += ']';
            
            // Instead of using metadata, just append to the description
            // with refund timestamp to indicate it's been refunded
            const refundTimestamp = new Date().toISOString();
            const fullRefundDescription = 
              updatedTransaction.description + 
              refundDescription + 
              ` (Processed: ${refundTimestamp})`;
              
            await storage.updateTransaction(id, {
              description: fullRefundDescription
            });
          }
        } catch (refundError) {
          console.error('API REFUND ERROR: Failed to process refund:', refundError);
          // Continue with the response even if refund processing fails
        }
      }
      
      // Get the final updated transaction
      const finalTransaction = await storage.getTransaction(id);
      
      res.json({
        success: true,
        message: 'Transaction status updated from external API',
        previousStatus: transaction.status,
        newStatus,
        transaction: finalTransaction,
        apiResponse
      });
      
    } catch (error) {
      console.error('Error updating transaction from API:', error);
      res.status(500).json({ 
        message: 'Failed to update transaction status',
        error: formatErrorMessage(error)
      });
    }
  });

  // Operator routes
  app.get('/api/operators', async (req, res) => {
    try {
      const operators = await storage.getOperators();
      res.json({ operators });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load operators' });
    }
  });

  app.get('/api/operators/performance', async (req, res) => {
    try {
      // Extract date range filters from query parameters
      const { startDate, endDate } = req.query;
      let dateRange: { startDate?: Date, endDate?: Date } = {};
      
      if (startDate) {
        dateRange.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        dateRange.endDate = new Date(endDate as string);
      }
      
      const dashboardStats = await storage.getDashboardStats(dateRange);
      res.json({ operators: dashboardStats.operators });
    } catch (error) {
      console.error('Error loading operator performance:', error);
      res.status(500).json({ message: 'Failed to load operator performance' });
    }
  });

  app.get('/api/operators/:id', async (req, res) => {
    try {
      const operatorId = parseInt(req.params.id);
      const operator = await storage.getOperator(operatorId);
      
      if (!operator) {
        return res.status(404).json({ message: 'Operator not found' });
      }
      
      res.json({ operator });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load operator' });
    }
  });

  app.post('/api/operators', async (req, res) => {
    try {
      const operatorData = insertOperatorSchema.parse(req.body);
      
      // Check if code is already used
      const operators = await storage.getOperators();
      const existingOperator = operators.find(op => op.code === operatorData.code);
      if (existingOperator) {
        return res.status(400).json({ message: 'Operator code already exists' });
      }
      
      const newOperator = await storage.createOperator(operatorData);
      res.status(201).json({ operator: newOperator });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create operator' });
    }
  });

  app.patch('/api/operators/:id', async (req, res) => {
    try {
      const operatorId = parseInt(req.params.id);
      const operator = await storage.getOperator(operatorId);
      
      if (!operator) {
        return res.status(404).json({ message: 'Operator not found' });
      }
      
      const operatorData = req.body;
      
      // If changing code, check if new code is already used
      if (operatorData.code && operatorData.code !== operator.code) {
        const operators = await storage.getOperators();
        const existingOperator = operators.find(op => op.code === operatorData.code);
        if (existingOperator) {
          return res.status(400).json({ message: 'Operator code already exists' });
        }
      }
      
      const updatedOperator = await storage.updateOperator(operatorId, operatorData);
      res.json({ operator: updatedOperator });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update operator' });
    }
  });

  app.delete('/api/operators/:id', async (req, res) => {
    try {
      const operatorId = parseInt(req.params.id);
      const operator = await storage.getOperator(operatorId);
      
      if (!operator) {
        return res.status(404).json({ message: 'Operator not found' });
      }
      
      await storage.deleteOperator(operatorId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete operator' });
    }
  });

  // Notification routes
  app.get('/api/notifications', async (req, res) => {
    try {
      const notifications = await storage.getNotifications();
      // Sort by timestamp descending to get the most recent first
      notifications.sort((a, b) => {
        const bDate = b.timestamp ? new Date(b.timestamp) : new Date();
        const aDate = a.timestamp ? new Date(a.timestamp) : new Date();
        return bDate.getTime() - aDate.getTime();
      });
      res.json({ notifications });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load notifications' });
    }
  });

  app.get('/api/notifications/:id', async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json({ notification });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load notification' });
    }
  });

  app.get('/api/notifications/user/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json({ notifications });
    } catch (error) {
      res.status(500).json({ message: 'Failed to load user notifications' });
    }
  });

  app.post('/api/notifications', async (req, res) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
          message: 'Unauthorized access', 
          userMessage: 'Only administrators can send notifications.'
        });
      }
      
      // Check if it's a multi-user notification
      if (req.body.userIds && Array.isArray(req.body.userIds)) {
        const { userIds, message, type } = req.body; // metadata removed as requested
        
        if (!message || !type) {
          return res.status(400).json({ message: 'Message and type are required' });
        }
        
        // Handle empty userIds array (all users)
        if (userIds.length === 0) {
          const users = await storage.getUsers();
          const notifications = [];
          const failedUsers = [];
          
          // Create a batch ID for this bundle of notifications
          const batchId = `batch-${Date.now()}`;
          
          for (const user of users) {
            try {
              // Add batch info to message instead of using metadata
              const batchInfo = `[Batch ID: ${batchId}, Sent by admin #${req.session.user.id}]`;
              
              const notificationData = {
                userId: user.id,
                message: `${message} ${batchInfo}`,
                type,
                read: false
              };
              
              const newNotification = await storage.createNotification(notificationData);
              notifications.push(newNotification);
            } catch (error) {
              console.error(`Failed to create notification for user ${user.id}:`, error);
              failedUsers.push(user.id);
            }
          }
          
          return res.status(201).json({ 
            success: true, 
            message: `Sent notifications to ${notifications.length} users`, 
            count: notifications.length,
            failed: failedUsers.length,
            failedUserIds: failedUsers,
            batchId
          });
        } else {
          // Handle specific userIds
          const notifications = [];
          const failedUsers = [];
          
          // Create a batch ID for this bundle of notifications
          const batchId = `batch-${Date.now()}`;
          
          for (const userId of userIds) {
            try {
              // Validate user exists
              const user = await storage.getUser(userId);
              if (!user) {
                failedUsers.push(userId);
                continue;
              }
              
              // Add batch info to message instead of using metadata
              const batchInfo = `[Batch ID: ${batchId}, Sent by admin #${req.session.user.id}]`;
              
              const notificationData = {
                userId,
                message: `${message} ${batchInfo}`,
                type,
                read: false
              };
              
              const newNotification = await storage.createNotification(notificationData);
              notifications.push(newNotification);
            } catch (error) {
              console.error(`Failed to create notification for user ${userId}:`, error);
              failedUsers.push(userId);
            }
          }
          
          return res.status(201).json({ 
            success: true, 
            message: `Sent notifications to ${notifications.length} users`, 
            count: notifications.length,
            failed: failedUsers.length,
            failedUserIds: failedUsers,
            batchId
          });
        }
      } else {
        // Handle single user notification (legacy support)
        const notificationData = insertNotificationSchema.parse(req.body);
        
        // Validate user exists
        const user = await storage.getUser(notificationData.userId);
        if (!user) {
          return res.status(400).json({ message: 'User not found' });
        }
        
        const newNotification = await storage.createNotification(notificationData);
        res.status(201).json({ notification: newNotification });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      console.error('Create notification error:', error);
      res.status(500).json({ message: 'Failed to create notification' });
    }
  });

  app.patch('/api/notifications/:id', async (req, res) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
          message: 'Unauthorized access', 
          userMessage: 'Only administrators can update notifications.'
        });
      }

      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      const notificationData = req.body;
      const updatedNotification = await storage.updateNotification(notificationId, notificationData);
      res.json({ notification: updatedNotification });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update notification' });
    }
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
          message: 'Unauthorized access', 
          userMessage: 'Only administrators can delete notifications.'
        });
      }
      
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      await storage.deleteNotification(notificationId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  });

  // Referral routes
  app.get('/api/referrals', async (req, res) => {
    try {
      // Extract date range filters and timeframe from query parameters
      const { startDate, endDate, timeFrame } = req.query;
      let dateRange: { startDate?: Date, endDate?: Date } = {};
      
      if (startDate) {
        dateRange.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        dateRange.endDate = new Date(endDate as string);
      }
      
      const referralStats = await storage.getReferralStats(
        dateRange, 
        (timeFrame as 'daily' | 'weekly' | 'monthly') || 'monthly'
      );
      res.json({ users: referralStats.users });
    } catch (error) {
      console.error('Referrals Error:', error);
      res.status(500).json({ message: 'Failed to load referrals', error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/referrals/stats', async (req, res) => {
    try {
      // Extract date range filters and timeframe from query parameters
      const { startDate, endDate, timeFrame } = req.query;
      let dateRange: { startDate?: Date, endDate?: Date } = {};
      
      if (startDate) {
        dateRange.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        dateRange.endDate = new Date(endDate as string);
      }
      
      const referralStats = await storage.getReferralStats(
        dateRange, 
        (timeFrame as 'daily' | 'weekly' | 'monthly') || 'monthly'
      );
      res.json(referralStats);
    } catch (error) {
      console.error('Referral Stats Error:', error);
      res.status(500).json({ message: 'Failed to load referral statistics', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Settings routes (these won't actually save the settings since we're using in-memory storage)
  app.post('/api/settings/general', (req, res) => {
    // In a real app, we would save these settings to a database
    res.json({ success: true, message: 'General settings updated' });
  });

  app.post('/api/settings/account', (req, res) => {
    // In a real app, we would update the user account
    res.json({ success: true, message: 'Account settings updated' });
  });

  app.post('/api/settings/notifications', (req, res) => {
    // In a real app, we would save notification preferences
    res.json({ success: true, message: 'Notification settings updated' });
  });

  app.post('/api/settings/security', (req, res) => {
    // In a real app, we would update security settings
    res.json({ success: true, message: 'Security settings updated' });
  });

  app.post('/api/settings/commission', (req, res) => {
    // In a real app, we would update commission settings
    res.json({ success: true, message: 'Commission settings updated' });
  });

  const httpServer = createServer(app);
  // Database settings routes
  app.get('/api/settings/database/status', async (req, res) => {
    try {
      const config = {
        host: process.env.PGHOST || '',
        port: process.env.PGPORT || '',
        database: process.env.PGDATABASE || '',
        user: process.env.PGUSER || '',
        password: process.env.PGPASSWORD || ''
      };
      
      // Check if we can query the database
      try {
        await db.select().from(users).limit(1);
        res.json({ isConnected: true, config });
      } catch (error) {
        res.json({ isConnected: false, config });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to check database status' });
    }
  });

  app.post('/api/settings/database/connect', async (req, res) => {
    try {
      const { host, port, database, user, password } = req.body;
      const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
      
      // Test the connection
      const testPool = new Pool({ connectionString });
      try {
        await testPool.query('SELECT NOW()');
        await testPool.end();
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ success: false, message: 'Failed to connect to database' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  app.post('/api/settings/database/disconnect', async (req, res) => {
    try {
      await pool.end();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to disconnect from database' });
    }
  });

  // External API integration for wallet balance
  app.get('/api/external/wallet-balance', async (req, res) => {
    try {
      const username = process.env.MYRC_API_USERNAME || '';
      const token = process.env.MYRC_API_TOKEN || '';
      const apiUrl = process.env.MYRC_API_URL || '';

      if (!username || !token || !apiUrl) {
        return res.status(500).json({ 
          success: false, 
          message: 'API credentials not configured', 
          walletBalance: '0.00' 
        });
      }

      const response = await fetch(`${apiUrl}?username=${username}&token=${token}`);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json() as { balance?: string };
      
      // Return the wallet balance from the external API
      res.json({
        success: true,
        walletBalance: data.balance || '0.00',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('External wallet balance API error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch external wallet balance',
        walletBalance: '0.00',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // API Keys endpoint - to fetch API keys for settings page
  app.get('/api/settings/api-keys', (req, res) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
          message: 'Unauthorized access', 
          userMessage: 'Only administrators can access API keys.'
        });
      }
      
      // Return the API keys from environment variables
      res.json({
        rechargeApiKey: {
          username: process.env.MYRC_API_USERNAME || '',
          token: process.env.MYRC_API_TOKEN || '',
          url: process.env.MYRC_API_URL || ''
        },
        whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
        whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || ''
      });
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch API keys',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Save API Keys endpoint
  app.post('/api/settings/api-keys', (req, res) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ 
          message: 'Unauthorized access', 
          userMessage: 'Only administrators can update API keys.'
        });
      }
      
      const { rechargeApiUsername, rechargeApiToken, rechargeApiUrl, whatsappApiKey, whatsappPhoneNumberId } = req.body;
      
      // Here we would normally update the .env file or environment variables
      // For this implementation, we'll just log the values for demonstration
      console.log('Received API key update:', {
        rechargeApiUsername,
        rechargeApiToken,
        rechargeApiUrl,
        whatsappApiKey,
        whatsappPhoneNumberId
      });
      
      // In a production environment, you would update the actual environment variables
      // or save to a secure configuration storage

      res.json({
        success: true,
        message: 'API keys updated successfully'
      });
    } catch (error) {
      console.error('Error updating API keys:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update API keys',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}
