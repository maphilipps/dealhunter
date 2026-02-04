/**
 * Agent Auth Middleware
 *
 * Authentication and authorization middleware for agent tool endpoints.
 * Validates ToolContext, checks permissions, and adds audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ToolContext } from '../types';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ====== Schemas ======

const toolContextSchema = z.object({
  userId: z.string().min(1),
  userRole: z.enum(['bd', 'bl', 'admin']),
  userEmail: z.string().email(),
  userName: z.string().min(1),
  businessUnitId: z.string().optional(),
});

// ====== Permission Configuration ======

type PermissionLevel = 'read' | 'write' | 'admin';

interface ToolPermission {
  minRole: 'bd' | 'bl' | 'admin';
  level: PermissionLevel;
  requireBusinessUnit?: boolean;
}

const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  // Deep Scan tools
  'scan.deepscan.trigger': { minRole: 'bd', level: 'write' },
  'scan.deepscan.status': { minRole: 'bd', level: 'read' },
  'scan.deepscan.result': { minRole: 'bd', level: 'read' },
  'scan.deepscan.cancel': { minRole: 'bd', level: 'write' },
  'scan.deepscan.delete': { minRole: 'bl', level: 'write' },
  'scan.deepscan.retry': { minRole: 'bd', level: 'write' },
  'scan.deepscan.activity': { minRole: 'bd', level: 'read' },
  'scan.deepscan.list': { minRole: 'bd', level: 'read' },

  // Default permission for unknown tools
  default: { minRole: 'admin', level: 'admin' },
};

// ====== Role Hierarchy ======

const ROLE_HIERARCHY: Record<string, number> = {
  bd: 1,
  bl: 2,
  admin: 3,
};

// ====== Middleware Result ======

export interface AgentAuthResult {
  success: boolean;
  context?: ToolContext;
  error?: string;
  statusCode?: number;
}

// ====== Helper Functions ======

function hasMinimumRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 999);
}

async function validateUserExists(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, deletedAt: true },
  });
  return user !== undefined && user.deletedAt === null;
}

/**
 * Logs agent tool invocations for audit purposes.
 * Uses structured logging since the auditTrails table has fixed entity types.
 */
function logAuditTrail(
  toolName: string,
  context: ToolContext,
  action: string,
  details?: Record<string, unknown>
): void {
  // Structured log entry for agent tool audit
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'agent_tool_audit',
    toolName,
    action,
    userId: context.userId,
    userRole: context.userRole,
    userEmail: context.userEmail,
    businessUnitId: context.businessUnitId,
    details,
  };

  // In production, this would go to a centralized logging service
  // For now, use structured console logging
  console.info('[AGENT_AUDIT]', JSON.stringify(logEntry));
}

// ====== Main Middleware Function ======

/**
 * Validates agent tool context and checks permissions
 *
 * @param toolName - The name of the tool being called
 * @param rawContext - The context object from the request
 * @returns AgentAuthResult with validated context or error
 */
export async function validateAgentAuth(
  toolName: string,
  rawContext: unknown
): Promise<AgentAuthResult> {
  // 1. Validate context schema
  const parseResult = toolContextSchema.safeParse(rawContext);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid tool context: ${parseResult.error.message}`,
      statusCode: 400,
    };
  }

  const context = parseResult.data;

  // 2. Verify user exists and is active
  const userExists = await validateUserExists(context.userId);
  if (!userExists) {
    return {
      success: false,
      error: 'User not found or inactive',
      statusCode: 401,
    };
  }

  // 3. Check tool permissions
  const permission = TOOL_PERMISSIONS[toolName] ?? TOOL_PERMISSIONS.default;

  if (!hasMinimumRole(context.userRole, permission.minRole)) {
    logAuditTrail(toolName, context, 'permission_denied', {
      requiredRole: permission.minRole,
      actualRole: context.userRole,
    });

    return {
      success: false,
      error: `Insufficient permissions. Required role: ${permission.minRole}, your role: ${context.userRole}`,
      statusCode: 403,
    };
  }

  // 4. Check business unit requirement
  if (permission.requireBusinessUnit && !context.businessUnitId) {
    return {
      success: false,
      error: 'Business unit ID required for this operation',
      statusCode: 400,
    };
  }

  // 5. Log successful auth
  logAuditTrail(toolName, context, 'tool_invoked');

  return {
    success: true,
    context,
  };
}

// ====== Higher-Order Function for Route Handlers ======

type RouteHandler = (
  req: NextRequest,
  context: ToolContext,
  params?: Record<string, string>
) => Promise<NextResponse>;

// Next.js 16 route context with Promise-based params
type NextRouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

/**
 * Wraps a route handler with agent authentication
 *
 * @example
 * ```ts
 * export const POST = withAgentAuth('scan.deepscan.trigger', async (req, context) => {
 *   const body = await req.json();
 *   // ... handler logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withAgentAuth(toolName: string, handler: RouteHandler) {
  return async (req: NextRequest, routeContext: NextRouteContext = {}): Promise<NextResponse> => {
    // Resolve params (Next.js 16 uses Promise-based params)
    const params = routeContext.params
      ? routeContext.params instanceof Promise
        ? await routeContext.params
        : routeContext.params
      : undefined;
    try {
      // Extract context from request headers or body
      const contextHeader = req.headers.get('X-Agent-Context');
      let rawContext: unknown;

      if (contextHeader) {
        try {
          rawContext = JSON.parse(contextHeader);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid X-Agent-Context header' },
            { status: 400 }
          );
        }
      } else {
        // Try to get context from body
        const body = await req
          .clone()
          .json()
          .catch(() => ({}));
        rawContext = body.context;
      }

      if (!rawContext) {
        return NextResponse.json(
          { success: false, error: 'Missing agent context' },
          { status: 400 }
        );
      }

      // Validate auth
      const authResult = await validateAgentAuth(toolName, rawContext);

      if (!authResult.success || !authResult.context) {
        return NextResponse.json(
          { success: false, error: authResult.error },
          { status: authResult.statusCode ?? 401 }
        );
      }

      // Call the handler with validated context
      return await handler(req, authResult.context, params);
    } catch (error) {
      console.error(`Agent auth error for ${toolName}:`, error);
      return NextResponse.json(
        { success: false, error: 'Internal authentication error' },
        { status: 500 }
      );
    }
  };
}

// ====== Rate Limiting (Simple in-memory) ======

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  'scan.deepscan.trigger': { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  'scan.deepscan.retry': { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  default: { maxRequests: 100, windowMs: 60000 }, // 100 per minute
};

export function checkRateLimit(
  toolName: string,
  userId: string
): { allowed: boolean; retryAfter?: number } {
  const limit = RATE_LIMITS[toolName] ?? RATE_LIMITS.default;
  const key = `${toolName}:${userId}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Wraps a route handler with agent authentication and rate limiting
 */
export function withAgentAuthAndRateLimit(toolName: string, handler: RouteHandler) {
  return withAgentAuth(toolName, async (req, context, params) => {
    const rateCheck = checkRateLimit(toolName, context.userId);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateCheck.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter ?? 60),
          },
        }
      );
    }

    return handler(req, context, params);
  });
}
