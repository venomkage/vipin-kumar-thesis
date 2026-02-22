"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

import { loadSessionIdentity } from "@/lib/anonVault";
import { encryptMessage, decryptMessage, type EncryptedPayload } from "@/lib/crypto/secretbox";
import { deriveRoomKey } from "@/lib/crypto/roomkeys";
import { translateText, checkTranslateService } from "@/lib/translate";
import { getTelemetryStore } from "@/lib/telemetry";


type UiMessage = {
    id: string;
    sender_id: string;
    ts: number;

    original: string; // decrypted plaintext
    translated?: string;
    view: "original" | "translated";

    // Demo only
    ciphertext?: string;

    translating?: boolean;
    translateError?: string;
};

type WireMessage = {
    v: 1;
    msg_id: string;
    room_id: string;
    sender_id: string;
    ts: number; // sender timestamp
} & EncryptedPayload;


function makeId() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ChatPage() {
    const router = useRouter();
    const identity = useMemo(() => loadSessionIdentity(), []);

    const [roomId, setRoomId] = useState<string>("");
    const [draft, setDraft] = useState("");
    const [messages, setMessages] = useState<UiMessage[]>([]);
    const [joined, setJoined] = useState(false);
    const [status, setStatus] = useState<"disconnected" | "connected">("disconnected");
    const [cryptoReady, setCryptoReady] = useState(false);

    // Translation controls
    const [autoTranslate, setAutoTranslate] = useState(false);
    const [targetLang, setTargetLang] = useState<"en" | "de">("en");

    // Translation service status
    const [translateOnline, setTranslateOnline] = useState<boolean | null>(null);

    // Cache: (targetLang::originalText) -> translatedText
    const translateCacheRef = useRef<Map<string, string>>(new Map());
    const telemetryRef = useRef(getTelemetryStore(2000));


    // Keep latest settings visible inside socket callbacks without re-registering handlers
    const autoTranslateRef = useRef(autoTranslate);
    const targetLangRef = useRef(targetLang);
    useEffect(() => {
        autoTranslateRef.current = autoTranslate;
    }, [autoTranslate]);
    useEffect(() => {
        targetLangRef.current = targetLang;
    }, [targetLang]);

    const socketRef = useRef<Socket | null>(null);
    const activeRoomRef = useRef<string>("");
    const roomKeyRef = useRef<Uint8Array | null>(null);

    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!identity) router.replace("/login");
    }, [identity, router]);

    useEffect(() => {
        // sensible default for target language
        const b = (navigator.language || "en").slice(0, 2);
        if (b === "en" || b === "de") setTargetLang(b);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // (1) Translation service health check
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const ok = await checkTranslateService();
            if (cancelled) return;
            setTranslateOnline(ok);

            // If offline, force auto-translate OFF to avoid noisy failures
            if (!ok) setAutoTranslate(false);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        telemetryRef.current.push({
            type: "session",
            ts: Date.now(),
            note: "session_start",
        });
    }, []);


    // Helper: cached translation
    const getOrTranslate = async (text: string, target: "en" | "de") => {
        const key = `${target}::${text}`;
        const cached = translateCacheRef.current.get(key);
        if (cached) return cached;

        const t = await translateText(text, target, "auto");
        translateCacheRef.current.set(key, t);
        return t;
    };

    // Connect socket once per mount
    useEffect(() => {
        if (!identity) return;

        const url = process.env.NEXT_PUBLIC_REALTIME_URL;
        if (!url) {
            console.error("NEXT_PUBLIC_REALTIME_URL is missing. Set it in .env.local");
            return;
        }

        const socket = io(url, { transports: ["websocket"], withCredentials: true });
        socketRef.current = socket;

        socket.on("connect", () => setStatus("connected"));

        socket.on("disconnect", () => {
            setStatus("disconnected");
            setJoined(false);
            activeRoomRef.current = "";
            roomKeyRef.current = null;
            setCryptoReady(false);
        });

        socket.on("joined_room", ({ room_id }: { room_id: string }) => {
            activeRoomRef.current = room_id;
            setJoined(true);
            setMessages([]); // clear on join
        });

        socket.on("left_room", ({ room_id }: { room_id: string }) => {
            if (activeRoomRef.current === room_id) {
                activeRoomRef.current = "";
                roomKeyRef.current = null;
                setJoined(false);
                setCryptoReady(false);
            }
        });

        socket.on("message", async (msg: WireMessage) => {
            // Only accept for active room
            if (!msg?.room_id || msg.room_id !== activeRoomRef.current) return;

            const key = roomKeyRef.current;
            if (!key) return;

            const recvNow = Date.now();

            // ---- Decrypt timing + telemetry ----
            const d0 = performance.now();
            let plaintext = "";
            let okDecrypt = false;

            try {
                plaintext = await decryptMessage({ nonce: msg.nonce, ciphertext: msg.ciphertext }, key);
                okDecrypt = true;
            } catch {
                okDecrypt = false;
            } finally {
                const d1 = performance.now();

                telemetryRef.current.push({
                    type: "msg_recv",
                    msg_id: msg.msg_id ?? "missing",
                    v: (msg.v ?? 1) as number,
                    room_id: msg.room_id,
                    sender_id: msg.sender_id,
                    ts_client_recv: recvNow,
                    ts_sender: msg.ts,
                    t_decrypt_ms: Math.max(0, d1 - d0),
                    ok_decrypt: okDecrypt,
                    auto_translate: autoTranslateRef.current,
                    target_lang: targetLangRef.current,
                });
            }

            // If decrypt failed, still show message placeholder (helps demos/debug)
            if (!okDecrypt) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: makeId(),
                        sender_id: msg.sender_id,
                        ts: msg.ts,
                        original: "[decrypt failed]",
                        view: "original",
                        ciphertext: msg.ciphertext, // demo
                    },
                ]);
                return;
            }

            // Build UI message
            const ui: UiMessage = {
                id: makeId(),
                sender_id: msg.sender_id,
                ts: msg.ts,
                original: plaintext,
                view: "original",
                ciphertext: msg.ciphertext, // demo
            };

            const shouldAutoTranslate = autoTranslateRef.current && !!translateOnline;
            if (shouldAutoTranslate) {
                const trStart = Date.now();
                const tr0 = performance.now();

                try {
                    const t = await getOrTranslate(plaintext, targetLangRef.current);
                    const tr1 = performance.now();

                    telemetryRef.current.push({
                        type: "translate",
                        msg_id: msg.msg_id ?? "missing",
                        v: (msg.v ?? 1) as number,
                        room_id: msg.room_id,
                        ts_translate_start: trStart,
                        t_translate_ms: Math.max(0, tr1 - tr0),
                        ok_translate: true,
                        target_lang: targetLangRef.current,
                    });

                    ui.translated = t;
                    ui.view = "translated";
                } catch {
                    const tr1 = performance.now();

                    telemetryRef.current.push({
                        type: "translate",
                        msg_id: msg.msg_id ?? "missing",
                        v: (msg.v ?? 1) as number,
                        room_id: msg.room_id,
                        ts_translate_start: trStart,
                        t_translate_ms: Math.max(0, tr1 - tr0),
                        ok_translate: false,
                        target_lang: targetLangRef.current,
                    });

                    ui.translateError = "translate failed";
                    ui.view = "original";
                }
            }

            // Push UI message
            setMessages((prev) => [...prev, ui]);
        });


        return () => {
            socket.disconnect();
            socketRef.current = null;
            activeRoomRef.current = "";
            roomKeyRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identity, translateOnline]);

    if (!identity) return null;

    const normalizedRoomId = roomId.trim();

    const onJoin = async () => {
        if (!normalizedRoomId) return;
        if (status !== "connected") return;

        const key = await deriveRoomKey(normalizedRoomId);
        roomKeyRef.current = key;
        setCryptoReady(true);

        if (activeRoomRef.current && activeRoomRef.current !== normalizedRoomId) {
            socketRef.current?.emit("leave_room", { room_id: activeRoomRef.current });
            activeRoomRef.current = "";
            setJoined(false);
        }

        socketRef.current?.emit("join_room", { room_id: normalizedRoomId });
    };

    const onLeave = () => {
        if (!activeRoomRef.current) return;
        socketRef.current?.emit("leave_room", { room_id: activeRoomRef.current });
    };

    const onSend = async () => {
        const text = draft.trim();
        if (!text) return;
        if (!joined || !activeRoomRef.current) return;

        const key = roomKeyRef.current;
        if (!key) return;

        const msg_id = makeId();
        const t0 = performance.now();
        const payload = await encryptMessage(text, key);
        const t1 = performance.now();

        const bytes_ciphertext = payload.ciphertext.length; // base64 length (good enough proxy)

        const msg: WireMessage = {
            v: 1,
            msg_id,
            room_id: activeRoomRef.current,
            sender_id: identity.anon_id,
            ts: Date.now(),
            nonce: payload.nonce,
            ciphertext: payload.ciphertext,
        };

        telemetryRef.current.push({
            type: "msg_send",
            v: 1,
            msg_id,
            room_id: msg.room_id,
            sender_id: msg.sender_id,
            ts_client_send: Date.now(),
            t_encrypt_ms: Math.max(0, t1 - t0),
            bytes_ciphertext,
            auto_translate: autoTranslateRef.current,
            target_lang: targetLangRef.current,
        });


        socketRef.current?.emit("send_message", msg);
        setDraft("");
    };

    const onClear = () => setMessages([]);

    const toggleMessageView = async (id: string) => {
        const current = messages.find((m) => m.id === id);
        if (!current) return;

        if (current.view === "translated") {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, view: "original" } : m)));
            return;
        }

        // original -> translated
        if (!translateOnline) {
            setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, translateError: "translation service offline" } : m))
            );
            return;
        }

        if (current.translated) {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, view: "translated" } : m)));
            return;
        }

        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, translating: true, translateError: undefined } : m)));

        try {
            const t = await getOrTranslate(current.original, targetLang);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === id ? { ...m, translated: t, view: "translated", translating: false } : m
                )
            );
        } catch {
            setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, translating: false, translateError: "translate failed" } : m))
            );
        }
    };

    const roomDisplay = joined ? activeRoomRef.current : "-";

    return (
        <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
            {/* Translation status banner */}
            {translateOnline === false && (
                <div
                    style={{
                        marginBottom: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "rgba(255, 0, 0, 0.06)",
                        fontSize: 13,
                    }}
                >
                    Translation service is offline. Start LibreTranslate (e.g. <code>libretranslate --port 5000</code>) to enable
                    translations.
                </div>
            )}

            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Chat (E2EE + Translation)</h1>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        You: <code>{identity.anon_id}</code>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Status: <code>{status}</code> • Room: <code>{roomDisplay}</code> • Crypto:{" "}
                        <code>{cryptoReady ? "ready" : "not-ready"}</code> • Translate:{" "}
                        <code>{translateOnline === null ? "checking" : translateOnline ? "online" : "offline"}</code>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <label style={{ fontSize: 12, opacity: 0.85, display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                            type="checkbox"
                            checked={autoTranslate}
                            disabled={!translateOnline}
                            onChange={(e) => setAutoTranslate(e.target.checked)}
                        />
                        Auto-translate
                    </label>

                    <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value as "en" | "de")}
                        style={{ padding: "6px 8px" }}
                        title="Translate to"
                        disabled={!translateOnline}
                    >
                        <option value="en">English</option>
                        <option value="de">German</option>
                    </select>

                    <input
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Room ID (use a hard-to-guess secret)"
                        style={{ padding: "8px 10px", width: 260 }}
                    />

                    <button
                        onClick={onJoin}
                        disabled={!normalizedRoomId || joined || status !== "connected"}
                        style={{ padding: "8px 10px" }}
                        title={status !== "connected" ? "Socket disconnected" : ""}
                    >
                        Join
                    </button>

                    <button onClick={onLeave} disabled={!joined} style={{ padding: "8px 10px" }}>
                        Leave
                    </button>

                    <button onClick={() => router.push("/logout")} style={{ padding: "8px 10px" }}>
                        Logout
                    </button>
                    <button
                        onClick={() => router.push("/logs")}
                        style={{ padding: "8px 10px" }}
                    >
                        View logs
                    </button>
                    <button
                        onClick={() => telemetryRef.current.clear()}
                        style={{ padding: "8px 10px" }}
                    >
                        Clear logs
                    </button>
                </div>
            </header>

            <section
                style={{
                    marginTop: 16,
                    border: "1px solid rgba(0,0,0,0.15)",
                    borderRadius: 10,
                    padding: 12,
                    height: "60vh",
                    overflow: "auto",
                }}
            >
                {!joined ? (
                    <p style={{ opacity: 0.7 }}>
                        Enter a room ID and click Join. Use a high-entropy room ID as the shared secret.
                    </p>
                ) : messages.length === 0 ? (
                    <p style={{ opacity: 0.7 }}>No messages yet. Type something and send.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                        {messages.map((m) => {
                            const mine = m.sender_id === identity.anon_id;
                            const showingTranslated = m.view === "translated" && !!m.translated;
                            const shownText = showingTranslated ? m.translated! : m.original;

                            return (
                                <li key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                                    <div
                                        style={{
                                            maxWidth: "75%",
                                            padding: "10px 12px",
                                            borderRadius: 12,
                                            border: "1px solid rgba(0,0,0,0.15)",
                                            background: "rgba(0,0,0,0.03)",
                                        }}
                                    >
                                        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
                                            {mine ? "You" : m.sender_id} • {new Date(m.ts).toLocaleTimeString()}
                                        </div>

                                        <div style={{ whiteSpace: "pre-wrap" }}>{shownText}</div>

                                        {/* Per-message toggle when auto-translate is OFF */}
                                        {!autoTranslate && (
                                            <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", fontSize: 12, opacity: 0.85 }}>
                                                <button onClick={() => toggleMessageView(m.id)} style={{ padding: "4px 8px", fontSize: 12 }}>
                                                    {m.view === "original" ? "Show translated" : "Show original"}
                                                </button>

                                                {m.translating && <span>Translating…</span>}
                                                {m.translateError && <span style={{ color: "crimson" }}>{m.translateError}</span>}
                                            </div>
                                        )}

                                        {/* --- Ciphertext demo (comment out anytime) --- */}
                                        {m.ciphertext && (
                                            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.55, fontFamily: "monospace", wordBreak: "break-all" }}>
                                                <span style={{ fontStyle: "italic" }}>ciphertext:</span> {m.ciphertext}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div ref={bottomRef} />
            </section>

            <footer style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSend();
                        }
                    }}
                    placeholder={joined ? "Type a message…" : "Join a room to chat…"}
                    disabled={!joined}
                    style={{ flex: 1, padding: "10px 12px" }}
                />
                <button onClick={onSend} disabled={!joined} style={{ padding: "10px 14px" }}>
                    Send
                </button>
                <button onClick={onClear} style={{ padding: "10px 14px" }}>
                    Clear
                </button>
            </footer>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Translation happens after local decryption. Results are cached in-memory to reduce repeated calls.
            </p>
        </main>
    );
}
