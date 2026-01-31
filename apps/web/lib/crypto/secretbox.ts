// app/lib/crypto/secretbox.ts
import sodium from "libsodium-wrappers";
import { sodiumReady } from "./sodium";

export type EncryptedPayload = {
  nonce: string;      // base64
  ciphertext: string; // base64
};

export async function encryptMessage(
  plaintext: string,
  key: Uint8Array
): Promise<EncryptedPayload> {
  await sodiumReady();

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const msgBytes = sodium.from_string(plaintext);

  const cipher = sodium.crypto_secretbox_easy(msgBytes, nonce, key);

  return {
    nonce: sodium.to_base64(nonce),
    ciphertext: sodium.to_base64(cipher),
  };
}

export async function decryptMessage(
  payload: EncryptedPayload,
  key: Uint8Array
): Promise<string> {
  await sodiumReady();

  const nonce = sodium.from_base64(payload.nonce);
  const cipher = sodium.from_base64(payload.ciphertext);

  const msg = sodium.crypto_secretbox_open_easy(cipher, nonce, key);
  if (!msg) throw new Error("DECRYPT_FAILED");

  return sodium.to_string(msg);
}
