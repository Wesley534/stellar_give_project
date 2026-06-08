import apiClient from "../client";

export type Role = "INVESTOR" | "BORROWER" | "CUSTOMER" | "ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthEnvelope {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
    token: string;
  };
}

export interface CurrentUserEnvelope {
  success: boolean;
  message: string;
  data: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Exclude<Role, "ADMIN">;
}

export type loginType = LoginInput;
export type registerType = RegisterInput;

export async function login(input: LoginInput) {
  return apiClient.post<AuthEnvelope>("/auth/login", input);
}

export async function register(input: RegisterInput) {
  return apiClient.post<AuthEnvelope>("/auth/register", input);
}

export async function getCurrentUserData() {
  return apiClient.get<CurrentUserEnvelope>("/auth/me");
}

export interface UserListEnvelope {
  success: boolean;
  message: string;
  data: AuthUser[];
}

export async function getAllUsers(role?: Role) {
  const params = role ? `?role=${encodeURIComponent(role)}` : "";
  const response = await apiClient.get<UserListEnvelope>(`/users${params}`);
  return response.data;
}
