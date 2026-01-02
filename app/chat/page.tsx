'use client';
import { useEffect, useState } from "react";

export default function Chat() {
    const [messages, setMessages] = useState([{
        sender: "user",
        content: "",
        timestamp: new Date(),
    }]);
    const [message, setMessage] = useState([{
        sender: "user",
        content: "",
        timestamp: new Date(),
    }]);

    useEffect(() => {
        const authCode = window.localStorage.getItem('authCode');
        if (!authCode) {
            window.location.href = '/login';
        }
    }, []);

    async function translateMessage(message: string) {
        const res = await fetch("http://127.0.0.1:5000/translate", {
            method: "POST",
            body: JSON.stringify({
                q: message,
                source: "auto",
                target: "de",
                format: "text",
                alternatives: 3,
                api_key: ""
            }),
            headers: { "Content-Type": "application/json" }
        });

        // const { translatedText } = await res.json();

        // alert
        console.log(await res.json())
        // alert(`Translated Text: ${translatedText}`);
    }

    function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        if (message[0].content.trim() === "") return;
        translateMessage(message[0].content);
        setMessages((prevMessage) => [
            {
                sender: "user",
                content: message[0].content,
                timestamp: new Date(),
            },
            ...prevMessage
        ]);
        setMessage([{ sender: "user", content: "", timestamp: new Date() }]);
    }

    return (
        <div className="flex flex-col items-center p-20 justify-end h-screen">
            <div className="w-full h-9/10 border p-5 mb-5 rounded 
                overflow-y-scroll flex
                flex-col-reverse 
                text-green-700
            ">
                {messages.map((msg, index) => {
                    if (msg.content.trim() === "") return null;

                    return (
                        <div key={index} className={`mb-2 p-2 rounded ${msg.sender === "user" ? "bg-blue-100 self-end" : "bg-gray-200 self-start"}`}>
                            <p>{msg.content}</p>
                            <span className="text-xs text-gray-500">{msg.timestamp.toLocaleTimeString()}</span>
                        </div>
                    );
                })}

            </div>
            <form className="w-full flex items-start" onSubmit={sendMessage}>
                <input type="text" name="message" id="message" className="border p-2 mb-2 rounded flex-8 border-green-700"
                    placeholder="Type your message here..."
                    value={message[0].content}
                    onChange={(e) => setMessage([{ ...message[0], content: e.target.value }])}
                />
                <button className="bg-green-700 text-white p-2 rounded ml-2 flex-2"
                    type="submit"
                >Send</button>
            </form>
        </div>
    )
}