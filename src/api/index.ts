// src/api/index.ts
// Unified barrel for the API layer. Import from "@api" everywhere.
//
// Example:
//   import { api, APIError, type ApiFetchOptions } from "@api";

export {
  BASE_URL,
  APIError,
  api,
  apiFetch,
  getJSON,
  postJSON,
  patchJSON,
  putJSON,
  deleteJSON,
  loginWithPassword,
  getAccessToken,
  clearSession
} from "./client";

// Re-export types explicitly so consumers can import them from "@api"
export type { ApiFetchOptions } from "./client";
