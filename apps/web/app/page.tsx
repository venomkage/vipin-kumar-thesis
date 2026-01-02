'use client';

import { useAuthStore } from "@/zustand-state/store";
import Link from "next/link";

export default function Home() {
  const authCode = useAuthStore((state) => state.authCode);

  return (
    <div className=" min-h-screen  bg-zinc-50 font-sans dark:bg-black">
      <div className="p-5">
        <h1 className="mb-5">
          Welcome to ASM Chat!
        </h1>
        <p className="mb-5">
          If this is your first time here then there are two things for you:
        </p>
        <ol className="list-decimal list-inside">
          <li>
            Please login from the login page.
          </li>
          <li>
            Go to settings and select your preferred language.
          </li>
        </ol>
        <p className="my-4">
          After that you can go to chat and start chatting!
        </p>
        {
          authCode ?
            <Link href="/chat" className="bg-green-700 p-2 rounded text-white">
              Go to Chat
            </Link>
            :
            <Link href="/login" className="bg-green-700 p-2 rounded text-white">
              Go to Login
            </Link>
        }
      </div>
    </div>
  );
}
