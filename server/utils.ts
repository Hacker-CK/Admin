// Utility functions for the server
import fetch from 'node-fetch';

/**
 * Fetches the status of a recharge transaction from the external API
 * @param orderId The order ID of the transaction
 * @returns The status of the transaction from the API or null if the API call fails
 */
export async function fetchRechargeStatus(orderId: string): Promise<{
  txid: string;
  status: string;
  opid: string;
  number: string;
  amount: string;
  orderid: string;
} | null> {
  try {
    // Use environment variables for API credentials - no fallback values for security
    const apiUsername = process.env.MYRC_API_USERNAME;
    const apiToken = process.env.MYRC_API_TOKEN;
    const apiBaseUrl = process.env.MYRC_API_URL;
    
    // Validate environment variables are set
    if (!apiUsername || !apiToken || !apiBaseUrl) {
      console.error('Missing required API environment variables: MYRC_API_USERNAME, MYRC_API_TOKEN, or MYRC_API_URL');
      return null;
    }
    const apiUrl = `${apiBaseUrl.replace('/balance', '')}/status?username=${apiUsername}&token=${apiToken}&orderid=${orderId}`;
    
    console.log(`Fetching recharge status for order ID: ${orderId}`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`API response received for order ID ${orderId}`);
    
    // Simple type checking for expected response format
    if (data && typeof data === 'object' && 'status' in data) {
      return data as {
        txid: string;
        status: string;
        opid: string;
        number: string;
        amount: string;
        orderid: string;
      };
    }
    
    console.error('Invalid API response format');
    return null;
  } catch (error) {
    console.error('Error fetching recharge status:', error);
    return null;
  }
}

/**
 * Maps external API status to internal transaction status
 * @param externalStatus The status from the external API
 * @returns The corresponding internal status
 */
export function mapExternalStatus(externalStatus: string | null | undefined): 'SUCCESS' | 'FAILED' | 'PENDING' {
  // Default to PENDING if externalStatus is null or undefined
  if (!externalStatus) {
    return 'PENDING';
  }
  
  const status = externalStatus.toLowerCase();
  
  if (status === 'success') {
    return 'SUCCESS';
  } else if (status === 'failure' || status === 'failed') {
    return 'FAILED';
  } else {
    return 'PENDING';
  }
}

/**
 * Generates a random transaction ID with a specified prefix
 * @param prefix The prefix to use for the transaction ID
 * @returns A random transaction ID
 */
export function generateRandomTrxId(prefix: string = 'TRX'): string {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}

/**
 * Sanitizes a string to make it safe for SQL queries
 * @param str The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(str: string): string {
  if (!str) return '';
  return str.replace(/[^\w\s.-]/g, '').trim();
}

/**
 * Formats an error message
 * @param error The error object
 * @returns A formatted error message
 */
export function formatErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}