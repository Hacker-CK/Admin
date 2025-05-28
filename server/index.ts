import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";
import pgSession from "connect-pg-simple";
import 'dotenv/config';
// Import session types
import './types';

// Set timezone to India/Kolkata
process.env.TZ = 'Asia/Kolkata';

// Function to validate required environment variables
function validateEnvironment() {
  const requiredVars = [
    'SESSION_SECRET', 
    'DATABASE_URL',
    'PGHOST', 
    'PGPORT', 
    'PGDATABASE', 
    'PGUSER', 
    'PGPASSWORD'
  ];
  
  // Check if recharge API credentials are required when in production
  if (process.env.NODE_ENV === 'production') {
    requiredVars.push('MYRC_API_USERNAME', 'MYRC_API_TOKEN', 'MYRC_API_URL');
  }
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    console.error('Please set these variables in your .env file or environment.');
    
    // In development, we can continue with warnings
    if (process.env.NODE_ENV === 'production') {
      console.error('Application cannot start in production without all required variables.');
      process.exit(1);
    }
  }
}

// Validate environment variables
validateEnvironment();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set appropriate headers for cookies to work in secure mode
app.use((req, res, next) => {
  // Always set CORS headers for better compatibility
  // Set the origin to the exact requesting domain (important for cookies)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || req.headers.host || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With');
  
  // Set Vary header to ensure proper caching with different origins
  res.setHeader('Vary', 'Origin');
  
  // In production with secure cookies, set additional headers
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true') {
    // Set explicit SameSite header (helps with older browsers)
    res.setHeader('SameSite', 'none');
    res.setHeader('Secure', 'true');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Configure session storage
const PostgresStore = pgSession(session);
app.use(session({
  store: new PostgresStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET as string, // Use the secret from .env (validated earlier)
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true', // Use secure cookies in production unless explicitly disabled
    // Set SameSite based on environment
    sameSite: ((process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true') 
      ? 'none'  // None is required for cross-origin with secure cookies
      : 'lax'   // Lax is the default for most browsers and good for development
    ) as 'none' | 'lax' | 'strict',
    httpOnly: true, // Always use httpOnly for security
    path: '/',      // Ensure cookies are available across the entire site
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // In production, don't expose detailed error messages
    const responseMessage = process.env.NODE_ENV === 'production' 
      ? status === 500 ? 'Internal Server Error' : message
      : message;

    res.status(status).json({ 
      message: responseMessage,
      // Only include stack trace in development
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
    
    // Don't throw the error in production, just log it
    if (process.env.NODE_ENV === 'production') {
      console.error('Error:', err);
    } else {
      throw err;
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Get port from environment variable or use 5000 as default
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
