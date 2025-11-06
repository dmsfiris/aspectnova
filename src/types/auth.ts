// src/types/auth.ts
export type User = {
  id: string;
  email: string;
  name?: string | null;
  roles?: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
