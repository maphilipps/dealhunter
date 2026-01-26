import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Docker container orchestration
 * Returns 200 OK if the app is running
 */
export function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
