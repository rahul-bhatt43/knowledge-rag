// src/types/dtos.ts
import {
  UserRole,
  EntityStatus,
} from "./common.types";

// ============ AUTH DTOs ============
export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

// ============ USER DTOs ============
export interface UserDTO {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: EntityStatus;
  createdAt: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: EntityStatus;
}