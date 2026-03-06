// src/types/dtos.ts
import {
  UserRole,
  EntityStatus,
  DocumentStatus,
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

// ============ DOCUMENT DTOs ============
export interface UploadResponseDTO {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: DocumentStatus;
}

export interface DocumentDTO {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedBy: UserDTO;
  chunkCount: number;
  pageCount?: number;
  description?: string;
  tags?: string[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunkDTO {
  _id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  vectorId: string;
  pageNumber?: number;
}

// ============ CHAT DTOs ============
export interface ChatSourceDTO {
  documentId: string;
  fileName: string;
  chunkText: string;
  chunkIndex?: number;
}

export interface ChatMessageDTO {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSourceDTO[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: Date;
}

export interface ChatSessionDTO {
  _id: string;
  userId: string;
  title: string;
  messages: ChatMessageDTO[];
  totalTokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
}