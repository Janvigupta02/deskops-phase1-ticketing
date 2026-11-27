import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tenant Middleware
 * Ensures all database queries are scoped to the authenticated user's organization
 * Prevents cross-tenant data access
 */
export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
    return;
  }

  // Attach tenant-scoped Prisma client to request
  // All queries will automatically filter by organizationId
  req.prisma = createTenantPrisma(req.user.organizationId);
  
  next();
}

/**
 * Create a Prisma client instance with tenant-scoped middleware
 */
function createTenantPrisma(organizationId: string) {
  const tenantPrisma = new PrismaClient();

  // Add middleware to automatically inject organizationId filter
  tenantPrisma.(async (params, next) => {
    // Models that require tenant scoping
    const tenantModels = ['Organization', 'Property', 'Unit', 'User', 'Ticket', 'TicketEvent'];

    if (tenantModels.includes(params.model || '')) {
      // For read operations (findMany, findFirst, findUnique, count, etc.)
      if (params.action.startsWith('find') || params.action === 'count') {
        params.args = params.args || {};
        params.args.where = params.args.where || {};
        
        // Inject organizationId filter
        if (params.model !== 'Organization') {
          params.args.where.organizationId = organizationId;
        } else {
          // For Organization model, filter by id
          params.args.where.id = organizationId;
        }
      }

      // For write operations (create, update, delete)
      if (params.action === 'create') {
        params.args = params.args || {};
        params.args.data = params.args.data || {};
        
        // Inject organizationId for create
        if (params.model !== 'Organization') {
          params.args.data.organizationId = organizationId;
        }
      }

      // For update/delete, ensure organizationId match
      if (params.action === 'update' || params.action === 'delete') {
        params.args = params.args || {};
        params.args.where = params.args.where || {};
        
        if (params.model !== 'Organization') {
          params.args.where.organizationId = organizationId;
        } else {
          params.args.where.id = organizationId;
        }
      }
    }

    return next(params);
  });

  return tenantPrisma;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      prisma?: PrismaClient;
    }
  }
}

export { prisma };
