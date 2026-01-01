// sample login route
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  // Dummy authentication logic
  if (username === 'admin' && password === 'admin123') {
    return NextResponse.json({ message: 'Login successful', authCode: 'some-auth-code', status: 200 }, { status: 200 });
  } else {
    return NextResponse.json({ message: 'Invalid credentials', status: 401 }, { status: 401 });
  }
}   