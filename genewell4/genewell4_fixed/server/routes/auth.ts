import { RequestHandler } from "express";
import {
  AuthRegisterSchema,
  AuthLoginSchema,
  AuthResponse,
  User,
} from "../../shared/api";

// In-memory user store (replace with database in production)
const users = new Map<string, User & { password: string }>();

// Mock JWT token generation (replace with proper JWT in production)
const generateToken = (userId: string): string => {
  return `mock_token_${userId}_${Date.now()}`;
};

// Mock password hashing (replace with bcrypt in production)
const hashPassword = (password: string): string => {
  return `hashed_${password}`;
};

const verifyPassword = (password: string, hashedPassword: string): boolean => {
  return hashedPassword === `hashed_${password}`;
};

export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const validatedData = AuthRegisterSchema.parse(req.body);
    const { email, password, name, age, gender } = validatedData;

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(
      (user) => user.email === email,
    );

    if (existingUser) {
      const response: AuthResponse = {
        success: false,
        message: "User already exists with this email",
      };
      return res.status(400).json(response);
    }

    // Create new user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = hashPassword(password);

    const newUser: User & { password: string } = {
      id: userId,
      email,
      name,
      age,
      gender,
      createdAt: new Date().toISOString(),
      hasUploadedDNA: false,
      subscription: "free",
      password: hashedPassword,
    };

    users.set(userId, newUser);

    const token = generateToken(userId);

    // Remove password from response
    const { password: _, ...userResponse } = newUser;

    const response: AuthResponse = {
      success: true,
      user: userResponse,
      token,
      message: "Account created successfully!",
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);
    const response: AuthResponse = {
      success: false,
      message: "Invalid registration data",
    };
    res.status(400).json(response);
  }
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const validatedData = AuthLoginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user by email
    const user = Array.from(users.values()).find(
      (user) => user.email === email,
    );

    if (!user || !verifyPassword(password, user.password)) {
      const response: AuthResponse = {
        success: false,
        message: "Invalid email or password",
      };
      return res.status(401).json(response);
    }

    const token = generateToken(user.id);

    // Remove password from response
    const { password: _, ...userResponse } = user;

    const response: AuthResponse = {
      success: true,
      user: userResponse,
      token,
      message: "Login successful!",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Login error:", error);
    const response: AuthResponse = {
      success: false,
      message: "Invalid login data",
    };
    res.status(400).json(response);
  }
};

export const handleGetProfile: RequestHandler = async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: AuthResponse = {
        success: false,
        message: "No valid authorization token provided",
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7);

    // Mock token validation (replace with proper JWT verification)
    const userId = token.split("_")[2];
    const user = users.get(`user_${userId}_${token.split("_")[3]}`);

    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: "Invalid or expired token",
      };
      return res.status(401).json(response);
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    const response: AuthResponse = {
      success: true,
      user: userResponse,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Profile fetch error:", error);
    const response: AuthResponse = {
      success: false,
      message: "Failed to fetch profile",
    };
    res.status(500).json(response);
  }
};

// Export users map for use in other routes
export { users };
