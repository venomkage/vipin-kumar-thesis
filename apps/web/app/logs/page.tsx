"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { downloadJson, getTelemetryStore, type TelemetryEvent } from "@/lib/telemetry";

type MsgSummary = {
    msg_id: string;
    room_id?: string;
    sender_id?: string;

    encrypt_ms?: number;
    bytes_ciphertext?: number;
    relay_ms?: number;     // ts_client_recv - ts_sender
    decrypt_ms?: number;
    decrypt_ok?: boolean;

    translate_ms?: number;
    translate_ok?: boolean;

    auto_translate?: boolean;
    target_lang?: string;

    ts_send?: number;
    ts_recv?: number;
};

function mean(nums: number[]) {
    if (nums.length === 0) return null;
    const s = nums.reduce((a, b) => a + b, 0);
    return s / nums.length;
}

export default function LogsPage() {
    const router = useRouter();
    const telemetry = useMemo(() => getTelemetryStore(2000), []);
    const [events, setEvents] = useState<TelemetryEvent[]>([]);
    const [showRaw, setShowRaw] = useState(false);

    useEffect(() => {
        telemetry.syncFromSession();
        setEvents(telemetry.all());
        // lightweight refresh (in case logs are added while on page)
        const t = setInterval(() => {
            telemetry.syncFromSession();
            setEvents(telemetry.all());
        }, 1000);
        return () => clearInterval(t);
    }, [telemetry]);

    const { summaries, stats } = useMemo(() => {
        const byMsg = new Map<string, MsgSummary>();

        for (const e of events) {
            if (e.type === "msg_send") {
                const s = byMsg.get(e.msg_id) ?? { msg_id: e.msg_id };
                s.room_id = e.room_id;
                s.sender_id = e.sender_id;
                s.encrypt_ms = e.t_encrypt_ms;
                s.bytes_ciphertext = e.bytes_ciphertext;
                s.auto_translate = e.auto_translate;
                s.target_lang = e.target_lang;
                s.ts_send = e.ts_client_send;
                byMsg.set(e.msg_id, s);
            } else if (e.type === "msg_recv") {
                const s = byMsg.get(e.msg_id) ?? { msg_id: e.msg_id };
                s.room_id = e.room_id;
                s.sender_id = e.sender_id;
                s.decrypt_ms = e.t_decrypt_ms;
                s.decrypt_ok = e.ok_decrypt;
                s.auto_translate = e.auto_translate;
                s.target_lang = e.target_lang;
                s.ts_recv = e.ts_client_recv;
                s.relay_ms = e.ts_client_recv - e.ts_sender;
                byMsg.set(e.msg_id, s);
            } else if (e.type === "translate") {
                const s = byMsg.get(e.msg_id) ?? { msg_id: e.msg_id };
                s.room_id = e.room_id;
                s.translate_ms = e.t_translate_ms;
                s.translate_ok = e.ok_translate;
                s.target_lang = e.target_lang;
                byMsg.set(e.msg_id, s);
            }
        }

        const summaries = Array.from(byMsg.values()).sort(
            (a, b) => (b.ts_send ?? 0) - (a.ts_send ?? 0)
        );

        const enc = summaries.map(s => s.encrypt_ms).filter((v): v is number => typeof v === "number");
        const dec = summaries.map(s => s.decrypt_ms).filter((v): v is number => typeof v === "number");
        const rel = summaries.map(s => s.relay_ms).filter((v): v is number => typeof v === "number");
        const tr = summaries.map(s => s.translate_ms).filter((v): v is number => typeof v === "number");

        const stats = {
            messages: summaries.length,
            avg_encrypt_ms: mean(enc),
            avg_decrypt_ms: mean(dec),
            avg_relay_ms: mean(rel),
            avg_translate_ms: mean(tr),
        };

        return { summaries, stats };
    }, [events]);

    const exportLogs = () => {
        const payload = {
            exported_at: new Date().toISOString(),
            events,
            per_message: summaries,
            stats,
        };
        downloadJson(`telemetry_${Date.now()}.json`, payload);
    };

    return (
        <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Telemetry Logs</h1>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Messages: <code>{stats.messages}</code> • Avg relay:{" "}
                        <code>{stats.avg_relay_ms == null ? "-" : stats.avg_relay_ms.toFixed(2)} ms</code> • Avg encrypt:{" "}
                        <code>{stats.avg_encrypt_ms == null ? "-" : stats.avg_encrypt_ms.toFixed(2)} ms</code> • Avg decrypt:{" "}
                        <code>{stats.avg_decrypt_ms == null ? "-" : stats.avg_decrypt_ms.toFixed(2)} ms</code> • Avg translate:{" "}
                        <code>{stats.avg_translate_ms == null ? "-" : stats.avg_translate_ms.toFixed(2)} ms</code>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => router.push("/chat")} style={{ padding: "8px 10px" }}>
                        Back to chat
                    </button>
                    <button onClick={exportLogs} style={{ padding: "8px 10px" }}>
                        Export logs
                    </button>
                    <button
                        onClick={() => {
                            telemetry.clear();
                            setEvents([]);
                        }}
                        style={{ padding: "8px 10px" }}
                    >
                        Clear logs
                    </button>
                </div>
            </header>

            <section style={{ marginTop: 16 }}>
                <h2 style={{ margin: "12px 0" }}>Per-message summary</h2>

                {summaries.length === 0 ? (
                    <p style={{ opacity: 0.7 }}>No telemetry yet. Send some messages in /chat.</p>
                ) : (
                    <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                                    <th style={{ textAlign: "left", padding: 10 }}>msg_id</th>
                                    <th style={{ textAlign: "left", padding: 10 }}>room</th>
                                    <th style={{ textAlign: "right", padding: 10 }}>relay (ms)</th>
                                    <th style={{ textAlign: "right", padding: 10 }}>encrypt (ms)</th>
                                    <th style={{ textAlign: "right", padding: 10 }}>decrypt (ms)</th>
                                    <th style={{ textAlign: "left", padding: 10 }}>decrypt</th>
                                    <th style={{ textAlign: "right", padding: 10 }}>translate (ms)</th>
                                    <th style={{ textAlign: "left", padding: 10 }}>translate</th>
                                    <th style={{ textAlign: "left", padding: 10 }}>target</th>
                                    <th style={{ textAlign: "right", padding: 10 }}>cipher bytes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaries.map((s) => (
                                    <tr key={s.msg_id} style={{ borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                                        <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{s.msg_id}</td>
                                        <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{s.room_id ?? "-"}</td>
                                        <td style={{ padding: 10, textAlign: "right" }}>{s.relay_ms ?? "-"}</td>
                                        <td style={{ padding: 10, textAlign: "right" }}>{s.encrypt_ms ?? "-"}</td>
                                        <td style={{ padding: 10, textAlign: "right" }}>{s.decrypt_ms ?? "-"}</td>
                                        <td style={{ padding: 10 }}>{s.decrypt_ok == null ? "-" : s.decrypt_ok ? "ok" : "fail"}</td>
                                        <td style={{ padding: 10, textAlign: "right" }}>{s.translate_ms ?? "-"}</td>
                                        <td style={{ padding: 10 }}>
                                            {s.translate_ok == null ? "-" : s.translate_ok ? "ok" : "fail"}
                                        </td>
                                        <td style={{ padding: 10 }}>{s.target_lang ?? "-"}</td>
                                        <td style={{ padding: 10, textAlign: "right" }}>{s.bytes_ciphertext ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section style={{ marginTop: 16 }}>
                <button onClick={() => setShowRaw((v) => !v)} style={{ padding: "8px 10px" }}>
                    {showRaw ? "Hide raw events" : "Show raw events"}
                </button>

                {showRaw && (
                    <pre
                        style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: "rgba(0,0,0,0.02)",
                            overflow: "auto",
                            maxHeight: "50vh",
                            fontSize: 12,
                        }}
                    >
                        {JSON.stringify(events, null, 2)}
                    </pre>
                )}
            </section>
        </main>
    );
}