import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  // Handle NaN and invalid input
  if (amount === null || amount === undefined || amount === '') {
    return '₹0.00';
  }
  
  // Parse string to number if needed
  let numAmount: number;
  try {
    numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check if parsing resulted in a valid number
    if (isNaN(numAmount)) {
      return '₹0.00';
    }
  } catch (error) {
    return '₹0.00';
  }
  
  // For large values, use abbreviated formats
  if (numAmount >= 10000000) { // 1 crore or more
    return `₹${(numAmount / 10000000).toFixed(2)} Cr`;
  } else if (numAmount >= 100000) { // 1 lakh or more
    return `₹${(numAmount / 100000).toFixed(2)} L`;
  } else if (numAmount >= 1000) { // 1 thousand or more
    return `₹${(numAmount / 1000).toFixed(2)}K`;
  }
  
  // For smaller amounts, use standard formatting
  return `₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyFull(amount: number | string): string {
  // Handle NaN and invalid input
  if (amount === null || amount === undefined || amount === '') {
    return '₹0.00';
  }
  
  // Parse string to number if needed
  let numAmount: number;
  try {
    numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check if parsing resulted in a valid number
    if (isNaN(numAmount)) {
      return '₹0.00';
    }
  } catch (error) {
    return '₹0.00';
  }
  
  // Always return full amount with Indian formatting
  return `₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getInitials(name: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case "SUCCESS":
      return "status-badge-success";
    case "PENDING":
      return "status-badge-pending";
    case "FAILED":
      return "status-badge-failed";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getTransactionTypeColor(type: string): string {
  switch (type.toUpperCase()) {
    case "RECHARGE":
      return "bg-blue-100 text-blue-800";
    case "ADD_FUND":
      return "bg-orange-100 text-orange-800";
    case "TRANSFER":
      return "bg-green-100 text-green-800";
    case "REFERRAL":
      return "bg-purple-100 text-purple-800";
    case "CASHBACK":
      return "bg-purple-100 text-purple-800";
    case "DEBIT":
      return "bg-red-100 text-red-800";
    case "MONEY_SENT":
      return "bg-amber-100 text-amber-800";
    case "MONEY_RECEIVED":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function generateRandomId(type?: string): string {
  if (type === 'RECHARGE') {
    // For recharge transactions: RC followed by 10 digits
    const randomDigits = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `RC${randomDigits}`;
  } else if (type === 'CASHBACK') {
    // For cashback transactions: CSH followed by 8 alphanumeric characters
    const alphanumeric = '0123456789ABCDEF';
    let result = 'CSH';
    for (let i = 0; i < 8; i++) {
      result += alphanumeric.charAt(Math.floor(Math.random() * alphanumeric.length));
    }
    return result;
  } else {
    // For other transaction types: use the original format with India timezone
    const now = new Date();
    const indiaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const timestamp = indiaTime.getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `TRX${timestamp}${random}`;
  }
}

export function getCurrentIndiaTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    // Check if the date is valid
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    return d.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

export function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-primary",
    "bg-purple-100 text-purple-600",
    "bg-green-100 text-green-600",
    "bg-red-100 text-red-600",
    "bg-yellow-100 text-yellow-600",
  ];
  
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
