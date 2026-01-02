// sample login route
import { NextResponse } from 'next/server';
import { sha512Hex } from '../anon_register/route';

export async function POST(request: Request) {
  const { username, password, storedId } = await request.json();
  const intermediateHash = btoa(username + ':' + password);
  const userId = await sha512Hex(intermediateHash);


  // Dummy authentication logic
  if (storedId === userId) {
    return NextResponse.json({ message: 'Login successful', authCode: 'some-auth-code', status: 200 }, { status: 200 });
  } else {
    return NextResponse.json({ message: 'Invalid credentials', status: 401 }, { status: 401 });
  }
}   