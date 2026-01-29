// app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerNewAnonymous, hasVault } from "@/lib/anonVault";

export default function RegisterPage() {
    const router = useRouter();
    const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    const onRegister = async () => {
        setBusy(true);
        setNote(null);
        try {
            if (hasVault()) {
                setNote("This device already has an encrypted identity. Use /login to unlock it or /logout to lock it.");
                setBusy(false);
                return;
            }
            const { recoveryCode } = await registerNewAnonymous();
            setRecoveryCode(recoveryCode);
        } catch (e) {
            setNote("Register failed.");
        } finally {
            setBusy(false);
        }
    };

    const onContinue = () => router.push("/chat");

    return (
        <main style={{ padding: 24, maxWidth: 560 }}>
            <h1>Register (Anonymous)</h1>
            <p>No email/phone. A local anonymous identity is created and stored encrypted on this device.</p>

            {!recoveryCode ? (
                <>
                    <button onClick={onRegister} disabled={busy} style={{ padding: "10px 14px" }}>
                        {busy ? "Creating…" : "Create anonymous identity"}
                    </button>
                    {note && <p style={{ marginTop: 12, opacity: 0.8 }}>{note}</p>}
                </>
            ) : (
                <>
                    <h2 style={{ marginTop: 18 }}>Your recovery code</h2>
                    <p style={{ marginTop: 6 }}>
                        Save this code. You’ll need it to unlock your anonymous identity on this device after logout/refresh.
                    </p>
                    <div
                        style={{
                            marginTop: 10,
                            padding: 12,
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            fontFamily: "monospace",
                            fontSize: 18,
                        }}
                    >
                        {recoveryCode}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <button
                            onClick={async () => {
                                await navigator.clipboard.writeText(recoveryCode);
                                setNote("Copied to clipboard.");
                            }}
                            style={{ padding: "10px 14px" }}
                        >
                            Copy
                        </button>
                        <button onClick={onContinue} style={{ padding: "10px 14px" }}>
                            Continue to chat
                        </button>
                    </div>
                    {note && <p style={{ marginTop: 12, opacity: 0.8 }}>{note}</p>}
                </>
            )}
        </main>
    );
}
