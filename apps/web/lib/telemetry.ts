// apps/web/app/lib/telemetry.ts

export type TelemetryEvent =
  | {
      type: "msg_send";
      msg_id: string;
      v: number;
      room_id: string;
      sender_id: string;
      ts_client_send: number;
      t_encrypt_ms: number;
      bytes_ciphertext: number;
      auto_translate: boolean;
      target_lang: string;
    }
  | {
      type: "msg_recv";
      msg_id: string;
      v: number;
      room_id: string;
      sender_id: string;
      ts_client_recv: number;
      ts_sender: number;
      t_decrypt_ms: number;
      ok_decrypt: boolean;
      auto_translate: boolean;
      target_lang: string;
    }
  | {
      type: "translate";
      msg_id: string;
      v: number;
      room_id: string;
      ts_translate_start: number;
      t_translate_ms: number;
      ok_translate: boolean;
      target_lang: string;
    }
  | {
      type: "session";
      ts: number;
      note: string;
      data?: Record<string, unknown>;
    };

export type TelemetryStore = {
  push: (e: TelemetryEvent) => void;
  all: () => TelemetryEvent[];
  clear: () => void;
  syncFromSession: () => void;
};

const STORAGE_KEY = "telemetry_events_v1";

function safeParse(json: string): TelemetryEvent[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function saveToSession(events: TelemetryEvent[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore (storage may be blocked)
  }
}

function loadFromSession(): TelemetryEvent[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return safeParse(raw);
  } catch {
    return [];
  }
}

let singleton: TelemetryStore | null = null;

export function getTelemetryStore(maxEvents: number = 2000): TelemetryStore {
  if (singleton) return singleton;

  const events: TelemetryEvent[] = [];

  const store: TelemetryStore = {
    push(e) {
      events.push(e);
      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }
      // persist after each push
      saveToSession(events);
    },
    all() {
      return [...events];
    },
    clear() {
      events.length = 0;
      saveToSession(events);
    },
    syncFromSession() {
      const loaded = loadFromSession();
      events.length = 0;
      events.push(...loaded.slice(-maxEvents));
    },
  };

  // initialize from sessionStorage on first access (client-side only)
  if (typeof window !== "undefined") {
    store.syncFromSession();
  }

  singleton = store;
  return store;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}