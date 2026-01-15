import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users } from '../src/db/schema'
import { eq } from 'drizzle-orm'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)
const db = drizzle(client)

const result = await db
  .select()
  .from(users)
  .where(eq(users.email, 'test@dealhunter.com'))
  .limit(1)

console.log(JSON.stringify(result, null, 2))
await client.end()
