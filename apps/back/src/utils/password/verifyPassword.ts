import { scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'


export async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, keyHex] = storedHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');

  const derivedKey = await promisify(scrypt)(password, salt, 64);

  return timingSafeEqual((derivedKey as NonSharedBuffer), key);
}