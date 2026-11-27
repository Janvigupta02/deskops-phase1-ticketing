import { PrismaClient, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class DuplicateTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateTicketError';
  }
}

/**
 * Merge duplicate ticket into original ticket
 */
export async function mergeDuplicateTicket(
  duplicateId: string,
  originalId: string,
  actorId: string
): Promise<void> {
  if (duplicateId === originalId) {
    throw new DuplicateTicketError('Cannot merge a ticket with itself');
  }

  await prisma.\(async (tx) => {
    const [duplicate, original] = await Promise.all([
      tx.ticket.findUnique({ where: { id: duplicateId } }),
      tx.ticket.findUnique({ where: { id: originalId } })
    ]);

    if (!duplicate) {
      throw new DuplicateTicketError(\Duplicate ticket \ not found\);
    }
    if (!original) {
      throw new DuplicateTicketError(\Original ticket \ not found\);
    }

    if (duplicate.organizationId !== original.organizationId) {
      throw new DuplicateTicketError('Tickets must be from the same organization');
    }

    await tx.comment.updateMany({
      where: { ticketId: duplicateId },
      data: { ticketId: originalId }
    });

    const duplicateWatchers = await tx.watcher.findMany({
      where: { ticketId: duplicateId }
    });

    const originalWatchers = await tx.watcher.findMany({
      where: { ticketId: originalId }
    });

    const originalWatcherUserIds = new Set(
      originalWatchers.map(w => w.userId)
    );

    for (const watcher of duplicateWatchers) {
      if (!originalWatcherUserIds.has(watcher.userId)) {
        await tx.watcher.create({
          data: {
            ticketId: originalId,
            userId: watcher.userId
          }
        });
      }
    }

    await tx.watcher.deleteMany({
      where: { ticketId: duplicateId }
    });

    await tx.ticket.update({
      where: { id: duplicateId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date()
      }
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: duplicateId,
        actorId: actorId,
        actionType: 'MERGE',
        previousState: duplicate.status,
        newState: TicketStatus.CLOSED,
        metadata: {
          mergedInto: originalId,
          action: 'duplicate_closed'
        }
      }
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: originalId,
        actorId: actorId,
        actionType: 'MERGE',
        metadata: {
          mergedFrom: duplicateId,
          action: 'received_duplicate_data'
        }
      }
    });
  });
}
