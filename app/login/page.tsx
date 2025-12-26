
'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {

    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    function onLogin(event: React.FormEvent) {
        event.preventDefault();

        // go to chat page with next router
        if (username === "admin" && password === "admin123") router.push("/chat");
        else alert("Invalid credentials");
    }

    return (
        <div className="flex flex-col items-center p-20">
            Welcome to the login page!

            <form onSubmit={onLogin} className="flex flex-col mt-5 ">
                <input type="text" placeholder="Username" className="border p-1 mb-2 rounded" value={username} onChange={(e) => setUsername(e.target.value)} />
                <input type="password" placeholder="Password" className="border p-1 mb-2 rounded" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="submit" className="bg-blue-500 text-white p-2 rounded">Login</button>
            </form>
        </div>
    )
}