// app/lib/crypto/sodium.ts
import sodium from "libsodium-wrappers";

let ready: Promise<void> | null = null;

export function sodiumReady(): Promise<void> {
  if (!ready) {
    ready = sodium.ready;
  }
  return ready;
}

export function randomKey(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
}
