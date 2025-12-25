import Link from "next/link";

export default function Header() {
    return (
        <nav>
            <div className="p-5 flex justify-between">
                <h1>
                    <Link href="/">
                        EntChat
                    </Link>
                </h1>

                <div>
                    <Link href="/login">
                        Login
                    </Link>
                </div>
            </div>
        </nav >
    );
}