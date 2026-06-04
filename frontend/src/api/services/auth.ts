import { apiClient } from "../client";

interface loginType {
  email: string;
  password: string;
}

interface registerType {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function login(loginData: loginType) {
  apiClient.post("/api/auth/login", {
    ...loginData,
  });
}

export function register(registerData: registerType) {
  apiClient.post("/api/auth/login", {
    ...registerData,
  });
}
