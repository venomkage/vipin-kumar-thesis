// lib/anonIdentity.ts
export type AnonIdentity = {
  anon_id: string;          // pseudonymous identifier (safe to show in UI)
  device_secret: string;    // local secret (never leaves device)
  created_at: string;
};

function b64url(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createAnonIdentity(): AnonIdentity {
  const anonBytes = crypto.getRandomValues(new Uint8Array(16));
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));

  return {
    anon_id: `anon_${b64url(anonBytes)}`,
    device_secret: b64url(secretBytes),
    created_at: new Date().toISOString(),
  };
}

const KEY = "anon_identity_v1";

export function saveAnonIdentity(id: AnonIdentity) {
  localStorage.setItem(KEY, JSON.stringify(id));
}

export function loadAnonIdentity(): AnonIdentity | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnonIdentity;
  } catch {
    return null;
  }
}

export function clearAnonIdentity() {
  localStorage.removeItem(KEY);
}
