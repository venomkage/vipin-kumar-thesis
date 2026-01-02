'use client';

import React, { useEffect } from "react";

export default function RegisterPage() {

    const [success, setSuccess] = React.useState(false);

    async function registerUser(e: React.FormEvent) {
        e.preventDefault();

        const response = await fetch('/api/auth/anon_register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: (e.target as any)[0].value,
                password: (e.target as any)[1].value,
            }),
        });

        const data = await response.json();
        window.localStorage.setItem('userId', data.userId);
        setSuccess(true);
    }

    return (
        <div className="flex flex-col items-center p-20">
            Welcome to the login page!

            <form onSubmit={registerUser} className="flex flex-col mt-5 ">
                <input type="text" placeholder="Username" className="border p-1 mb-2 rounded" name="username" />
                <input type="password" placeholder="Password" className="border p-1 mb-2 rounded" name="password" />
                {success && <p className="text-green-500 mb-2">Registration Successful! You can now login.</p>}
                <button type="submit" className="bg-green-700 text-white p-2 rounded">Register</button>
            </form>
        </div>
    );
}