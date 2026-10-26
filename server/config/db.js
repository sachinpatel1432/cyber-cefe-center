
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri =
      process.env.NODE_ENV === "production"
        ? process.env.MONGO_URI
        : process.env.MONGO_URI_LOCAL;

    if (!uri) {
      throw new Error("MongoDB URI is missing in .env");
    }

    const conn = await mongoose.connect(uri);

    console.log(
      `MongoDB Connected Successfully: ${conn.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    throw error;
  }
};

export default connectDB;
