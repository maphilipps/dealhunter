import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Qualification wird automatisch ausgeführt.',
    },
    { status: 410 }
  );
}
