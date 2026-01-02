'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
    const router = useRouter();
    const authCode = typeof window !== "undefined" ? window.localStorage.getItem('authCode') : null;

    return (
        <nav>
            <div className="p-5 flex justify-between">
                <h1>
                    <Link href="/">
                        ASM Chat
                    </Link>
                </h1>

                <div>
                    {authCode ? (
                        <button className="cursor-pointer" onClick={() => {
                            window.localStorage.removeItem('authCode');
                            router.push('/login');
                        }}>
                            Logout
                        </button>
                    ) : <Link href="/login">
                        Login
                    </Link>}

                </div>
            </div>
        </nav >
    );
}