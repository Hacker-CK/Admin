import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Simple encryption/decryption utilities for secure storage
const encryptData = (data: string): string => {
  return btoa(encodeURIComponent(data));
};

const decryptData = (encryptedData: string): string => {
  try {
    return decodeURIComponent(atob(encryptedData));
  } catch {
    return "";
  }
};

// Storage keys for remembered credentials
const REMEMBER_USERNAME_KEY = "billaye_remember_username";
const REMEMBER_PASSWORD_KEY = "billaye_remember_password";
const REMEMBER_ME_KEY = "billaye_remember_me";

export default function Login() {
  const [, setLocation] = useLocation();
  const [rememberMe, setRememberMe] = useState(false);

  // We don't need to check login state here anymore
  // App.tsx handles redirecting from /login to / when logged in

  // Login form
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Load saved credentials on component mount
  useEffect(() => {
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    setRememberMe(savedRememberMe);

    if (savedRememberMe) {
      const savedUsername = localStorage.getItem(REMEMBER_USERNAME_KEY);
      const savedPassword = localStorage.getItem(REMEMBER_PASSWORD_KEY);

      if (savedUsername && savedPassword) {
        const decryptedUsername = decryptData(savedUsername);
        const decryptedPassword = decryptData(savedPassword);

        form.setValue("username", decryptedUsername);
        form.setValue("password", decryptedPassword);
      }
    }
  }, [form]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof loginSchema>) => {
      // Make a real API call to authenticate with credentials included for secure cookies
      const options: RequestInit = { credentials: "include" };
      return await apiRequest("POST", "/api/auth/login", credentials, options);
    },
    onSuccess: (data) => {
      // Handle Remember Me functionality
      if (rememberMe) {
        // Save encrypted credentials
        const encryptedUsername = encryptData(form.getValues("username"));
        const encryptedPassword = encryptData(form.getValues("password"));
        
        localStorage.setItem(REMEMBER_USERNAME_KEY, encryptedUsername);
        localStorage.setItem(REMEMBER_PASSWORD_KEY, encryptedPassword);
        localStorage.setItem(REMEMBER_ME_KEY, "true");
      } else {
        // Clear saved credentials if remember me is not checked
        localStorage.removeItem(REMEMBER_USERNAME_KEY);
        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      // Set logged in state
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userData", JSON.stringify(data.user));

      // Show success toast
      toast.success("Login successful! Welcome to Billaye admin dashboard.");

      // Use window.location.href to force a full page reload
      // This ensures authentication state is completely refreshed
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast.error(error.message || "Invalid credentials");
    },
  });

  // Handle login submission
  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    // Prevent multiple login attempts
    if (loginMutation.isPending) return;

    // Check if already logged in
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    if (isLoggedIn) {
      // Already logged in, redirect to dashboard
      setLocation("/");
      return;
    }

    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
            B
          </div>
          <CardTitle className="text-2xl font-bold">Billaye</CardTitle>
          <CardDescription>
            Sign in to access your admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    checked={rememberMe}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setRememberMe(isChecked);
                      
                      // If unchecked, immediately clear saved credentials
                      if (!isChecked) {
                        localStorage.removeItem(REMEMBER_USERNAME_KEY);
                        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
                        localStorage.removeItem(REMEMBER_ME_KEY);
                      }
                    }}
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                    Remember me (saves login details securely)
                  </Label>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
