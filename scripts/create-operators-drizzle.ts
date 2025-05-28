import { db } from "../server/db.js";
import { operators } from "../shared/schema.js";

// Create mobile and DTH operators
async function createOperators() {
  try {
    // Check if operators already exist
    const existingOperators = await db.select().from(operators);
    
    if (existingOperators.length > 0) {
      console.log(`${existingOperators.length} operators already exist.`);
      process.exit(0);
      return;
    }
    
    // Create mobile operators
    const mobileOperators = [
      {
        name: "Airtel",
        code: "AIRTEL",
        type: "MOBILE",
        commission: "1.5",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Airtel_logo.svg/1200px-Airtel_logo.svg.png"
      },
      {
        name: "Jio",
        code: "JIO",
        type: "MOBILE", 
        commission: "1.2",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Reliance_Jio_logo.svg/2048px-Reliance_Jio_logo.svg.png"
      },
      {
        name: "Vodafone Idea",
        code: "VI",
        type: "MOBILE",
        commission: "1.3",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Vodafone_Idea_Logo.svg/1200px-Vodafone_Idea_Logo.svg.png"
      }
    ];
    
    // Create DTH operators
    const dthOperators = [
      {
        name: "Dish TV",
        code: "DISHTV",
        type: "DTH",
        commission: "2.0",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dish_TV_Logo.svg/1200px-Dish_TV_Logo.svg.png"
      },
      {
        name: "Tata Play",
        code: "TATAPLAY",
        type: "DTH",
        commission: "1.8",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Tata_Play.svg/2560px-Tata_Play.svg.png"
      },
      {
        name: "Airtel Digital TV",
        code: "AIRTELDTH",
        type: "DTH",
        commission: "1.7",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Airtel_logo.svg/1200px-Airtel_logo.svg.png"
      }
    ];
    
    // Create all operators
    const allOperators = [...mobileOperators, ...dthOperators];
    const createdOperators = [];
    
    // Insert operators one by one to handle any errors individually
    for (const operator of allOperators) {
      try {
        // Insert the operator data
        const result = await db.insert(operators).values({
          name: operator.name,
          code: operator.code,
          type: operator.type,
          commission: operator.commission,
          isEnabled: true,
          logo: operator.logo
        }).returning();
        
        if (result.length > 0) {
          createdOperators.push(result[0]);
          console.log(`Created operator: ${result[0].name} (${result[0].type})`);
        }
      } catch (error) {
        console.error(`Error creating operator ${operator.name}:`, error);
      }
    }
    
    console.log(`Successfully created ${createdOperators.length} operators`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating operators:", error);
    process.exit(1);
  }
}

// Run the function
createOperators();