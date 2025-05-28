import { pgStorage } from "../server/pgStorage.js";

// Create an admin user
async function createAdminUser() {
  try {
    // Create a user with admin privileges
    const adminUser = await pgStorage.createUser({
      username: "admin",
      password: "admin123", // In production, this would be hashed
      name: "Admin User",
      email: "admin@example.com",
      walletBalance: "10000", // Starting with more balance for testing
      isAdmin: true // This is an admin user
    });

    console.log("Admin user created successfully:", adminUser);
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();