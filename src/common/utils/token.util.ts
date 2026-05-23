import * as crypto from 'crypto';

/** Generate a cryptographically secure random hex token */
export const generateSecureToken = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString('hex');

/** Token expiry helper */
export const expiresInMs = (ms: number): Date =>
  new Date(Date.now() + ms);

export const ONE_HOUR_MS   = 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const ONE_DAY_MS    = 24 * 60 * 60 * 1000;
