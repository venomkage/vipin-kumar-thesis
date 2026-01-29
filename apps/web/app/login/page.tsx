// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasVault, loadSessionIdentity, loginWithRecoveryCode } from "@/lib/anonVault";

export default function LoginPage() {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        // If already unlocked this session, go straight to chat
        if (loadSessionIdentity()) router.replace("/chat");
    }, [router]);

    const onLogin = async () => {
        setErr(null);
        setBusy(true);
        try {
            if (!hasVault()) {
                router.replace("/register");
                return;
            }
            await loginWithRecoveryCode(code);
            router.replace("/chat");
        } catch (e: any) {
            setErr("Invalid recovery code.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main style={{ padding: 24, maxWidth: 520 }}>
            <h1>Login (Unlock)</h1>
            <p>Enter your recovery code to unlock the anonymous identity stored on this device.</p>

            <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXXX-XXXXX-XXXX"
                autoCapitalize="characters"
                style={{ width: "100%", padding: "10px 12px" }}
            />

            <button onClick={onLogin} disabled={busy} style={{ padding: "10px 14px", marginTop: 12 }}>
                {busy ? "Unlocking…" : "Unlock"}
            </button>

            {err && <p style={{ marginTop: 10, color: "crimson" }}>{err}</p>}
            <p style={{ marginTop: 14, opacity: 0.75 }}>
                No vault on this device? Go to <a href="/register">/register</a>.
            </p>
        </main>
    );
}
