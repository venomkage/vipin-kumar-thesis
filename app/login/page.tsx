'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {

    const router = useRouter();
    const [err, setErr] = useState<string | null>(null);

    async function onLogin(event: React.FormEvent) {
        event.preventDefault();

        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: (event.target as any)[0].value,
                password: (event.target as any)[1].value,
            }),
        });

        const data = await response.json();

        if (response.status === 200) {
            router.push('/chat');
            window.localStorage.setItem('authCode', data.authCode);
        } else {
            setErr(data.message);
            setTimeout(() => setErr(null), 3000);
        }

    }


    return (
        <div className="flex flex-col items-center p-20">
            Welcome to the login page!

            <form onSubmit={onLogin} className="flex flex-col mt-5 ">
                <input type="text" placeholder="Username" className="border p-1 mb-2 rounded" name="username" />
                <input type="password" placeholder="Password" className="border p-1 mb-2 rounded" name="password" />
                {err && <p className="text-red-500 mb-2">{err}</p>}
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">Login</button>
            </form>
        </div>
    )
}