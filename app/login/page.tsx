
'use client';

import { useRouter } from "next/navigation";

export default function Login() {

    const router = useRouter();

    function onLogin(event: React.FormEvent) {
        event.preventDefault();

        // go to chat page with next router
        router.push("/chat");
    }

    return (
        <div>
            Welcome to the login page!

            <form onSubmit={onLogin}>
                <input type="text" placeholder="Username" />
                <input type="password" placeholder="Password" />
                <button type="submit">Login</button>
            </form>
        </div>
    )
}