import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";

import DashboardLayout from "@/layouts/dashboard-layout";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Transactions from "@/pages/transactions";
import Operators from "@/pages/operators";
import Notifications from "@/pages/notifications";
import Referrals from "@/pages/referrals";
import Settings from "@/pages/settings";

import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

// Custom hook for authentication
function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  
  useEffect(() => {
    async function checkAuthStatus() {
      try {
        // First check local storage for a quick UI response
        const isLoggedInLocally = localStorage.getItem("isLoggedIn") === "true";
        const storedUserData = localStorage.getItem("userData");
        
        if (isLoggedInLocally && storedUserData) {
          // Show locally stored user data immediately for better UX
          try {
            const parsedUserData = JSON.parse(storedUserData);
            setUserData(parsedUserData);
            setIsAuthenticated(true);
          } catch (e) {
            console.error("Error parsing stored user data:", e);
            localStorage.removeItem("userData");
          }
          
          // Then verify with the server (with retries for production mode)
          let retries = 3;
          let success = false;
          
          while (retries > 0 && !success) {
            try {
              const response = await fetch('/api/auth/session', {
                method: 'GET', 
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache'
                },
                credentials: 'include' // This is crucial for secure cookies
              });
              
              if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.isAuthenticated) {
                // Server confirms authentication
                setIsAuthenticated(true);
                setUserData(data.user);
                setAuthError(null);
                // Ensure localStorage is in sync
                localStorage.setItem("isLoggedIn", "true");
                localStorage.setItem("userData", JSON.stringify(data.user));
                success = true;
              } else {
                // Server says not authenticated
                console.warn("Server reports user not authenticated despite local storage");
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("userData");
                setIsAuthenticated(false);
                setUserData(null);
                setAuthError("Session expired or invalid");
                
                // Log full response for debugging
                console.log("Session check response:", data);
              }
              
              break; // Exit the retry loop on successful response
            } catch (error) {
              console.error(`Authentication check failed (attempt ${4-retries}/3):`, error);
              retries--;
              
              if (retries === 0) {
                // On all retries failed, keep the local authentication if we're in production
                // This provides offline capability and prevents logout on temporary server issues
                if (process.env.NODE_ENV === 'production' && isLoggedInLocally) {
                  console.warn("Using cached authentication due to server connectivity issues");
                  setAuthError("Using cached session data - server connection issue");
                } else {
                  // In development, clear auth on failures
                  localStorage.removeItem("isLoggedIn");
                  localStorage.removeItem("userData");
                  setIsAuthenticated(false);
                  setUserData(null);
                  setAuthError("Could not verify session with server");
                }
              }
              
              // Wait before retry
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        } else {
          // Not logged in according to localStorage
          setIsAuthenticated(false);
          setUserData(null);
        }
      } catch (error) {
        console.error("Error in authentication process:", error);
        // On error, assume not authenticated for security
        setIsAuthenticated(false);
        setUserData(null);
        setAuthError("Authentication error occurred");
      } finally {
        setCheckingAuth(false);
      }
    }
    
    checkAuthStatus();
  }, []);
  
  return { isAuthenticated, checkingAuth, userData };
}

function Router() {
  const [location, setLocation] = useState(window.location.pathname);
  const { isAuthenticated, checkingAuth } = useAuth();
  
  // Listen for location changes
  useEffect(() => {
    const handleLocationChange = () => {
      setLocation(window.location.pathname);
    };
    
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);
  
  // Don't render until we've checked auth
  if (checkingAuth) {
    return null;
  }
  
  // Not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }
  
  // User is authenticated
  return (
    <Switch>
      <Route path="/login">
        {/* If user is already logged in and tries to access login page, redirect to dashboard */}
        <Redirect to="/" />
      </Route>
      <Route path="/">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/users">
        <DashboardLayout>
          <Users />
        </DashboardLayout>
      </Route>
      <Route path="/transactions">
        <DashboardLayout>
          <Transactions />
        </DashboardLayout>
      </Route>
      <Route path="/operators">
        <DashboardLayout>
          <Operators />
        </DashboardLayout>
      </Route>
      <Route path="/notifications">
        <DashboardLayout>
          <Notifications />
        </DashboardLayout>
      </Route>
      <Route path="/referrals">
        <DashboardLayout>
          <Referrals />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {mounted ? <Router /> : null}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#FFFFFF',
            color: '#333333',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E2E8F0',
          },
          success: {
            style: {
              background: '#FFFFFF',
              borderLeft: '4px solid #10B981',
            },
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFFFF',
            },
          },
          error: {
            style: {
              background: '#FFFFFF',
              borderLeft: '4px solid #EF4444',
            },
            iconTheme: {
              primary: '#EF4444',
              secondary: '#FFFFFF',
            },
            duration: 4000,
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;