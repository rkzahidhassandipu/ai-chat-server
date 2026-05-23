import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (plain: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(plain, hashed);
