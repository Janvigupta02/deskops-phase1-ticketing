import { PrismaClient, TicketStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

describe('Ticket Merge - Duplicate Handling', () => {
  let orgId: string;
  let propertyId: string;
  let unitId: string;
  let managerId: string;
  let residentId: string;
  let originalTicketId: string;
  let duplicateTicketId: string;

  beforeAll(async () => {
    // Setup test data
    const org = await prisma.organization.create({
      data: {
        name: 'Test Dental Clinic'
      }
    });
    orgId = org.id;

    const property = await prisma.property.create({
      data: {
        organizationId: orgId,
        name: 'Downtown Clinic',
        address: '123 Main St'
      }
    });
    propertyId = property.id;

    const unit = await prisma.unit.create({
      data: {
        propertyId: propertyId,
        unitNumber: 'Chair-A',
        unitType: 'dental_chair'
      }
    });
    unitId = unit.id;

    const manager = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: 'manager@test.com',
        passwordHash: 'hashed',
        name: 'Test Manager',
        role: UserRole.MANAGER,
        propertyIds: [propertyId]
      }
    });
    managerId = manager.id;

    const resident = await prisma.user.create({
      data: {
        organizationId: orgId,
        email: 'resident@test.com',
        passwordHash: 'hashed',
        name: 'Test Resident',
        role: UserRole.RESIDENT,
        propertyIds: []
      }
    });
    residentId = resident.id;

    // Create original ticket
    const originalTicket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        propertyId: propertyId,
        unitId: unitId,
        createdById: residentId,
        title: 'Broken dental chair',
        description: 'Chair A is not working properly',
        status: TicketStatus.OPEN
      }
    });
    originalTicketId = originalTicket.id;

    // Add comments to original ticket
    await prisma.comment.createMany({
      data: [
        {
          ticketId: originalTicketId,
          authorId: residentId,
          content: 'This is urgent',
          isInternal: false
        },
        {
          ticketId: originalTicketId,
          authorId: managerId,
          content: 'Internal note: Assign to tech team',
          isInternal: true
        }
      ]
    });

    // Add watchers to original ticket
    await prisma.watcher.create({
      data: {
        ticketId: originalTicketId,
        userId: managerId
      }
    });

    // Create duplicate ticket
    const duplicateTicket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        propertyId: propertyId,
        unitId: unitId,
        createdById: residentId,
        title: 'Chair A broken',
        description: 'Same issue - chair not working',
        status: TicketStatus.OPEN
      }
    });
    duplicateTicketId = duplicateTicket.id;

    // Add comments to duplicate ticket
    await prisma.comment.createMany({
      data: [
        {
          ticketId: duplicateTicketId,
          authorId: residentId,
          content: 'Still not fixed',
          isInternal: false
        },
        {
          ticketId: duplicateTicketId,
          authorId: managerId,
          content: 'This looks like a duplicate',
          isInternal: true
        }
      ]
    });

    // Add watchers to duplicate ticket
    await prisma.watcher.create({
      data: {
        ticketId: duplicateTicketId,
        userId: residentId
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.watcher.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.ticketEvent.deleteMany({});
    await prisma.ticket.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.\();
  });

  describe('mergeDuplicateTicket', () => {
    it('should close the duplicate ticket after merge', async () => {
      // This test will FAIL initially (TDD approach)
      // We need to implement mergeDuplicateTicket function
      
      // ACT: Merge duplicate into original
      await mergeDuplicateTicket(duplicateTicketId, originalTicketId, managerId);

      // ASSERT: Duplicate should be closed
      const duplicateAfterMerge = await prisma.ticket.findUnique({
        where: { id: duplicateTicketId }
      });

      expect(duplicateAfterMerge).not.toBeNull();
      expect(duplicateAfterMerge?.status).toBe(TicketStatus.CLOSED);
      expect(duplicateAfterMerge?.closedAt).not.toBeNull();
    });

    it('should move all comments from duplicate to original', async () => {
      // Count comments before merge
      const duplicateCommentsBefore = await prisma.comment.count({
        where: { ticketId: duplicateTicketId }
      });
      
      const originalCommentsBefore = await prisma.comment.count({
        where: { ticketId: originalTicketId }
      });

      // ACT: Merge
      await mergeDuplicateTicket(duplicateTicketId, originalTicketId, managerId);

      // ASSERT: All comments should be on original
      const duplicateCommentsAfter = await prisma.comment.count({
        where: { ticketId: duplicateTicketId }
      });

      const originalCommentsAfter = await prisma.comment.count({
        where: { ticketId: originalTicketId }
      });

      expect(duplicateCommentsAfter).toBe(0);
      expect(originalCommentsAfter).toBe(originalCommentsBefore + duplicateCommentsBefore);
    });

    it('should move all watchers from duplicate to original', async () => {
      // Count watchers before merge
      const duplicateWatchersBefore = await prisma.watcher.count({
        where: { ticketId: duplicateTicketId }
      });

      const originalWatchersBefore = await prisma.watcher.count({
        where: { ticketId: originalTicketId }
      });

      // ACT: Merge
      await mergeDuplicateTicket(duplicateTicketId, originalTicketId, managerId);

      // ASSERT: All watchers should be on original (deduplicated)
      const duplicateWatchersAfter = await prisma.watcher.count({
        where: { ticketId: duplicateTicketId }
      });

      const originalWatchersAfter = await prisma.watcher.count({
        where: { ticketId: originalTicketId }
      });

      expect(duplicateWatchersAfter).toBe(0);
      expect(originalWatchersAfter).toBeGreaterThanOrEqual(originalWatchersBefore);
      // Should have at least original + new unique watchers
    });

    it('should create a merge event on both tickets', async () => {
      // ACT: Merge
      await mergeDuplicateTicket(duplicateTicketId, originalTicketId, managerId);

      // ASSERT: Check merge events
      const duplicateMergeEvent = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: duplicateTicketId,
          actionType: 'MERGE'
        }
      });

      const originalMergeEvent = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: originalTicketId,
          actionType: 'MERGE'
        }
      });

      expect(duplicateMergeEvent).not.toBeNull();
      expect(duplicateMergeEvent?.actorId).toBe(managerId);
      expect(duplicateMergeEvent?.metadata).toMatchObject({
        mergedInto: originalTicketId,
        action: 'duplicate_closed'
      });

      expect(originalMergeEvent).not.toBeNull();
      expect(originalMergeEvent?.actorId).toBe(managerId);
      expect(originalMergeEvent?.metadata).toMatchObject({
        mergedFrom: duplicateTicketId,
        action: 'received_duplicate_data'
      });
    });

    it('should not allow merging a ticket with itself', async () => {
      await expect(
        mergeDuplicateTicket(originalTicketId, originalTicketId, managerId)
      ).rejects.toThrow('Cannot merge a ticket with itself');
    });

    it('should not allow merging tickets from different organizations', async () => {
      // Create a ticket in different org
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Org' }
      });

      const otherProperty = await prisma.property.create({
        data: {
          organizationId: otherOrg.id,
          name: 'Other Property'
        }
      });

      const otherUnit = await prisma.unit.create({
        data: {
          propertyId: otherProperty.id,
          unitNumber: 'Unit-1'
        }
      });

      const otherUser = await prisma.user.create({
        data: {
          organizationId: otherOrg.id,
          email: 'other@test.com',
          passwordHash: 'hashed',
          name: 'Other User',
          role: UserRole.RESIDENT,
          propertyIds: []
        }
      });

      const otherTicket = await prisma.ticket.create({
        data: {
          organizationId: otherOrg.id,
          propertyId: otherProperty.id,
          unitId: otherUnit.id,
          createdById: otherUser.id,
          title: 'Other ticket',
          description: 'Different org',
          status: TicketStatus.OPEN
        }
      });

      await expect(
        mergeDuplicateTicket(duplicateTicketId, otherTicket.id, managerId)
      ).rejects.toThrow('Tickets must be from the same organization');
    });
  });
});

/**
 * Merge duplicate ticket into original
 * - Closes the duplicate
 * - Moves comments and watchers to original
 * - Creates merge events
 */
import { mergeDuplicateTicket } from '../services/ticket-merge.service';
