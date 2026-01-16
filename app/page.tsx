import { Bot } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Bot className="h-12 w-12" />
          <h1 className="text-4xl font-bold">Dealhunter</h1>
        </div>

        <p className="mb-8 text-lg text-muted-foreground">
          AI-gestützte BD-Entscheidungsplattform für adesso SE
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-input px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            Registrieren
          </Link>
        </div>
      </div>
    </main>
  );
}
