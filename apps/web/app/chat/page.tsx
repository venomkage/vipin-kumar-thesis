"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { loadSessionIdentity } from "@/lib/anonVault";
import { encryptMessage, decryptMessage, type EncryptedPayload } from "@/lib/crypto/secretbox";
import { deriveRoomKey } from "@/lib/crypto/roomkeys";

type UiMessage = {
    id: string;
    sender_id: string;
    body: string;
    ciphertext?: string;  // base64, for demo only
    ts: number;
};


type WireMessage = {
    room_id: string;
    sender_id: string;
    ts: number;
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

    const socketRef = useRef<Socket | null>(null);
    const activeRoomRef = useRef<string>("");
    const roomKeyRef = useRef<Uint8Array | null>(null);

    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!identity) router.replace("/login");
    }, [identity, router]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

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
            setMessages([]); // keep it simple: clear on join
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

            try {
                const plaintext = await decryptMessage({ nonce: msg.nonce, ciphertext: msg.ciphertext }, key);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: makeId(),
                        sender_id: msg.sender_id,
                        body: plaintext,
                        ciphertext: msg.ciphertext, // for demo, i have given this
                        ts: msg.ts,
                    },
                ]);

            } catch {
                // If decrypt fails, show a placeholder (useful for debugging mismatched room keys)
                setMessages((prev) => [
                    ...prev,
                    { id: makeId(), sender_id: msg.sender_id, body: "[decrypt failed]", ts: msg.ts },
                ]);
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            activeRoomRef.current = "";
            roomKeyRef.current = null;
        };
    }, [identity]);

    if (!identity) return null;

    const normalizedRoomId = roomId.trim();

    const onJoin = async () => {
        if (!normalizedRoomId) return;
        if (status !== "connected") return;

        // Derive the room key (deterministic from roomId)
        const key = await deriveRoomKey(normalizedRoomId);
        roomKeyRef.current = key;
        setCryptoReady(true);

        // Leave old room if needed
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

        const payload = await encryptMessage(text, key);

        const msg: WireMessage = {
            room_id: activeRoomRef.current,
            sender_id: identity.anon_id,
            ts: Date.now(),
            nonce: payload.nonce,
            ciphertext: payload.ciphertext,
        };

        socketRef.current?.emit("send_message", msg);
        setDraft("");
    };

    const onClear = () => setMessages([]);

    const roomDisplay = joined ? activeRoomRef.current : "-";

    return (
        <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Chat (E2EE)</h1>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        You: <code>{identity.anon_id}</code>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Status: <code>{status}</code> • Room: <code>{roomDisplay}</code> • Crypto:{" "}
                        <code>{cryptoReady ? "ready" : "not-ready"}</code>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
                    <p style={{ opacity: 0.7 }}>Enter a room ID and click Join. Use a high-entropy room ID as the shared secret.</p>
                ) : messages.length === 0 ? (
                    <p style={{ opacity: 0.7 }}>No messages yet. Type something and send.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                        {messages.map((m) => {
                            const mine = m.sender_id === identity.anon_id;
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
                                        <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>

                                        {/* --- Ciphertext demo, it can be commented or removed --- */}
                                        {m.ciphertext && (
                                            <div
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 11,
                                                    opacity: 0.55,
                                                    fontFamily: "monospace",
                                                    wordBreak: "break-all",
                                                }}
                                            >
                                                <span style={{ fontStyle: "italic" }}>ciphertext:</span>{" "}
                                                {m.ciphertext}
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
                E2EE uses a deterministic per-room key derived from the room ID (shared secret). Server relays only nonce+ciphertext.
            </p>
        </main>
    );
}
