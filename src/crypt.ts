import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const NONCE_LENGTH = 12;
const AUTHTAG_LENGTH = 16;
const CIPHER_HEAD_LENGTH = NONCE_LENGTH + AUTHTAG_LENGTH;

export function encrypt_symetric(
  key: string,
  data: string,
  nonce = randomBytes(NONCE_LENGTH),
): string {
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, ciphertext]).toString("base64");
}

export function decrypt_symetric(key: string, data: string): string {
  const buffer = Buffer.from(data, "base64");
  if (buffer.length <= CIPHER_HEAD_LENGTH)
    throw new Error("Authentication failed!");

  const nonce = buffer.subarray(0, NONCE_LENGTH);
  const tag = buffer.subarray(NONCE_LENGTH, CIPHER_HEAD_LENGTH);
  const ciphertext = buffer.subarray(CIPHER_HEAD_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key), nonce);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Authentication failed!");
  }
}
