import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Visualisierungen werden automatisch durch die Qualification erstellt.',
    },
    { status: 410 }
  );
}
