import { pgEnum, pgTable, uuid, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { UserRole } from '@/lib/roles'

// ✅ NEW: Create PostgreSQL enum for roles
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'bereichsleiter',
  'bd_manager',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),

  // ✅ CHANGED: Use enum instead of varchar
  role: userRoleEnum('role').notNull().default('bd_manager'),

  isActive: boolean('is_active').notNull().default(true),

  // ✅ NEW: Add tokenVersion field for session invalidation
  tokenVersion: integer('token_version').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
