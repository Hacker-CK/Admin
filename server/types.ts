import { Session } from 'express-session';

// Extend the Express Session type to include our custom properties
declare module 'express-session' {
  interface Session {
    user?: {
      id: number;
      username: string;
      isAdmin: boolean;
      name?: string;
    };
    isAuthenticated?: boolean;
  }
}