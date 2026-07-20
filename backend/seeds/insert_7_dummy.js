import { config } from "dotenv";
import connectDB from "../lib/db.js";
import User from "../models/user.model.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../.env") });

const dummyUsers = [
  {
    email: "emma.thompson@example.com",
    fullName: "Emma Thompson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    email: "olivia.miller@example.com",
    fullName: "Olivia Miller",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  {
    email: "sophia.davis@example.com",
    fullName: "Sophia Davis",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/3.jpg",
  }
];

const insertDummyUsers = async () => {
  try {
    await connectDB();
    
    // Clean up all example.com dummy users
    await User.deleteMany({ email: { $regex: "@example.com$" } });
    
    await User.insertMany(dummyUsers);
    console.log("Successfully inserted 3 dummy users.");
    process.exit(0);
  } catch (error) {
    console.error("Error inserting dummy users:", error);
    process.exit(1);
  }
};

insertDummyUsers();
