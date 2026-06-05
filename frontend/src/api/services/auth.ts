import { apiClient } from "../client";

export interface loginType {
  email: string;
  password: string;
}

export interface registerType {
  name: string;
  email: string;
  password: string;
  role: string;
}

// Login function to call the backend API for user authentication
export async function login({ email, password }: loginType) {
  try {
    const res = await apiClient.post("/api/auth/login", {
      email,
      password,
    });
    return res;
  } catch (error) {
    console.error("Login failed:", error);
    throw new Error("Login failed", { cause: error });
  }
}

// Registration function to call the backend API for user registration
export async function register(registerData: registerType) {
  try {
    const res = await apiClient.post("/api/auth/register", {
      ...registerData,
    });
    return res;
  } catch (error) {
    console.error("Registration failed:", error);
    throw new Error("Registration failed", { cause: error });
  }
}

// GET /api/auth/me
// GET /api/users/me
// GET /api/users (admin only)

// get auth user info from backend

export async function getUser() {
  try {
    const res = await apiClient.get("/api/auth/me");
    return res;
  } catch (error) {
    console.error("Fetching user info failed:", error);
    throw new Error("Fetching user info failed", { cause: error });
  }
}

// get auth user info from backend (alternative endpoint for testing)
export async function getUserData() {
  try {
    const res = await apiClient.get("/api/users/me");
    return res;
  } catch (error) {
    console.error("Fetching user info failed:", error);
    throw new Error("Fetching user info failed", { cause: error });
  }
}

// Get all users (admin only)
export async function getAllUsers() {
  try {
    const res = await apiClient.get("/api/users");
    return res;
  } catch (error) {
    console.error("Fetching all users failed:", error);
    throw new Error("Fetching all users failed", { cause: error });
  }
}
