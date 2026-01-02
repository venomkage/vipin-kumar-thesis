'use client';

import { useAuthStore } from "@/zustand-state/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
    const authCode = useAuthStore((state) => state.authCode);
    const router = useRouter();

    useEffect(() => {
        if (!authCode) {
            router.push('/login');
        }
    }, [authCode]);

    return (
        <div className="p-5">
            <h1>Settings</h1>

            <div>
                <span>Auto Translate</span>
                <input type="checkbox" className="ml-2" />
            </div>
            <div>
                <span>
                    Receive Messages in
                </span>
                <select className="ml-2 border p-1 rounded" onChange={
                    (e) => {
                        const selectedLanguage = e.target.value;
                        console.log(selectedLanguage)
                        if (typeof window !== "undefined") {
                            window.localStorage.setItem('preferredLanguage', selectedLanguage === 'English' ? 'en' : 'de');
                        }
                    }
                }>
                    <option>English</option>
                    <option>German</option>
                </select>
            </div>
        </div>
    );
}