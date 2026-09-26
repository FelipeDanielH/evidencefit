export interface JwtPayload {
  email: string;
  sub: string;
}

export interface AuthenticatedUser {
  email: string;
  userId: string;
}

export interface PublicUser {
  createdAt: string;
  email: string;
  id: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
