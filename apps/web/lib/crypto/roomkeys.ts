// app/lib/crypto/roomKeys.ts
import sodium from "libsodium-wrappers";
import { sodiumReady } from "./sodium";

/**
 * Deterministically derive a per-room symmetric key from the roomId.
 * Security depends on roomId being a high-entropy shared secret.
 */
export async function deriveRoomKey(roomId: string): Promise<Uint8Array> {
  await sodiumReady();

  const msg = sodium.from_string(roomId);
  // 32-byte key for crypto_secretbox
  const key = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    msg,
    null
  );

  return key; // Uint8Array length 32
}
