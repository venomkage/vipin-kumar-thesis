// app/chat/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSessionIdentity } from "@/lib/anonVault";

type UiMessage = {
    id: string;
    sender_id: string;
    body: string;
    ts: number;
};

function makeId() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ChatPage() {
    const router = useRouter();

    // Identity is now unlocked per-session (sessionStorage), via /login
    const identity = useMemo(() => loadSessionIdentity(), []);

    const [roomId, setRoomId] = useState<string>(""); // placeholder for later realtime rooms
    const [draft, setDraft] = useState("");
    const [messages, setMessages] = useState<UiMessage[]>([]);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Hard gate: must be unlocked
        if (!identity) router.replace("/login");
    }, [identity, router]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    if (!identity) return null;

    const onSend = () => {
        const text = draft.trim();
        if (!text) return;

        const msg: UiMessage = {
            id: makeId(),
            sender_id: identity.anon_id,
            body: text,
            ts: Date.now(),
        };

        // Baseline: local echo only (no realtime yet)
        setMessages((prev) => [...prev, msg]);
        setDraft("");
    };

    const onClear = () => setMessages([]);

    return (
        <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Chat (Baseline)</h1>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        You: <code>{identity.anon_id}</code>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Room ID (later)"
                        style={{ padding: "8px 10px", width: 220 }}
                    />
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
                {messages.length === 0 ? (
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
                    placeholder="Type a message…"
                    style={{ flex: 1, padding: "10px 12px" }}
                />
                <button onClick={onSend} style={{ padding: "10px 14px" }}>
                    Send
                </button>
                <button onClick={onClear} style={{ padding: "10px 14px" }}>
                    Clear
                </button>
            </footer>

            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Identity is unlocked via <code>/login</code> and stored only in <code>sessionStorage</code>. Next step is adding
                real-time transport (Socket.io/Supabase).
            </p>
        </main>
    );
}
