// app/lib/anonVault.ts
// Fully local identity vault:
// - Register: generate identity + recovery code, encrypt identity with code, store encrypted blob.
// - Login: user enters recovery code, decrypt identity, keep it in sessionStorage (unlocked session).
// - Logout: clears only sessionStorage (locks). Optionally "forget" deletes encrypted blob too.

import type { AnonIdentity } from "@/lib/anonIdentity";
import { createAnonIdentity } from "@/lib/anonIdentity";

const VAULT_KEY = "anon_vault_v1";         // persistent encrypted blob
const SESSION_KEY = "anon_session_v1";     // unlocked identity for this tab/session

type VaultPayload = {
  v: 1;
  salt_b64: string;
  iv_b64: string;
  ct_b64: string;
};

function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

// Human-friendly recovery code (local secret the user keeps)
export function generateRecoveryCode() {
  // simple word-ish + short suffix; still only used locally as a passphrase
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  const chunk = (n: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(bytes).map(b => alphabet[b % alphabet.length]).join("");
  };
  return `${chunk(5)}-${chunk(5)}-${chunk(4)}`; // e.g., 7QK9M-2HF8Z-W3P7
}

async function deriveAesKeyFromCode(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const passphrase = new TextEncoder().encode(normalizeCode(code));
  const baseKey = await crypto.subtle.importKey("raw", passphrase, "PBKDF2", false, ["deriveBits"]);

  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength);

  // Derive 256 bits (32 bytes)
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf as BufferSource, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    256
  );

  // Import those bits as an AES-GCM key
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
}



async function encryptIdentity(code: string, identity: AnonIdentity): Promise<VaultPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyFromCode(code, salt);

  const pt = new TextEncoder().encode(JSON.stringify(identity));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);

  return {
    v: 1,
    salt_b64: bytesToB64(salt),
    iv_b64: bytesToB64(iv),
    ct_b64: bytesToB64(new Uint8Array(ct)),
  };
}

async function decryptIdentity(code: string, payload: VaultPayload): Promise<AnonIdentity> {
  const salt = b64ToBytes(payload.salt_b64);
  const iv = b64ToBytes(payload.iv_b64);
  const ct = b64ToBytes(payload.ct_b64);

  const key = await deriveAesKeyFromCode(code, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);

  const json = new TextDecoder().decode(new Uint8Array(pt));
  return JSON.parse(json) as AnonIdentity;
}

// --- Public API ---

export function hasVault(): boolean {
  return !!localStorage.getItem(VAULT_KEY);
}

export function loadSessionIdentity(): AnonIdentity | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnonIdentity;
  } catch {
    return null;
  }
}

function saveSessionIdentity(identity: AnonIdentity) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
}

export function lockSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function forgetVault() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(VAULT_KEY);
}

// Register = create identity + code + store encrypted vault + unlock session
export async function registerNewAnonymous(): Promise<{ identity: AnonIdentity; recoveryCode: string }> {
  const identity = createAnonIdentity();
  const recoveryCode = generateRecoveryCode();
  const payload = await encryptIdentity(recoveryCode, identity);

  localStorage.setItem(VAULT_KEY, JSON.stringify(payload));
  saveSessionIdentity(identity);

  return { identity, recoveryCode };
}

// Login = unlock vault with code, save unlocked session
export async function loginWithRecoveryCode(code: string): Promise<AnonIdentity> {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error("NO_VAULT");
  const payload = JSON.parse(raw) as VaultPayload;

  if (!payload?.v || payload.v !== 1) throw new Error("BAD_VAULT");
  const identity = await decryptIdentity(code, payload);

  saveSessionIdentity(identity);
  return identity;
}
