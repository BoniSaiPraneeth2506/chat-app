import { config } from "dotenv";
import connectDB from "../lib/db.js";
import User from "../models/user.model.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../.env") });

const deleteDummyUsers = async () => {
  try {
    await connectDB();
    const result = await User.deleteMany({ email: { $regex: "@example.com$" } });
    console.log(`Deleted ${result.deletedCount} dummy users.`);
    process.exit(0);
  } catch (error) {
    console.error("Error deleting dummy users:", error);
    process.exit(1);
  }
};

deleteDummyUsers();
