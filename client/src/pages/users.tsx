import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type User, insertUserSchema, type Transaction } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import toast from "react-hot-toast";
import { formatCurrency, formatCurrencyFull, formatDate, getInitials } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";

// UI Components
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Icons
import {
  UserPlus,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  ExternalLink,
  Mail,
  UserCog,
  Copy,
  CreditCard,
  Clock,
  BarChart3,
  Wallet,
  ArrowUpDown,
  Search,
  Info,
  Phone,
  MapPin,
  Calendar,
  Activity,
  Check,
  RefreshCw,
  AlertTriangle,
  XCircle,
  Settings,
  FileText,
  Globe,
  PieChart,
  Award,
  ChevronRight,
  Smartphone,
  Shield,
  UserCircle,
  Landmark,
  BadgeInfo,
  DollarSign,
  Clock8,
  AlertCircle,
  Receipt,
  Plus,
  Minus,
  X,
  File,
  UserX,
  CheckCircle,
  Calculator,
  TrendingUp,
  Network,
} from "lucide-react";

// Extend User type to include transaction statistics for filtered views
interface UserWithStats {
  id: number;
  username: string;
  name?: string;
  email?: string;
  walletBalance: number | string;
  isAdmin: boolean;
  isActive: boolean;
  isFirstLogin?: boolean;
  referralCode?: string;
  referredBy?: string;
  referralCount: number;
  gender?: string;
  state?: string;
  city?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Additional stats fields
  transactionCount?: number;
  transactionVolume?: number | string;
  totalSpent?: number;
  growth?: number;
  phone?: string;
  // Additional financial fields
  commission?: number;
  referralEarnings?: number | string;
  // Payment statistics
  totalPayments?: number;
  cashbackAmount?: number;
  // User device information
  ipAddress?: string;
  deviceInfo?: string;
}

// Extend schema to make some fields required for validation
const userFormSchema = insertUserSchema.extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().nullable(),
  mpin: z.string().length(4, "MPIN must be exactly 4 digits").optional().nullable(),
});

// Professional Currency Component with Modern Hover Tooltip
const CurrencyTooltip = ({ amount, className = "" }: { amount: number | string; className?: string }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-help inline-flex items-center transition-all duration-200 hover:scale-105 hover:shadow-sm rounded-sm px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10 ${className}`}>
          {formatCurrency(amount)}
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        align="center"
        className="bg-black/90 backdrop-blur-sm text-white border-0 shadow-xl rounded-lg px-3 py-2 text-sm font-medium max-w-xs"
        sideOffset={8}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs opacity-80">Full Amount</span>
          <span className="text-base font-semibold">{formatCurrencyFull(amount)}</span>
        </div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function UsersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [isCashbackModalOpen, setIsCashbackModalOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState<string>("");
  const [cashbackAmount, setCashbackAmount] = useState<string>("");
  const [cashbackType, setCashbackType] = useState<"credit" | "debit">("credit");
  const [transactionDescription, setTransactionDescription] =
    useState<string>("");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "recharge" | "addfund" | "transfer"
  >("all");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Function to check if a code already exists in the database
  const checkIfReferralCodeExists = async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/users/check-referral-code?code=${code}`,
      );
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error("Error checking referral code existence:", error);
      return false; // Assume it doesn't exist in case of error
    }
  };

  // Function to generate a random 6-character code with exactly 4 letters and 2 numbers
  const generateReferralCode = async (): Promise<string> => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";

    // Function to create a single code
    const createCode = (): string => {
      // Create an array of 6 positions (0 to 5)
      const positions = [0, 1, 2, 3, 4, 5];

      // Randomly select 2 positions for numbers
      const numberPositions: number[] = [];
      while (numberPositions.length < 2) {
        const randomIndex = Math.floor(Math.random() * positions.length);
        const position = positions.splice(randomIndex, 1)[0];
        numberPositions.push(position);
      }

      // The remaining 4 positions will be for letters
      const letterPositions = positions;

      // Generate the code
      let code = "";
      for (let i = 0; i < 6; i++) {
        if (numberPositions.includes(i)) {
          // This position gets a number
          code += numbers.charAt(Math.floor(Math.random() * numbers.length));
        } else {
          // This position gets a letter
          code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
      }

      return code.toUpperCase();
    };

    // Generate a code and check uniqueness
    let isUnique = false;
    let generatedCode = "";
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      generatedCode = createCode();
      attempts++;

      try {
        const response = await fetch(
          `/api/users/check-referral-code?code=${generatedCode}`,
        );
        const data = await response.json();

        // If the code doesn't exist, it's unique
        isUnique = !data.exists;
      } catch (error) {
        console.error("Error checking referral code:", error);
        // If there's an error, assume the code is unique to avoid blocking the UI
        isUnique = true;
      }
    }

    return generatedCode;
  };

  // Function to generate a random password
  const generatePassword = () => {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Fetch users based on active tab
  const {
    data: usersData,
    isLoading,
    refetch: refetchUsers,
  } = useQuery<{ users: UserWithStats[] }>({
    queryKey: ["/api/users", activeTab],
    queryFn: async () => {
      if (activeTab === "all") {
        const response = await fetch("/api/users");
        return response.json();
      } else {
        const type =
          activeTab === "addfund" ? "ADD_FUND" : activeTab.toUpperCase();
        const response = await fetch(`/api/users?type=${type}`);
        return response.json();
      }
    },
    // Add these options for more responsive data fetching
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Data becomes stale after 5 seconds
  });

  // Fetch all transactions for the details modal
  const { data: userTransactions, isLoading: isLoadingTransactions } =
    useQuery<{ transactions: Transaction[] }>({
      queryKey: ["/api/transactions"],
      queryFn: async () => {
        // Fetch all transactions
        const response = await fetch("/api/transactions");
        return response.json();
      },
      refetchOnWindowFocus: true,
      refetchInterval: selectedUser && isUserDetailsOpen ? 5000 : false, // Refresh more frequently when modal is open
    });

  // Helper function to get user-specific transactions
  const getUserTransactions = (
    transactions: Transaction[] = [],
    userId?: number,
    statusFilter?: string,
  ): Transaction[] => {
    if (!userId || !transactions.length) return [];
    let filtered = transactions.filter((t) => t.userId === userId);
    
    // Apply status filter if provided
    if (statusFilter) {
      filtered = filtered.filter((t) => t.status.toUpperCase() === statusFilter.toUpperCase());
    }
    
    return filtered;
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof userFormSchema>) => {
      const response = await apiRequest("POST", "/api/users", userData);
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      // Reset form and close modal
      createForm.reset({
        username: "",
        password: "",
        name: "",
        email: "",
        gender: "",
        state: "",
        city: "",
        address: "",
        referralCode: "",
        referredBy: "",
      });
      setIsCreateModalOpen(false);

      // Show success toast with user info - with proper null checks
      if (data && data.user) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">User created successfully!</span>
            <span className="text-xs">
              Username: {data.user.username}
              {data.user.name && ` • Name: ${data.user.name}`}
            </span>
          </div>,
          { duration: 5000 },
        );
      } else {
        // Fallback success message if user data is missing
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">User created successfully!</span>
            <span className="text-xs">
              The new user has been added to the system.
            </span>
          </div>,
          { duration: 5000 },
        );
      }

      // Force a refresh of the users list
      setTimeout(() => {
        refetchUsers();
      }, 300);
    },
    onError: (error: any) => {
      // Check if there's a specific user message from the server
      const errorResponse = error.data || {};

      if (errorResponse.userMessage) {
        // Display the user-friendly message from the server
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Cannot create user</span>
            <span className="text-xs whitespace-pre-line">
              {errorResponse.userMessage}
            </span>
          </div>,
        );
      } else if (
        errorResponse.message &&
        errorResponse.message.includes("Username already exists")
      ) {
        // Handle duplicate username error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Username already taken</span>
            <span className="text-xs">
              This username is already registered. Please try a different one.
            </span>
          </div>,
        );
      } else if (
        errorResponse.message &&
        errorResponse.message.includes("Invalid referral code")
      ) {
        // Handle invalid referral code error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Invalid referral code</span>
            <span className="text-xs">
              We couldn't find this referral code in our system. Please verify
              and try again.
            </span>
          </div>,
        );
      } else if (errorResponse.errors) {
        // Handle validation errors with more user-friendly messages
        const fieldNames = {
          username: "Username",
          password: "Password",
          name: "Full name",
          email: "Email address",
          walletBalance: "Wallet balance",
          referralCode: "Referral code",
          referredBy: "Referrer code",
        };

        const validationErrors = Object.entries(errorResponse.errors)
          .map(([field, message]) => {
            const displayField =
              fieldNames[field as keyof typeof fieldNames] || field;
            return `• ${displayField}: ${message}`;
          })
          .join("\n");

        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Please check these fields</span>
            <span className="text-xs whitespace-pre-line">
              {validationErrors}
            </span>
          </div>,
        );
      } else {
        // Fallback to helpful generic error message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Unable to create user</span>
            <span className="text-xs">
              {error.message ||
                "We couldn't register this user at this time. Please try again later."}
            </span>
          </div>,
        );
      }

      // Log the full error for debugging
      console.error("User creation error:", error);

      // Reset form fields that might be causing issues
      createForm.setValue("username", createForm.getValues("username"));
      createForm.setValue("password", createForm.getValues("password"));
    },
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const response = await apiRequest(
        "POST",
        "/api/transactions",
        transactionData,
      );
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: () => {
      // Immediately invalidate and refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      // Force immediate refetch of user data
      refetchUsers();

      // Only show success message for non-wallet transactions
      if (selectedUser && isUserDetailsOpen) {
        // Refresh transactions data if user details modal is open
        queryClient.invalidateQueries({
          queryKey: ["/api/transactions", selectedUser.id],
        });
      }
    },
    onError: (error) => {
      toast.error(`Failed to create transaction: ${error.message}`);
    },
  });

  // Function to update a user in the list immediately for instant UI feedback
  const updateUserInList = (updatedUser: Partial<User> & { id: number }) => {
    if (!usersData?.users) return;

    // Update the user in the local state for immediate UI feedback
    const updatedUsers = usersData.users.map((user) =>
      user.id === updatedUser.id ? { ...user, ...updatedUser } : user,
    );

    // Update the local cache to show changes immediately
    queryClient.setQueryData(["/api/users"], { users: updatedUsers });
  };

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      createTransaction = false,
      amount = 0,
    }: {
      id: number;
      data: Partial<User>;
      createTransaction?: boolean;
      amount: number;
    }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data, variables) => {
      // Immediately invalidate and fetch all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/top"] });

      // Force immediate refetch of user data and other important queries
      refetchUsers();

      // Force immediate refresh of all dashboard data
      setTimeout(() => {
        // Additional refetches to ensure the UI is fully up-to-date
        queryClient.refetchQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.refetchQueries({ queryKey: ["/api/transactions/recent"] });
      }, 100); // Small delay to ensure the backend has processed everything

      setIsEditModalOpen(false);
      setIsCreditModalOpen(false);
      setIsDebitModalOpen(false);

      // Clear the wallet amount and description inputs
      setWalletAmount("");
      setTransactionDescription("");

      // Show more specific success message
      const statusUpdate = "isActive" in variables.data;
      const usernameUpdate = variables.data.username;
      const walletUpdate =
        variables.createTransaction && variables.amount !== 0;

      if (statusUpdate) {
        // Status update was handled in toggleUserStatus function with its own toast
      } else if (walletUpdate && variables.amount > 0) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Wallet credited successfully</span>
            <span className="text-xs">
              ₹{variables.amount} added to user's wallet
            </span>
          </div>,
        );
      } else if (walletUpdate && variables.amount < 0) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Wallet debited successfully</span>
            <span className="text-xs">
              ₹{Math.abs(variables.amount)} withdrawn from user's wallet
            </span>
          </div>,
        );
      } else {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">User updated successfully</span>
            <span className="text-xs">The user profile has been updated</span>
          </div>,
        );
      }

      // If it's a wallet operation, create a transaction record
      if (variables.createTransaction) {
        if (variables.amount > 0) {
          // Credit transaction
          createTransactionMutation.mutate({
            userId: variables.id,
            type: "ADD_FUND",
            amount: variables.amount.toString(),
            status: "SUCCESS",
            description: `Wallet credited by admin${transactionDescription ? ': ' + transactionDescription : ''}`,
            transactionId: `ADDFUND-${Date.now()}`,
          });
        } else if (variables.amount < 0) {
          // Debit transaction
          createTransactionMutation.mutate({
            userId: variables.id,
            type: "DEBIT",
            amount: Math.abs(variables.amount).toString(),
            status: "SUCCESS",
            description: `Wallet debited by admin${transactionDescription ? ': ' + transactionDescription : ''}`,
            transactionId: `DEBIT-${Date.now()}`,
          });
        }
      }
    },
    onError: (error: any) => {
      // Check if there's a specific user message from the server
      const errorResponse = error.data || {};

      if (errorResponse.userMessage) {
        // Display the user-friendly message from the server
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Update failed</span>
            <span className="text-xs whitespace-pre-line">
              {errorResponse.userMessage}
            </span>
          </div>,
        );
      } else if (
        errorResponse.message &&
        errorResponse.message.includes("Username already exists")
      ) {
        // Handle duplicate username error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Username already taken</span>
            <span className="text-xs">
              This username is already in use. Please choose a different one.
            </span>
          </div>,
        );
      } else if (
        errorResponse.message &&
        errorResponse.message.includes("Invalid referral code")
      ) {
        // Handle invalid referral code error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Invalid referral code</span>
            <span className="text-xs">
              The referral code you entered doesn't exist in our system.
            </span>
          </div>,
        );
      } else if (errorResponse.errors) {
        // Handle validation errors with more user-friendly messages
        const fieldNames = {
          username: "Username",
          password: "Password",
          name: "Full name",
          email: "Email address",
          walletBalance: "Wallet balance",
          referralCode: "Referral code",
          referredBy: "Referrer code",
        };

        const validationErrors = Object.entries(errorResponse.errors)
          .map(([field, message]) => {
            const displayField =
              fieldNames[field as keyof typeof fieldNames] || field;
            return `• ${displayField}: ${message}`;
          })
          .join("\n");

        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Please check these fields</span>
            <span className="text-xs whitespace-pre-line">
              {validationErrors}
            </span>
          </div>,
        );
      } else {
        // Fallback to helpful generic error message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Could not update user</span>
            <span className="text-xs">
              {error.message ||
                "We couldn't update this user right now. Please try again later."}
            </span>
          </div>,
        );
      }

      // Log the full error for debugging
      console.error("User update error:", error);
    },
  });

  // Cashback mutation
  const cashbackMutation = useMutation({
    mutationFn: async ({
      userId,
      amount,
      type,
    }: {
      userId: number;
      amount: number;
      type: "credit" | "debit";
    }) => {
      const user = usersData?.users.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");

      const currentCommission = parseFloat(user.commission?.toString() || "0");
      const currentWalletBalance = parseFloat(user.walletBalance?.toString() || "0");
      
      let newCommission;
      let newWalletBalance;

      if (type === "credit") {
        newCommission = currentCommission + amount;
        newWalletBalance = currentWalletBalance + amount;
      } else {
        newCommission = Math.max(0, currentCommission - amount);
        newWalletBalance = Math.max(0, currentWalletBalance - amount);
      }

      const response = await apiRequest("PATCH", `/api/users/${userId}`, {
        commission: newCommission,
        walletBalance: newWalletBalance.toString(),
      });

      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      const typeText = variables.type === "credit" ? "credited" : "debited";
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Cashback {typeText} successfully!</span>
          <span className="text-xs">
            ₹{variables.amount} has been {typeText} to both commission and wallet balance.
          </span>
        </div>,
        { duration: 4000 }
      );

      setCashbackAmount("");
      setIsCashbackModalOpen(false);
      // Keep the user view popup open by not setting selectedUser to null
    },
    onError: (error: any) => {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Cashback operation failed</span>
          <span className="text-xs">
            {error.message || "Please try again later."}
          </span>
        </div>
      );
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`, null);
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data) => {
      // Invalidate all queries that might include user data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

      // Show success toast with more details
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">User deleted successfully!</span>
          <span className="text-xs">
            The user and all associated data have been removed.
          </span>
        </div>,
        { duration: 5000 },
      );

      // Force a refresh of the users list
      setTimeout(() => {
        refetchUsers();
      }, 300);
    },
    onError: (error: any) => {
      // Check if there's a specific user message from the server
      const errorResponse = error.data || {};

      if (errorResponse.userMessage) {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Cannot delete user</span>
            <span className="text-xs whitespace-pre-line">
              {errorResponse.userMessage}
            </span>
          </div>,
        );
      } else if (
        errorResponse.message &&
        errorResponse.message.includes("foreign key constraint")
      ) {
        // Handle constraint error with user-friendly message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">User has related data</span>
            <span className="text-xs">
              This user has transactions or other records that prevent deletion.
              Consider making them inactive instead.
            </span>
          </div>,
        );
      } else {
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Unable to delete user</span>
            <span className="text-xs">
              {error.message ||
                "We couldn't delete this user right now. Please try again later."}
            </span>
          </div>,
        );
      }

      console.error("User deletion error:", error);
    },
  });

  // Form for creating a new user
  const createForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: generatePassword(), // Auto-generate a secure password
      name: "",
      email: "",
      gender: "",
      state: "",
      city: "",
      address: "",
      referralCode: "", // Will be set asynchronously when the form opens
      referredBy: "",
    },
  });

  // Form for editing a user
  const editForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
      gender: "",
      state: "",
      city: "",
      address: "",
      referralCode: "",
      referredBy: "",
      mpin: "",
    },
  });

  // Handle creating a new user
  const onCreateUser = (data: z.infer<typeof userFormSchema>) => {
    createUserMutation.mutate(data);
  };

  // Handle updating a user
  const onUpdateUser = (data: z.infer<typeof userFormSchema>) => {
    if (selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        data,
        amount: 0, // Default value for non-credit operations
      });
    }
  };

  // Toggle user active status with optimistic UI update
  const toggleUserStatus = (userId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const statusText = newStatus ? "active" : "inactive";

    // Create a loading toast with a promise
    const togglePromise = toast.promise(
      new Promise((resolve, reject) => {
        // Apply optimistic update to the cache
        const currentUsers = usersData?.users || [];
        const updatedUsers = currentUsers.map((user) =>
          user.id === userId ? { ...user, isActive: newStatus } : user,
        );

        // Update the cache immediately for responsive UI
        queryClient.setQueryData(["/api/users"], {
          users: updatedUsers,
        });

        // Then perform the actual API call
        updateUserMutation.mutate(
          {
            id: userId,
            data: { isActive: newStatus },
            amount: 0,
          },
          {
            onSuccess: () => resolve("success"),
            onError: (error) => {
              // Rollback the optimistic update on error
              queryClient.setQueryData(["/api/users"], {
                users: currentUsers,
              });
              reject(error);
            },
          },
        );
      }),
      {
        loading: "Updating user status...",
        success: (
          <div className="flex flex-col gap-1">
            <span className="font-medium">User status updated</span>
            <span className="text-xs">User is now {statusText}</span>
          </div>
        ),
        error: (
          <div className="flex flex-col gap-1">
            <span className="font-medium">Failed to update status</span>
            <span className="text-xs">Please try again</span>
          </div>
        ),
      },
      {
        success: { duration: 3000 },
        error: { duration: 4000 },
      },
    );
  };

  // Open the edit modal and populate form data
  const handleEditUser = (user: UserWithStats) => {
    setSelectedUser(user);
    editForm.reset({
      username: user.username,
      password: "", // Don't populate password for security
      name: user.name || "",
      email: user.email || "",
      gender: user.gender || "",
      state: user.state || "",
      city: user.city || "",
      address: user.address || "",
      referralCode: user.referralCode || "",
      referredBy: user.referredBy || "",
      mpin: "", // Don't populate MPIN for security, leave blank
    });
    setIsEditModalOpen(true);
  };

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | undefined>(
    undefined,
  );

  // Handle initiating user deletion
  const handleDeleteUser = (id: number) => {
    setUserToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  // Handle confirming user deletion with optimistic updates
  const confirmDeleteUser = () => {
    if (userToDelete) {
      // Implement optimistic update
      const currentUsers = usersData?.users || [];
      const updatedUsers = currentUsers.filter(
        (user) => user.id !== userToDelete,
      );

      // Update the cache immediately for responsive UI
      queryClient.setQueryData(["/api/users"], {
        users: updatedUsers,
      });

      // Close dialog immediately for better UX
      setIsDeleteDialogOpen(false);

      // Show delete-in-progress toast
      const deletePromise = toast.promise(
        new Promise((resolve, reject) => {
          deleteUserMutation.mutate(userToDelete, {
            onSuccess: () => resolve("success"),
            onError: (error) => {
              // Rollback the optimistic update on error
              queryClient.setQueryData(["/api/users"], {
                users: currentUsers,
              });
              reject(error);
            },
          });
        }),
        {
          loading: "Deleting user...",
          success: "User deleted successfully",
          error: "Failed to delete user. Please try again.",
        },
        {
          success: { duration: 3000 },
          error: { duration: 4000 },
        },
      );

      setUserToDelete(undefined);
    }
  };

  // Filter users by search term and active/inactive status
  const filteredUsers =
    usersData?.users.filter((user) => {
      // First filter by search term
      const matchesSearch =
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.name &&
          user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email &&
          user.email.toLowerCase().includes(searchTerm.toLowerCase()));

      // Then filter by active status if applicable
      if (activeFilter === "active") {
        return matchesSearch && user.isActive === true;
      } else if (activeFilter === "inactive") {
        return matchesSearch && user.isActive === false;
      }

      // If activeFilter is 'all', only apply the search filter
      return matchesSearch;
    }) || [];

  // Dynamically generate columns based on active tab
  const columns = [
    {
      key: "id",
      title: "ID",
      render: (user: UserWithStats) => <span>#{user.id}</span>,
    },
    {
      key: "user",
      title: "User",
      render: (user: UserWithStats) => (
        <div className="flex items-center">
          <Avatar className="h-8 w-8">
            <AvatarFallback name={user.name || user.username} />
          </Avatar>
          <div className="ml-3">
            <p className="text-sm font-medium">{user.name || user.username}</p>
            <p className="text-xs text-gray-500">{user.email || "No email"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "username",
      title: "Username",
      render: (user: UserWithStats) => (
        <span className="text-sm">{user.username}</span>
      ),
    },
    {
      key: "walletBalance",
      title: "Wallet Balance",
      render: (user: UserWithStats) => (
        <span className="text-sm font-medium">
          <CurrencyTooltip amount={user.walletBalance} />
        </span>
      ),
      sortable: true,
      sortingFn: (a: UserWithStats, b: UserWithStats) => {
        return parseFloat(String(a.walletBalance)) - parseFloat(String(b.walletBalance));
      },
    },
    // Show transaction stats column only when a filter is active
    ...(activeTab !== "all"
      ? [
          {
            key: "transactionStats",
            title:
              activeTab === "recharge"
                ? "Recharge Stats"
                : activeTab === "addfund"
                  ? "Add Fund Stats"
                  : "Transfer Stats",
            render: (user: UserWithStats) => (
              <div className="text-sm">
                <div className="font-medium">
                  Volume: <CurrencyTooltip amount={user.transactionVolume || "0"} />
                </div>
                <div className="text-muted-foreground">
                  Count: {user.transactionCount || 0}
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "totalSpent",
      title: "Total Payments",
      render: (user: UserWithStats) => {
        // Calculate total payments directly
        const totalPayments = userTransactions?.transactions
          ? userTransactions.transactions
              .filter((t) => t.userId === user.id)
              .filter((t) => t.type === "RECHARGE" || t.type === "TRANSFER")
              .filter((t) => t.status === "SUCCESS")
              .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)
          : 0;

        return (
          <CurrencyDisplay 
          amount={totalPayments || 0}
          className="text-sm font-medium"
        />
        );
      },
      sortable: true,
      sortingFn: (a: UserWithStats, b: UserWithStats) => {
        // Calculate total payments for user A
        const paymentsA = userTransactions?.transactions
          ? userTransactions.transactions
              .filter((t) => t.userId === a.id)
              .filter((t) => t.type === "RECHARGE" || t.type === "TRANSFER")
              .filter((t) => t.status === "SUCCESS")
              .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)
          : 0;
          
        // Calculate total payments for user B
        const paymentsB = userTransactions?.transactions
          ? userTransactions.transactions
              .filter((t) => t.userId === b.id)
              .filter((t) => t.type === "RECHARGE" || t.type === "TRANSFER")
              .filter((t) => t.status === "SUCCESS")
              .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)
          : 0;
          
        return paymentsA - paymentsB;
      },
    },
    {
      key: "commission",
      title: "Cashback",
      render: (user: UserWithStats) => (
        <CurrencyDisplay 
          amount={user.commission || "0"}
          className="text-sm font-medium text-green-600"
        />
      ),
      sortable: true,
      sortingFn: (a: UserWithStats, b: UserWithStats) => {
        const commissionA = parseFloat(String(a.commission || 0));
        const commissionB = parseFloat(String(b.commission || 0));
        return commissionA - commissionB;
      },
    },
    {
      key: "isAdmin",
      title: "Role",
      render: (user: UserWithStats) => (
        <Badge variant={user.isAdmin ? "default" : "outline"}>
          {user.isAdmin ? "Admin" : "User"}
        </Badge>
      ),
    },
    {
      key: "isActive",
      title: "Status",
      render: (user: UserWithStats) => (
        <div className="flex items-center space-x-2">
          <div className="flex flex-col items-center">
            <span className="text-sm mb-1 font-medium">
              {user.isActive ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={user.isActive}
              onCheckedChange={() => toggleUserStatus(user.id, user.isActive)}
              className={`${
                user.isActive
                  ? "data-[state=checked]:bg-green-500 border-green-400"
                  : "data-[state=unchecked]:bg-red-200 border-red-400"
              }`}
            />
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (user: UserWithStats) => {
        // Add view transactions functionality
        const viewTransactions = () => {
          toast.success(
            `Viewing transactions for ${user.name || user.username}`,
          );
          // Navigate to transactions page filtered by this user
          window.location.href = `/transactions?userId=${user.id}`;
        };

        // Copy referral code functionality
        const copyReferralCode = () => {
          if (user.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            toast.success("Referral code copied to clipboard");
          } else {
            toast.error("This user has no referral code to copy");
          }
        };

        return (
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => {
                setSelectedUser(user);
                setIsUserDetailsOpen(true);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-xl">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <UserCog className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">
              Users Management
            </h1>
          </div>
          <p className="text-muted-foreground max-w-xl ml-10">
            Manage users, view transaction history, and track user performance
            metrics.
          </p>
        </div>
        <Button
          onClick={async () => {
            // Generate new password and unique referral code when opening create modal
            createForm.setValue("password", generatePassword());
            const referralCode = await generateReferralCode();
            createForm.setValue("referralCode", referralCode);
            setIsCreateModalOpen(true);
          }}
          variant="default"
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-md rounded-full px-5"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          <span>Add New User</span>
        </Button>
      </div>

      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg p-6 space-y-6 border border-slate-100">
        {/* Stats Cards */}
        <div className="flex flex-wrap gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-none shadow-sm flex-1">
            <CardContent className="flex items-center p-6">
              <div className="bg-blue-500/10 p-3 rounded-full mr-4">
                <UserCog className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{filteredUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-none shadow-sm flex-1">
            <CardContent className="flex items-center p-6">
              <div className="bg-green-500/10 p-3 rounded-full mr-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">
                  {filteredUsers.filter((user) => user.isActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-none shadow-sm flex-1">
            <CardContent className="flex items-center p-6">
              <div className="bg-red-500/10 p-3 rounded-full mr-4">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive Users</p>
                <p className="text-2xl font-bold">
                  {filteredUsers.filter((user) => !user.isActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-none shadow-sm flex-1">
            <CardContent className="flex items-center p-6">
              <div className="bg-purple-500/10 p-3 rounded-full mr-4">
                <AlertCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Unverified Users
                </p>
                <p className="text-2xl font-bold">
                  {
                    filteredUsers.filter((user) => user.isFirstLogin === true)
                      .length
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="border-b border-slate-200 pb-5">
          <div className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Button
                  variant={activeTab === "all" ? "default" : "outline"}
                  onClick={() => setActiveTab("all")}
                  className="rounded-full flex items-center gap-2"
                  size="sm"
                >
                  <UserCog className="h-4 w-4" />
                  <span>All Users</span>
                </Button>
                <Button
                  variant={activeTab === "recharge" ? "default" : "outline"}
                  onClick={() => setActiveTab("recharge")}
                  className="rounded-full flex items-center gap-2"
                  size="sm"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Top Recharge</span>
                </Button>
                <Button
                  variant={activeTab === "addfund" ? "default" : "outline"}
                  onClick={() => setActiveTab("addfund")}
                  className="rounded-full flex items-center gap-2"
                  size="sm"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Top Add Fund</span>
                </Button>
                <Button
                  variant={activeTab === "transfer" ? "default" : "outline"}
                  onClick={() => setActiveTab("transfer")}
                  className="rounded-full flex items-center gap-2"
                  size="sm"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span>Top Transfer</span>
                </Button>

                {/* Active/Inactive filter dropdown */}
                <Select
                  value={activeFilter}
                  onValueChange={(value: "all" | "active" | "inactive") =>
                    setActiveFilter(value)
                  }
                >
                  <SelectTrigger className="w-[145px] h-9 rounded-full">
                    <SelectValue placeholder="Status Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  placeholder="Search by name, email or username..."
                  className="pl-10 pr-4 py-2 w-[300px] rounded-full border-slate-200 bg-slate-50 focus:bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          data={filteredUsers}
          columns={columns}
          isLoading={isLoading}
        />
      </div>

      {/* Create User Modal */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          // Reset form when dialog is closed or opened
          if (!open) {
            createForm.reset({
              username: "",
              password: "",
              name: "",
              email: "",
              gender: "",
              state: "",
              city: "",
              address: "",
              referralCode: "",
              referredBy: "",
            });
          } else {
            // Generate new values when dialog is opened
            createForm.setValue("password", generatePassword());

            // Generate unique referral code asynchronously
            generateReferralCode().then((code) => {
              createForm.setValue("referralCode", code);
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">
              Create New User
            </DialogTitle>
            <DialogDescription>
              Fill in the details to create a new user.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(onCreateUser)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username*</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password* (Auto-Generated)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••"
                          {...field}
                          disabled
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="California"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="San Francisco"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main St"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Code (Auto-Generated)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC123"
                          {...field}
                          value={field.value || ""}
                          disabled
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="referredBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referred By</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="XYZ789"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the user details.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onUpdateUser)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username*</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="mpin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MPIN (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="4-digit MPIN"
                        maxLength={4}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Other fields similar to create form */}
              <DialogFooter>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={isUserDetailsOpen} onOpenChange={setIsUserDetailsOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[95vh] overflow-y-auto bg-gradient-to-b from-white to-slate-50">
          {selectedUser && (
            <>
              <DialogHeader className="pb-6 border-b mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-2 border-primary/20 ring-2 ring-primary/10 ring-offset-2 shadow-md">
                        <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary/20 to-primary/30 text-primary">
                          {getInitials(
                            selectedUser.name || selectedUser.username,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                        <div
                          className={`h-5 w-5 rounded-full ${selectedUser.isActive ? "bg-green-500" : "bg-red-500"}`}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-primary to-primary/70 text-transparent bg-clip-text">
                        {selectedUser.name || selectedUser.username}
                        {selectedUser.isAdmin && (
                          <Badge className="ml-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Member Since:{" "}
                          {selectedUser.createdAt
                            ? formatDate(selectedUser.createdAt)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-full border-primary/20 hover:bg-primary/5"
                      onClick={() => handleEditUser(selectedUser)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Profile
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full shadow-sm"
                      onClick={() => {
                        setWalletAmount("");
                        setIsCreditModalOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Credit Wallet
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-full shadow-sm"
                      onClick={() => {
                        setWalletAmount("");
                        setIsDebitModalOpen(true);
                      }}
                    >
                      <Minus className="h-4 w-4" />
                      Debit Wallet
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-full border-orange-200 hover:bg-orange-50 text-orange-600"
                      onClick={() => {
                        setCashbackAmount("");
                        setCashbackType("credit");
                        setIsCashbackModalOpen(true);
                      }}
                    >
                      <Calculator className="h-4 w-4" />
                      Cashback
                    </Button>

                    {/* Delete button removed as requested */}
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="profile" className="mt-6">
                <TabsList className="mb-4 grid grid-cols-3">
                  <TabsTrigger
                    value="profile"
                    className="flex items-center gap-2"
                  >
                    <UserCircle className="h-4 w-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger
                    value="transactions"
                    className="flex items-center gap-2"
                  >
                    <Activity className="h-4 w-4" />
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger
                    value="stats"
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Statistics
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Financial Information Card */}
                    <Card className="col-span-1 overflow-hidden border-primary/10 shadow-md">
                      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
                        <CardTitle className="text-base font-medium flex items-center">
                          <Landmark className="h-4 w-4 mr-2 text-primary" />
                          Financial Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm p-6">
                        <div className="bg-gradient-to-r from-green-50 to-transparent p-4 rounded-lg mb-4 border border-green-100">
                          <div className="text-sm text-muted-foreground mb-1">
                            Wallet Balance
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            <CurrencyTooltip amount={selectedUser.walletBalance} />
                          </div>
                          <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                            <span>Last updated</span>
                            <span>{formatDate(new Date())}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gradient-to-br from-green-50 to-transparent p-3 rounded-lg border border-green-100">
                            <div className="text-xs text-muted-foreground mb-1">
                              Total Cashback
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(
                                // Use both commission field and sum of CASHBACK transactions
                                selectedUser.commission !== undefined && selectedUser.commission !== null
                                ? selectedUser.commission
                                : getUserTransactions(
                                    userTransactions?.transactions,
                                    selectedUser?.id,
                                  )
                                    .filter((t) => t.type === "CASHBACK" && t.status === "SUCCESS")
                                    .reduce(
                                      (sum, t) => sum + parseFloat(t.amount.toString()),
                                      0,
                                    ) || 0,
                              )}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-amber-50 to-transparent p-3 rounded-lg border border-amber-100">
                            <div className="text-xs text-muted-foreground mb-1">
                              Total Spent Amount
                            </div>
                            <div className="text-lg font-bold text-amber-600">
                              {formatCurrency(
                                getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id,
                                )
                                  .filter(
                                    (t) =>
                                      t.type === "RECHARGE" ||
                                      t.type === "TRANSFER",
                                  )
                                  .filter((t) => t.status === "SUCCESS")
                                  .reduce(
                                    (sum, t) => sum + parseFloat(t.amount),
                                    0,
                                  ) || 0,
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            Transaction Summary
                          </h4>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Total Recharge */}
                            <div className="bg-gradient-to-br from-blue-50 to-transparent p-3 rounded-lg border border-blue-100">
                              <div className="text-xs text-muted-foreground mb-1">
                                Total Recharge
                              </div>
                              <div className="text-sm font-bold text-blue-600">
                                {formatCurrency(
                                  getUserTransactions(
                                    userTransactions?.transactions,
                                    selectedUser?.id,
                                  )
                                    .filter((t) => t.type === "RECHARGE" && t.status === "SUCCESS")
                                    .reduce(
                                      (sum, t) => sum + parseFloat(t.amount),
                                      0,
                                    ) || 0,
                                )}
                              </div>
                            </div>

                            {/* Total Add Money */}
                            <div className="bg-gradient-to-br from-emerald-50 to-transparent p-3 rounded-lg border border-emerald-100">
                              <div className="text-xs text-muted-foreground mb-1">
                                Total Add Money
                              </div>
                              <div className="text-sm font-bold text-emerald-600">
                                {formatCurrency(
                                  getUserTransactions(
                                    userTransactions?.transactions,
                                    selectedUser?.id,
                                  )
                                    .filter((t) => t.type === "ADD_FUND" && t.status === "SUCCESS")
                                    .reduce(
                                      (sum, t) => sum + parseFloat(t.amount),
                                      0,
                                    ) || 0,
                                )}
                              </div>
                            </div>

                            {/* Total Money Sent */}
                            <div className="bg-gradient-to-br from-amber-50 to-transparent p-3 rounded-lg border border-amber-100">
                              <div className="text-xs text-muted-foreground mb-1">
                                Total Money Sent
                              </div>
                              <div className="text-sm font-bold text-amber-600">
                                {formatCurrency(
                                  getUserTransactions(
                                    userTransactions?.transactions,
                                    selectedUser?.id,
                                  )
                                    .filter(
                                      (t) =>
                                        t.type === "TRANSFER" &&
                                        t.status === "SUCCESS",
                                    )
                                    .reduce(
                                      (sum, t) => sum + parseFloat(t.amount),
                                      0,
                                    ) || 0,
                                )}
                              </div>
                            </div>

                            {/* Total Money Received */}
                            <div className="bg-gradient-to-br from-blue-50 to-transparent p-3 rounded-lg border border-blue-100">
                              <div className="text-xs text-muted-foreground mb-1">
                                Total Money Received
                              </div>
                              <div className="text-sm font-bold text-blue-600">
                                {formatCurrency(
                                  (userTransactions?.transactions || [])
                                    .filter(
                                      (t) =>
                                        t.type === "TRANSFER" &&
                                        t.status === "SUCCESS" &&
                                        t.recipientId === selectedUser?.id,
                                    )
                                    .reduce(
                                      (sum, t) => sum + parseFloat(t.amount),
                                      0,
                                    ) || 0,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Personal Details Card */}
                    <Card className="col-span-1 overflow-hidden border-primary/10 shadow-md">
                      <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-transparent">
                        <CardTitle className="text-base font-medium flex items-center">
                          <BadgeInfo className="h-4 w-4 mr-2 text-primary" />
                          Personal Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm p-6">
                        <div className="grid grid-cols-1 gap-3">
                          {/* Email */}
                          <div className="rounded-lg p-3 bg-indigo-50 border border-indigo-100 flex flex-col">
                            <div className="text-xs text-indigo-500 font-medium flex items-center mb-1.5">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </div>
                            <div className="font-medium text-sm">
                              {selectedUser.email || "Not provided"}
                            </div>
                          </div>

                          {/* Phone Number */}
                          <div className="rounded-lg p-3 bg-blue-50 border border-blue-100 flex flex-col">
                            <div className="text-xs text-blue-500 font-medium flex items-center mb-1.5">
                              <Phone className="h-3 w-3 mr-1" />
                              Phone
                            </div>
                            <div className="font-medium text-sm">
                              {selectedUser.username || "Not provided"}
                            </div>
                          </div>

                          {/* Gender */}
                          <div className="rounded-lg p-3 bg-purple-50 border border-purple-100 flex flex-col">
                            <div className="text-xs text-purple-500 font-medium flex items-center mb-1.5">
                              <UserCircle className="h-3 w-3 mr-1" />
                              Gender
                            </div>
                            <div className="font-medium text-sm capitalize">
                              {selectedUser.gender || "Not provided"}
                            </div>
                          </div>

                          {/* Address Info */}
                          <div className="rounded-lg p-3 bg-emerald-50 border border-emerald-100 flex flex-col">
                            <div className="text-xs text-emerald-500 font-medium flex items-center mb-1.5">
                              <MapPin className="h-3 w-3 mr-1" />
                              Location
                            </div>
                            <div className="font-medium text-sm">
                              {selectedUser.address ||
                              selectedUser.city ||
                              selectedUser.state
                                ? [
                                    selectedUser.address,
                                    selectedUser.city,
                                    selectedUser.state,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")
                                : "Not provided"}
                            </div>
                          </div>

                          {/* IP Address */}
                          <div className="rounded-lg p-3 bg-sky-50 border border-sky-100 flex flex-col">
                            <div className="text-xs text-sky-500 font-medium flex items-center mb-1.5">
                              <Network className="h-3 w-3 mr-1" />
                              IP Address
                            </div>
                            <div className="font-medium text-sm">
                              {getUserTransactions(
                                userTransactions?.transactions,
                                selectedUser?.id,
                              )
                                .sort(
                                  (a, b) =>
                                    new Date(b.timestamp).getTime() -
                                    new Date(a.timestamp).getTime(),
                                )
                                .slice(0, 1)
                                .map((t) => t.ipAddress)[0] || "Not available"}
                            </div>
                          </div>

                          {/* Device Info */}
                          <div className="rounded-lg p-3 bg-rose-50 border border-rose-100 flex flex-col">
                            <div className="text-xs text-rose-500 font-medium flex items-center mb-1.5">
                              <Smartphone className="h-3 w-3 mr-1" />
                              Device Info
                            </div>
                            <div className="font-medium text-sm">
                              {getUserTransactions(
                                userTransactions?.transactions,
                                selectedUser?.id,
                              )
                                .sort(
                                  (a, b) =>
                                    new Date(b.timestamp).getTime() -
                                    new Date(a.timestamp).getTime(),
                                )
                                .slice(0, 1)
                                .map((t) => t.deviceInfo)[0] || "Not available"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Referral Information Card */}
                    <Card className="col-span-1 overflow-hidden border-primary/10 shadow-md">
                      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-transparent">
                        <CardTitle className="text-base font-medium flex items-center">
                          <Award className="h-4 w-4 mr-2 text-primary" />
                          Referral Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm p-6">
                        <div className="bg-gradient-to-r from-amber-50 to-transparent p-4 rounded-lg mb-4 border border-amber-100">
                          <div className="text-sm text-muted-foreground mb-1">
                            Your Referral Code
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-100 flex-1 text-center">
                              {selectedUser.referralCode || "N/A"}
                            </div>
                            {selectedUser.referralCode && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-amber-200 hover:bg-amber-50"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    selectedUser.referralCode || "",
                                  );
                                  toast.success(
                                    "Referral code copied to clipboard",
                                  );
                                }}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Copy
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gradient-to-br from-purple-50 to-transparent p-3 rounded-lg border border-purple-100">
                            <div className="text-xs text-muted-foreground mb-1">
                              Referred By
                            </div>
                            <div className="text-lg font-medium text-purple-600">
                              {selectedUser.referredBy || "N/A"}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-transparent p-3 rounded-lg border border-green-100">
                            <div className="text-xs text-muted-foreground mb-1">
                              Total Referrals
                            </div>
                            <div className="text-lg font-bold text-green-600 flex items-center">
                              <span className="bg-green-100 text-green-600 rounded-full h-5 w-5 inline-flex items-center justify-center mr-1.5 text-xs">
                                <Check className="h-3 w-3" />
                              </span>
                              {selectedUser.referralCount || "0"}
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-transparent p-3 rounded-lg border border-emerald-100">
                          <div className="text-xs text-muted-foreground mb-1">
                            Referral Earnings
                          </div>
                          <div className="text-lg font-bold text-emerald-600 flex items-center">
                            <span className="bg-emerald-100 text-emerald-600 rounded-full h-5 w-5 inline-flex items-center justify-center mr-1.5 text-xs">
                              <DollarSign className="h-3 w-3" />
                            </span>
                            {formatCurrency(
                              selectedUser.referralEarnings || "0",
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Recent Transactions
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary"
                          onClick={() =>
                            (window.location.href = `/transactions?userId=${selectedUser.id}`)
                          }
                        >
                          View All
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingTransactions ? (
                        <div className="space-y-2">
                          {Array(5)
                            .fill(0)
                            .map((_, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center p-3 bg-muted/30 animate-pulse rounded-md"
                              >
                                <div className="h-6 w-28 bg-muted rounded"></div>
                                <div className="h-6 w-20 bg-muted rounded"></div>
                              </div>
                            ))}
                        </div>
                      ) : userTransactions?.transactions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>No transactions found</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {getUserTransactions(
                            userTransactions?.transactions,
                            selectedUser?.id,
                          )
                            .slice(0, 10)
                            .map((transaction: Transaction) => (
                              <div
                                key={transaction.id}
                                className="flex justify-between items-center p-3 rounded-md hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center
                                  ${
                                    transaction.type === "RECHARGE"
                                      ? "bg-blue-100 text-blue-600"
                                      : transaction.type === "ADD_FUND"
                                        ? "bg-green-100 text-green-600"
                                        : transaction.type === "TRANSFER"
                                          ? "bg-orange-100 text-orange-600"
                                          : "bg-gray-100 text-gray-600"
                                  }`}
                                  >
                                    {transaction.type === "RECHARGE" ? (
                                      <Smartphone className="h-4 w-4" />
                                    ) : transaction.type === "ADD_FUND" ? (
                                      <DollarSign className="h-4 w-4" />
                                    ) : transaction.type === "TRANSFER" ? (
                                      <ArrowUpDown className="h-4 w-4" />
                                    ) : (
                                      <Activity className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">
                                      {transaction.type === "RECHARGE"
                                        ? "Recharge"
                                        : transaction.type === "ADD_FUND"
                                          ? "Wallet Credit"
                                          : transaction.type === "TRANSFER"
                                            ? "Money Transfer"
                                            : transaction.type}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center">
                                      {transaction.timestamp &&
                                        formatDate(transaction.timestamp)}
                                      <span className="mx-1">•</span>
                                      TRX: {transaction.transactionId}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`font-medium ${
                                      transaction.status === "SUCCESS"
                                        ? "text-green-600"
                                        : transaction.status === "FAILED"
                                          ? "text-red-600"
                                          : "text-yellow-600"
                                    }`}
                                  >
                                    <CurrencyTooltip amount={transaction.amount} />
                                  </div>
                                  <div className="text-xs flex items-center justify-end">
                                    <Badge
                                      variant={
                                        transaction.status === "SUCCESS"
                                          ? "default"
                                          : transaction.status === "FAILED"
                                            ? "destructive"
                                            : "outline"
                                      }
                                      className="text-[10px] py-0 h-4"
                                    >
                                      {transaction.status}
                                    </Badge>
                                  </div>
                                  {transaction.walletBalanceBefore !== undefined && 
                                   transaction.walletBalanceAfter !== undefined && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      <span className="flex items-center justify-end gap-1">
                                        <Wallet className="h-3 w-3" />
                                        <CurrencyTooltip amount={transaction.walletBalanceBefore} /> → <CurrencyTooltip amount={transaction.walletBalanceAfter} />
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Statistics Tab */}
                <TabsContent value="stats" className="space-y-6">
                  {/* Analytics Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-0 shadow-md">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-300">
                            Total Transactions
                          </p>
                          <p className="text-2xl font-bold">
                            {getUserTransactions(
                              userTransactions?.transactions,
                              selectedUser?.id,
                              'SUCCESS'
                            ).length || 0}
                          </p>
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 flex items-center">
                            <Activity className="h-3 w-3 mr-1" />
                            Lifetime activity
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                          <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-0 shadow-md">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-600 dark:text-green-300">
                            Transaction Volume
                          </p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(
                              getUserTransactions(
                                userTransactions?.transactions,
                                selectedUser?.id,
                                'SUCCESS'
                              ).reduce(
                                (sum, t) => sum + parseFloat(t.amount),
                                0,
                              ) || 0,
                            )}
                          </p>
                          <p className="text-xs text-green-500 dark:text-green-400 mt-1 flex items-center">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Total processed
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                          <Wallet className="h-6 w-6 text-green-600 dark:text-green-300" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-0 shadow-md">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-600 dark:text-purple-300">
                            Success Rate
                          </p>
                          <p className="text-2xl font-bold">
                            {userTransactions?.transactions.length
                              ? Math.round(
                                  (userTransactions?.transactions.filter(
                                    (t) => t.status === "SUCCESS",
                                  ).length /
                                    userTransactions?.transactions.length) *
                                    100,
                                ) + "%"
                              : "0%"}
                          </p>
                          <p className="text-xs text-purple-500 dark:text-purple-400 mt-1 flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Transaction success
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                          <PieChart className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-0 shadow-md">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                            Avg. Transaction
                          </p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(
                              getUserTransactions(
                                userTransactions?.transactions,
                                selectedUser?.id,
                                'SUCCESS'
                              ).reduce(
                                (sum, t) => sum + parseFloat(t.amount),
                                0,
                              ) /
                                (getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id,
                                  'SUCCESS'
                                ).length || 1) || 0,
                            )}
                          </p>
                          <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 flex items-center">
                            <Receipt className="h-3 w-3 mr-1" />
                            Per transaction
                          </p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                          <Calculator className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="col-span-3 md:col-span-1 border-0 shadow-lg bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                      <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-base font-medium flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-primary" />
                          Transaction Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-5">
                          {/* Calculate stats from transaction data */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                <span className="text-sm font-medium">
                                  Transactions
                                </span>
                              </div>
                              <span className="font-bold text-blue-600">
                                {getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id,
                                  'SUCCESS'
                                ).length || 0}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(
                                100,
                                ((getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id,
                                  'SUCCESS'
                                ).length || 0) /
                                  10) *
                                  100,
                              )}
                              className="h-2 bg-blue-100"
                            />
                            <p className="text-xs text-gray-500 italic">
                              Based on expected monthly volume
                            </p>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                <span className="text-sm font-medium">
                                  Success Rate
                                </span>
                              </div>
                              <span className="font-bold text-green-600">
                                {(() => {
                                  const userTxs = getUserTransactions(
                                    userTransactions?.transactions,
                                    selectedUser?.id,
                                  );
                                  return userTxs.length
                                    ? Math.round(
                                        (userTxs.filter(
                                          (t) => t.status === "SUCCESS",
                                        ).length /
                                          userTxs.length) *
                                          100,
                                      )
                                    : 0;
                                })()}
                                %
                              </span>
                            </div>
                            <Progress
                              value={(() => {
                                const userTxs = getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id,
                                );
                                return userTxs.length
                                  ? Math.round(
                                      (userTxs.filter(
                                        (t) => t.status === "SUCCESS",
                                      ).length /
                                        userTxs.length) *
                                        100,
                                    )
                                  : 0;
                              })()}
                              className="h-2 bg-green-100"
                            />
                            <p className="text-xs text-gray-500 italic">
                              Target: 95% success rate
                            </p>
                          </div>

                          <div className="pt-2">
                            <div className="grid grid-cols-2 gap-4">
                              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-0 shadow-md">
                                <CardContent className="p-3">
                                  <div className="flex items-center mb-1">
                                    <Phone className="h-3 w-3 mr-1 text-indigo-600" />
                                    <div className="text-xs font-medium text-indigo-600">
                                      Recharges
                                    </div>
                                  </div>
                                  <div className="text-xl font-bold">
                                    {getUserTransactions(
                                      userTransactions?.transactions,
                                      selectedUser?.id,
                                    ).filter((t) => t.type === "RECHARGE" && t.status === "SUCCESS")
                                      .length || 0}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900 border-0 shadow-md">
                                <CardContent className="p-3">
                                  <div className="flex items-center mb-1">
                                    <Plus className="h-3 w-3 mr-1 text-emerald-600" />
                                    <div className="text-xs font-medium text-emerald-600">
                                      Add Funds
                                    </div>
                                  </div>
                                  <div className="text-xl font-bold">
                                    {getUserTransactions(
                                      userTransactions?.transactions,
                                      selectedUser?.id,
                                    ).filter((t) => t.type === "ADD_FUND" && t.status === "SUCCESS")
                                      .length || 0}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900 dark:to-yellow-900 border-0 shadow-md">
                                <CardContent className="p-3">
                                  <div className="flex items-center mb-1">
                                    <ArrowUpDown className="h-3 w-3 mr-1 text-amber-600" />
                                    <div className="text-xs font-medium text-amber-600">
                                      Transfers
                                    </div>
                                  </div>
                                  <div className="text-xl font-bold">
                                    {getUserTransactions(
                                      userTransactions?.transactions,
                                      selectedUser?.id,
                                    ).filter((t) => t.type === "TRANSFER" && t.status === "SUCCESS")
                                      .length || 0}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900 dark:to-red-900 border-0 shadow-md">
                                <CardContent className="p-3">
                                  <div className="flex items-center mb-1">
                                    <Minus className="h-3 w-3 mr-1 text-rose-600" />
                                    <div className="text-xs font-medium text-rose-600">
                                      Debits
                                    </div>
                                  </div>
                                  <div className="text-xl font-bold">
                                    {getUserTransactions(
                                      userTransactions?.transactions,
                                      selectedUser?.id,
                                    ).filter((t) => t.type === "DEBIT" && t.status === "SUCCESS")
                                      .length || 0}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="col-span-3 md:col-span-2 border-0 shadow-lg bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                      <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-base font-medium flex items-center">
                          <Wallet className="h-4 w-4 mr-2 text-primary" />
                          Wallet Balance Track
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="h-[400px] flex flex-col">
                          {userTransactions?.transactions.length === 0 ? (
                            <div className="text-center text-muted-foreground">
                              <Wallet className="h-16 w-16 mx-auto mb-3 opacity-20" />
                              <p className="text-lg font-medium">
                                No wallet balance history available
                              </p>
                              <p className="text-sm text-gray-500 max-w-md mt-2">
                                Wallet balance changes will be displayed here once
                                this user has completed transactions.
                              </p>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col">
                              <div className="mb-4">
                                <h3 className="text-xl font-bold text-center mb-2">
                                  Wallet Balance History
                                </h3>
                                <div className="flex justify-center space-x-3 mb-2">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Current Balance</p>
                                    <p className="text-lg font-bold text-green-600">
                                      <CurrencyTooltip amount={selectedUser?.walletBalance || 0} />
                                    </p>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-500 text-center">
                                  Track all wallet balance changes over time
                                </p>
                              </div>

                              <div className="overflow-auto max-h-[280px] border rounded-md bg-white/80 dark:bg-gray-800/80">
                                <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 p-2 border-b flex items-center">
                                  <div className="flex items-center text-sm font-medium">
                                    <Wallet className="h-4 w-4 mr-2 text-blue-600" />
                                    Balance Changes History
                                  </div>
                                </div>
                                
                                {getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id
                                )
                                .filter(tx => tx.walletBalanceBefore !== undefined && tx.walletBalanceAfter !== undefined)
                                .map((transaction, index) => (
                                  <div 
                                    key={transaction.id}
                                    className={`p-3 border-b flex justify-between 
                                      ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}`
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`h-8 w-8 rounded-full flex items-center justify-center
                                        ${
                                          transaction.type === "RECHARGE"
                                            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                                            : transaction.type === "ADD_FUND"
                                              ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                                              : transaction.type === "CASHBACK"
                                                ? "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300"
                                                : transaction.type === "TRANSFER"
                                                  ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300" 
                                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                        }`}
                                      >
                                        {transaction.type === "RECHARGE" ? (
                                          <Smartphone className="h-4 w-4" />
                                        ) : transaction.type === "ADD_FUND" ? (
                                          <DollarSign className="h-4 w-4" />
                                        ) : transaction.type === "CASHBACK" ? (
                                          <Award className="h-4 w-4" />
                                        ) : transaction.type === "TRANSFER" ? (
                                          <ArrowUpDown className="h-4 w-4" />
                                        ) : (
                                          <Activity className="h-4 w-4" />
                                        )}
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">
                                          {transaction.type === "RECHARGE"
                                            ? "Recharge"
                                            : transaction.type === "ADD_FUND"
                                              ? "Wallet Credit"
                                              : transaction.type === "CASHBACK"
                                                ? "Cashback Reward"
                                                : transaction.type === "TRANSFER"
                                                  ? "Money Transfer"
                                                  : transaction.type}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {transaction.timestamp &&
                                            formatDate(transaction.timestamp)}
                                          <span className="mx-1">•</span>
                                          TRX: {transaction.transactionId}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`font-medium ${
                                        Number(transaction.walletBalanceAfter) > Number(transaction.walletBalanceBefore)
                                          ? "text-green-600"
                                          : Number(transaction.walletBalanceAfter) < Number(transaction.walletBalanceBefore)
                                            ? "text-red-600"
                                            : "text-yellow-600"
                                      }`}>
                                        {Number(transaction.walletBalanceAfter) > Number(transaction.walletBalanceBefore) ? '+' : ''}
                                        <CurrencyDisplay amount={transaction.amount} />
                                      </div>
                                      <div className="text-xs font-medium text-gray-500 mt-1">
                                        <span className="flex items-center justify-end gap-1">
                                          <Wallet className="h-3 w-3" />
                                          <CurrencyDisplay amount={transaction.walletBalanceBefore} /> → <CurrencyDisplay amount={transaction.walletBalanceAfter} />
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {getUserTransactions(
                                  userTransactions?.transactions,
                                  selectedUser?.id
                                ).filter(tx => tx.walletBalanceBefore !== undefined && tx.walletBalanceAfter !== undefined).length === 0 && (
                                  <div className="p-4 text-center text-gray-500">
                                    <p>No wallet balance tracking data available yet.</p>
                                    <p className="text-xs mt-1">Future transactions will show balance changes.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-md border-0 shadow-xl bg-gradient-to-b from-white to-gray-50">
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-100 rounded-full p-3 border-4 border-white shadow-lg">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>

          <AlertDialogHeader className="pt-6">
            <AlertDialogTitle className="text-center text-xl font-bold text-red-600 mb-2">
              Delete User Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 text-center">
                <div className="text-gray-700">
                  Are you sure you want to delete this user? This action cannot
                  be undone.
                </div>

                <div className="rounded-lg bg-gradient-to-r from-red-50 to-red-100 p-4 mt-3 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <div className="text-sm font-medium text-red-800">
                      Warning: This will permanently remove:
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm text-red-700 pl-6">
                    <div className="flex items-start gap-2">
                      <Trash2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>All account information and personal data</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <File className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Transaction history and financial records</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <UserX className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Referral connections and commission history</span>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex gap-3 pt-2">
            <AlertDialogCancel
              className="flex-1 bg-transparent border-gray-300 hover:bg-gray-100 transition-all duration-200 rounded-lg"
              onClick={() => setUserToDelete(undefined)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white transition-all duration-200 border-0 rounded-lg shadow-md"
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <div className="flex items-center">
                  <span className="animate-spin mr-2">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  Deleting...
                </div>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credit Wallet Modal */}
      <Dialog
        open={isCreditModalOpen}
        onOpenChange={(open) => {
          if (!updateUserMutation.isPending) {
            setIsCreditModalOpen(open);
            if (!open) {
              setWalletAmount("");
              setTransactionDescription("");
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Credit User's Wallet
            </DialogTitle>
            <DialogDescription>
              Add funds to {selectedUser?.name || selectedUser?.username}'s
              wallet balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Amount (₹)</div>
              <Input
                id="creditAmount"
                type="number"
                min="1"
                step="0.01"
                placeholder="Enter amount to credit"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="border-green-200 focus-visible:ring-green-500"
                disabled={updateUserMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Description</div>
              <Input
                id="creditDescription"
                type="text"
                placeholder="Reason for credit (optional)"
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                className="border-green-200 focus-visible:ring-green-500"
                disabled={updateUserMutation.isPending}
              />
            </div>
            {/* Show current balance */}
            <div className="flex items-center gap-2 text-sm">
              <div className="bg-green-100 text-green-700 px-2 py-1 rounded-md flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                <span>
                  Current balance:{" "}
                  <CurrencyTooltip amount={selectedUser?.walletBalance || 0} />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                This action will be recorded in the transaction history.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreditModalOpen(false)}
              disabled={updateUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (
                  walletAmount &&
                  !isNaN(Number(walletAmount)) &&
                  Number(walletAmount) > 0
                ) {
                  const parsedAmount = parseFloat(walletAmount);
                  // Calculate the new balance here in the client to ensure it's sent properly
                  const currentBalance = Number(
                    selectedUser?.walletBalance || 0,
                  );
                  const newBalance = currentBalance + parsedAmount;

                  // Update the selectedUser's wallet balance in state BEFORE closing the modal
                  // This ensures the UI updates instantly without waiting for server response
                  setSelectedUser((prev) => {
                    if (!prev) return prev;
                    const updatedUser = {
                      ...prev,
                      walletBalance: newBalance.toString(),
                    };

                    // Also update the user in the users list for instant feedback
                    updateUserInList({
                      id: prev.id,
                      walletBalance: newBalance.toString(),
                    });

                    return updatedUser;
                  });

                  // Close modal immediately to provide instant feedback
                  setIsCreditModalOpen(false);

                  // Then perform the mutation
                  updateUserMutation.mutate({
                    id: selectedUser?.id || 0,
                    data: {
                      walletBalance: newBalance.toString(), // Convert to string as schema expects it
                    },
                    createTransaction: true,
                    amount: parsedAmount,
                  });
                } else {
                  toast.error("Please enter a valid positive amount");
                }
              }}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Credit Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debit Wallet Modal */}
      <Dialog
        open={isDebitModalOpen}
        onOpenChange={(open) => {
          if (!updateUserMutation.isPending) {
            setIsDebitModalOpen(open);
            if (!open) {
              setWalletAmount("");
              setTransactionDescription("");
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-500" />
              Debit User's Wallet
            </DialogTitle>
            <DialogDescription>
              Withdraw funds from {selectedUser?.name || selectedUser?.username}
              's wallet balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Amount (₹)</div>
              <Input
                id="debitAmount"
                type="number"
                min="1"
                max={selectedUser ? Number(selectedUser.walletBalance) : 0}
                step="0.01"
                placeholder="Enter amount to debit"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="border-red-200 focus-visible:ring-red-500"
                disabled={updateUserMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Description</div>
              <Input
                id="debitDescription"
                type="text"
                placeholder="Reason for debit (optional)"
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                className="border-red-200 focus-visible:ring-red-500"
                disabled={updateUserMutation.isPending}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Available balance:{" "}
                  <CurrencyTooltip amount={selectedUser?.walletBalance || 0} />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                This action will be recorded in the transaction history.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDebitModalOpen(false)}
              disabled={updateUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (
                  walletAmount &&
                  !isNaN(Number(walletAmount)) &&
                  Number(walletAmount) > 0
                ) {
                  const parsedAmount = parseFloat(walletAmount);
                  if (
                    selectedUser &&
                    parsedAmount > Number(selectedUser.walletBalance)
                  ) {
                    toast.error("Insufficient balance for debit operation");
                    return;
                  }
                  // Calculate the new balance here in the client to ensure it's sent properly
                  const currentBalance = Number(
                    selectedUser?.walletBalance || 0,
                  );
                  const newBalance = currentBalance - parsedAmount;

                  // Update the selectedUser's wallet balance in state BEFORE closing the modal
                  // This ensures the UI updates instantly without waiting for server response
                  setSelectedUser((prev) => {
                    if (!prev) return prev;
                    const updatedUser = {
                      ...prev,
                      walletBalance: newBalance.toString(),
                    };

                    // Also update the user in the users list for instant feedback
                    updateUserInList({
                      id: prev.id,
                      walletBalance: newBalance.toString(),
                    });

                    return updatedUser;
                  });

                  // Close modal immediately to provide instant feedback
                  setIsDebitModalOpen(false);

                  // Then perform the mutation
                  updateUserMutation.mutate({
                    id: selectedUser?.id || 0,
                    data: {
                      walletBalance: newBalance.toString(), // Convert to string as schema expects it
                    },
                    createTransaction: true,
                    amount: -parsedAmount, // Negative amount for debit
                  });
                } else {
                  toast.error("Please enter a valid positive amount");
                }
              }}
              variant="destructive"
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Debit Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cashback Modal */}
      <Dialog open={isCashbackModalOpen} onOpenChange={setIsCashbackModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-orange-600" />
              Manage User Cashback
            </DialogTitle>
            <DialogDescription>
              Add or remove cashback from {selectedUser?.name || selectedUser?.username}'s commission.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cashback-type">Transaction Type</Label>
              <Select value={cashbackType} onValueChange={(value: "credit" | "debit") => setCashbackType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      Credit (Add Cashback)
                    </div>
                  </SelectItem>
                  <SelectItem value="debit">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-600" />
                      Debit (Remove Cashback)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashback-amount">Amount (₹)</Label>
              <Input
                id="cashback-amount"
                type="number"
                placeholder="Enter amount"
                value={cashbackAmount}
                onChange={(e) => setCashbackAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Current Commission:</span>
                <span className="font-medium">₹<CurrencyTooltip amount={selectedUser?.commission || 0} /></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Current Wallet Balance:</span>
                <span className="font-medium">₹<CurrencyTooltip amount={selectedUser?.walletBalance || 0} /></span>
              </div>
              {cashbackAmount && (
                <>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">New Commission:</span>
                      <span className={`font-medium ${cashbackType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{formatCurrency(
                          cashbackType === "credit"
                            ? (parseFloat(selectedUser?.commission?.toString() || "0") + parseFloat(cashbackAmount))
                            : Math.max(0, parseFloat(selectedUser?.commission?.toString() || "0") - parseFloat(cashbackAmount))
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">New Wallet Balance:</span>
                      <span className={`font-medium ${cashbackType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{formatCurrency(
                          cashbackType === "credit"
                            ? (parseFloat(selectedUser?.walletBalance?.toString() || "0") + parseFloat(cashbackAmount))
                            : Math.max(0, parseFloat(selectedUser?.walletBalance?.toString() || "0") - parseFloat(cashbackAmount))
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCashbackModalOpen(false);
                setCashbackAmount("");
                // Keep the user view popup open by not setting selectedUser to null
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!cashbackAmount || parseFloat(cashbackAmount) <= 0) {
                  toast.error("Please enter a valid amount");
                  return;
                }
                if (!selectedUser) {
                  toast.error("No user selected");
                  return;
                }

                cashbackMutation.mutate({
                  userId: selectedUser.id,
                  amount: parseFloat(cashbackAmount),
                  type: cashbackType,
                });
              }}
              disabled={cashbackMutation.isPending}
              className={`${
                cashbackType === "credit"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {cashbackMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {cashbackType === "credit" ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {cashbackType === "credit" ? "Credit" : "Debit"} Cashback
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
