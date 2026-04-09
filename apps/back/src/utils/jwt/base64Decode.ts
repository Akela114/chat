export function base64UrlDecode(stringToDecode: string) {
  stringToDecode = stringToDecode.replace(/-/g, '+').replace(/_/g, '/');
  while (stringToDecode.length % 4) {
    stringToDecode += '=';
  }
  return Buffer.from(stringToDecode, 'base64').toString('utf8');
}