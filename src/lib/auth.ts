import { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { UnauthorizedError } from '@/lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Middleware to verify JWT token and extract user info
 * Can be applied to API routes
 */
export async function verifyAuth(request: NextRequest): Promise<{ userId: string; email: string; role: string }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
  const verified = await jwtVerify(token, secretKey);
  const payload = (verified.payload as unknown) as JWTPayload;

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Create a JWT token (for development/testing)
 * In production, tokens should be issued by a dedicated auth service
 */
export async function createMockToken(userId: string, email: string, role: string = 'USER'): Promise<string> {
  const token = await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secretKey);

  return token;
}

/**
 * Helper to extract user from request in API routes
 * In development mode, allows unauthenticated requests with mock user
 */
export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isDev = process.env.NODE_ENV !== 'production';

  // Development mode: very permissive
  if (isDev) {
    // If token is provided, validate it
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Allow dev-token bypass
      if (token === 'dev-token' || token.includes('dev')) {
        // In dev mode with dev-token, get the first admin user from DB or create fallback
        try {
          const { prisma } = await import('@/lib/prisma');
          const adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
          });
          if (adminUser) {
            return {
              userId: adminUser.id,
              email: adminUser.email,
              role: adminUser.role,
            };
          }
        } catch {
          // Fall through if DB query fails
        }
        
        // Fallback if no admin user exists
        return {
          userId: 'dev-admin-fallback',
          email: 'dev-admin@example.com',
          role: 'ADMIN',
        };
      }

      // Try to validate as JWT
      try {
        return await verifyAuth(request);
      } catch {
        // Fall through to mock user
      }
    }

    // No token or invalid token in dev: try to get first user from DB
    try {
      const { prisma } = await import('@/lib/prisma');
      const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (user) {
        return {
          userId: user.id,
          email: user.email,
          role: user.role,
        };
      }
    } catch {
      // Fall through if DB query fails
    }

    // If no user in DB or query failed, return fallback
    return {
      userId: 'dev-user-fallback',
      email: 'dev@example.com',
      role: 'ADMIN',
    };
  }

  // Production: strict validation required
  return verifyAuth(request);
}

// TODO: In production, implement proper JWT token creation and validation
// Consider using libraries like:
// - jsonwebtoken + @types/jsonwebtoken
// - jose (JWT library by Auth0)
// - PassportJS with JWT strategy
//
// For development, this middleware stub allows mocking:
// ```
// const mockUser = { userId: 'test-user', email: 'test@example.com', role: 'ADMIN' };
// ```
