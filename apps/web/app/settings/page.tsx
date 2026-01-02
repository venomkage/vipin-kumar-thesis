'use client';

export default function SettingsPage() {
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
                            window.localStorage.setItem('preferredLanguage', selectedLanguage);
                        }
                    }
                }>
                    <option>English</option>
                    <option>German</option>
                    <option>Spanish</option>
                </select>
            </div>
        </div>
    );
}