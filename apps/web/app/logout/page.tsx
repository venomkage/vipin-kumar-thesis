// app/logout/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { lockSession } from "@/lib/anonVault";

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        // Lock: remove unlocked identity from session only.
        lockSession();
        router.replace("/login");
    }, [router]);

    return null;
}
