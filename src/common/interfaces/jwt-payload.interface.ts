export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string;
}

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isActive: boolean;
  isEmailVerified: boolean;
  preferredLanguage: string;
  avatar: string | null;
  bio: string | null;
  lastSeen: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
