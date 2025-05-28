import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Make a clone of the response to read the body
    const resClone = res.clone();
    
    try {
      // Try to parse the response as JSON first
      const data = await resClone.json();
      if (data && data.message) {
        throw new Error(data.message);
      } else {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    } catch (jsonError) {
      // If JSON parsing fails, use text/statusText as fallback
      const text = await res.text() || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Default to include credentials
    ...options, // Allow overriding defaults with custom options
  });

  await throwIfResNotOk(res);
  // For successful responses, parse and return the JSON data
  const responseData = await res.json();
  return responseData;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    try {
      return await res.json();
    } catch (error) {
      console.error("Failed to parse response as JSON", error);
      return {}; // Return empty object if JSON parsing fails
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
