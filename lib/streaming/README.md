# Streaming Architecture

This directory contains two streaming systems.

## In-process (scan UI / server routes)

Files in `lib/streaming/in-process/` are for in-process streaming and UI progress:

- `event-emitter.ts` and `event-types.ts`: lightweight event emitter + event types.
- `pitch-scan-events.ts`: normalization helpers for Pitch Scan SSE events.

## Redis (BullMQ workers / long-running jobs)

Files in `lib/streaming/redis/` are for Redis-backed streaming used by background workers:

- `qualification-events.ts`: event types for qualification processing.
- `qualification-publisher.ts`: publish + replay helpers.
- `redis-config.ts`: Redis connection configuration.
