import { randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'


export async function hashPassword(password: string) {
  const salt = randomBytes(32);
  const key = await promisify(scrypt)(password, salt, 64);

  const hashedPassword = `${salt.toString('hex')}:${(key as NonSharedBuffer).toString('hex')}`;

  return hashedPassword;
}