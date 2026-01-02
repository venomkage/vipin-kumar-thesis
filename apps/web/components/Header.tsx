'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/zustand-state/store";

export default function Header() {
    const router = useRouter();
    const authCode = useAuthStore((state) => state.authCode);
    const setAuthCode = useAuthStore((state) => state.setAuthCode);

    return (
        <nav>
            <div className="p-5 flex justify-between">
                <h1>
                    <Link href="/">
                        ASM Chat
                    </Link>
                </h1>

                <div>
                    {authCode && <Link href="/settings" className="mr-4">
                        Settings
                    </Link>}
                    {authCode && (
                        <button className="cursor-pointer" onClick={() => {
                            window.localStorage.removeItem('authCode');
                            setAuthCode(null);
                            router.push('/');
                        }}>
                            Logout
                        </button>
                    )}

                </div>
            </div>
        </nav >
    );
}