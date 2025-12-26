import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="text-center">
        <h1>
          Welcome to EntChat
        </h1>
        <p>
          This name is just the acronym taken from Encrypted, Translated Chat.
        </p>
      </div>
    </div>
  );
}
