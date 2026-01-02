import { NextResponse } from "next/server";

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha512Hex(message: string) {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-512", data);
  return toHex(digest);
}


export async function POST(request: Request) {
  // make a random and unique id for the user with the help of encrypted username and password that user provided
    const { username, password } = await request.json();
    const intermediateHash = btoa(username + ':' + password); // simple base64 encoding as an example
    // generate fixed length hash
    const userId = await sha512Hex(intermediateHash);

  // then store this user in the database


  return NextResponse.json({ message: "Register successful", userId, status: 200 }, { status: 200 });
}