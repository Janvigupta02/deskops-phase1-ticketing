# DeskOps Phase 1 Design Document
**Client:** Pellbrook Dental Collective  
**Version:** 1.0  
**Date:** 14 November 2026  
**Status:** Approved by Mentor

---

## 1. Organisation Model

**Based on PRD Section 4.1 (FR-1.01)**

### Tenant-level Scoping with Property-level Permissions

The system implements a multi-tenant architecture where each facilities management company operates as an isolated tenant. Within each tenant, **roles and permissions can be scoped to specific properties** (e.g., specific dental clinics, rooms, or chairs) rather than applying uniformly across the entire tenant, ensuring **granular control over resource access**.

### Hierarchy Structure

```
Organization (Tenant)
└── Properties (Dental Clinics)
    └── Units (Rooms / Dental Chairs)
        └── Patients / Residents
```

### Key Entities

- **Organization**: The root tenant entity representing a facilities management company (e.g., Pellbrook Dental Collective)
- **Property**: A physical location managed by the organization (e.g., Downtown Clinic, Eastside Branch)
- **Unit**: A specific resource within a property (e.g., Room 101, Chair A, Treatment Room 3)
- **Patient/Resident**: End users who create tickets for their assigned unit
- **Staff/Technician**: Service providers with skills, assigned to specific properties
- **Manager/Admin**: Administrative users with full or property-scoped control

### Property-Level Role Assignment

Users are assigned roles at the **property level**, enabling scenarios such as:
- A Manager overseeing only "Downtown Clinic" but not "Eastside Branch"
- A Technician servicing specific properties based on their skill set and location
- Residents/Patients linked to specific units within properties

---

## 2. Proposed Permission Matrix

### DeskOps – Permission Matrix

| Action | Tenant Admin | Property Manager | Resident | Technician |
|---|---|---|---|---|
| Raise/Create Ticket | Yes | Yes | Yes | No |
| View Ticket | Yes | Yes* | Yes* | Yes* |
| Triage Ticket | Yes | Yes* | No | No |
| Assign Technician | Yes | Yes* | No | No |
| Update Ticket Status | Yes | Yes* | No | Yes* |
| Resolve Ticket | Yes | Yes* | No | Yes* |
| Close Ticket | Yes | Yes* | No | Yes* |
| Reopen Ticket | Yes | Yes* | Yes* | No |
| Add Internal Comment | Yes | Yes* | No | Yes* |
| Add Public Comment | Yes | Yes* | Yes* | Yes* |
| Merge Duplicate Tickets | Yes | Yes* | No | No |

**Legend:**
- **Yes** = Permitted
- **No** = Denied
- **Yes*** = Permitted only within assigned scope

### Scope Rules

- **Tenant Admin:** Within their own tenant.
- **Property Manager:** Within assigned properties.
- **Resident:** Tickets related to their own unit.
- **Technician:** Tickets assigned to them or explicitly shared with them.

### Permission Details

**Tenant Admin:**
- Full control over all tickets and operations within their tenant
- Can create, view, triage, assign, update, resolve, close, and reopen tickets
- Can add both internal and public comments
- Can merge duplicate tickets
- Has unrestricted access across all properties in the tenant

**Property Manager:**
- Property-scoped permissions (only within assigned properties)
- Can create tickets on behalf of residents
- Can triage and assign tickets to technicians within their properties
- Can update ticket status, resolve, close, and reopen tickets
- Can add both internal and public comments
- Can merge duplicate tickets within their property scope

**Resident:**
- Limited to tickets related to their own unit/room/chair
- Can create new tickets for their assigned unit
- Can view only their own tickets
- Can reopen their own tickets within the reopen window
- Can add public comments (visible to staff)
- Cannot add internal comments or perform any assignment/triage operations

**Technician:**
- Can view only tickets assigned to them or explicitly shared
- Cannot create tickets (tickets are created by residents or managers)
- Cannot triage or assign tickets (manager-controlled)
- Can update ticket status, resolve, and close tickets assigned to them
- Cannot reopen tickets
- Can add both internal comments (staff coordination) and public comments (visible to resident)
- Cannot merge duplicate tickets

**Note:** Some permissions are proposed and require final confirmation against the PRD and team decisions.
---

## 3. Ticket State Machine & Business Rules

### States

1. **Open** - Newly created ticket, awaiting triage and assignment
2. **In Progress** - Ticket assigned to a technician and actively being worked on
3. **Resolved** - Work completed by technician, awaiting confirmation
4. **Closed** - Ticket confirmed complete and archived

### Critical Business Rule (Pellbrook Dental Collective)

**Room Occupancy Constraint:**
> A patient's ticket must be linked to a specific clinic chair or room, and **a room cannot have two open tickets at once**. Assigning a second ticket to a busy room must be rejected.

This rule ensures that no two active service requests overlap for the same physical resource (chair/room).

---

## 4. State Transitions & Who May Trigger Them

### Open → In Progress

**Who:** Manager or Admin  
**Action:** Assigns the ticket to a specific technician/staff member  
**Validation:**
- Target room/chair must not have any other ticket in Open or In Progress state
- Assigned technician must have the required skills
- Technician must be assigned to the property containing the unit
- **Business Rule Check:** System MUST reject assignment if the room already has an active ticket

**Implementation:**
```sql
-- Pseudo-validation query
SELECT COUNT(*) FROM tickets 
WHERE unit_id = :target_unit_id 
AND status IN ('open', 'in_progress')
-- If count > 0, reject the new assignment
```

---

### In Progress → Resolved

**Who:** Assigned technician only  
**Action:** Marks the service/issue as completed  
**Validation:**
- Only the technician currently assigned to the ticket can resolve it
- Technician must provide resolution notes or completion confirmation

---

### Resolved → Closed

**Who:** Manager, Admin, or Patient/Resident  
**Action:** Confirms work is satisfactory and closes the ticket  
**Validation:**
- Patient can close their own ticket after reviewing resolution
- Manager/Admin can close any ticket in their property scope
- Closed tickets can be reopened within a configurable time window (e.g., 7 days)

---

### State Transition Diagram

```
    ┌──────┐
    │ Open │
    └──┬───┘
       │ Manager/Admin assigns
       │ (Room availability check)
       ▼
┌──────────────┐
│ In Progress  │
└──────┬───────┘
       │ Technician resolves
       ▼
  ┌──────────┐
  │ Resolved │
  └────┬─────┘
       │ Manager/Admin/Patient closes
       ▼
   ┌────────┐
   │ Closed │
   └────────┘
```

---

## 5. Event History & Audit Logging

### Requirements

Every state change, assignment, comment addition, and critical action must be recorded in an **immutable event log table**.

### Event Log Schema

| Field | Type | Description |
|-------|------|-------------|
| `event_id` | UUID | Unique identifier for the event |
| `timestamp` | DateTime | When the event occurred (UTC) |
| `actor_id` | UUID | User who performed the action |
| `action_type` | Enum | Type of action (state_change, assignment, comment, merge, etc.) |
| `ticket_id` | UUID | Related ticket |
| `previous_state` | Enum | State before the action (if applicable) |
| `new_state` | Enum | State after the action (if applicable) |
| `metadata` | JSONB | Additional context (e.g., assignment details, comment text, reason) |

### Logged Actions

1. **State Transitions** - Every move from one state to another
2. **Assignments** - When a ticket is assigned or reassigned to a technician
3. **Comments** - Both internal and public comments (with visibility flag)
4. **Ticket Creation** - Initial ticket creation with all metadata
5. **Ticket Merge** - When duplicate tickets are merged
6. **Reopen Actions** - When closed tickets are reopened
7. **Validation Failures** - Room occupancy violations logged for audit

### Audit Trail Example

```json
{
  "event_id": "a1b2c3d4-...",
  "timestamp": "2026-11-16T10:30:00Z",
  "actor_id": "manager-001",
  "action_type": "state_change",
  "ticket_id": "ticket-123",
  "previous_state": "open",
  "new_state": "in_progress",
  "metadata": {
    "assigned_to": "tech-005",
    "room_id": "chair-A-clinic-1",
    "validation_passed": true
  }
}
```

---

## 6. Database Schema (Core Entities)

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB
);
```

### Properties Table
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Units Table
```sql
CREATE TABLE units (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  unit_number VARCHAR(50) NOT NULL,
  unit_type VARCHAR(50), -- 'room', 'chair', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(property_id, unit_number)
);
```

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50), -- 'admin', 'manager', 'technician', 'resident'
  property_ids UUID[], -- Array of property IDs for scoped roles
  skills JSONB, -- For technicians
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tickets Table
```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  property_id UUID REFERENCES properties(id),
  unit_id UUID REFERENCES units(id),
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL, -- 'open', 'in_progress', 'resolved', 'closed'
  priority VARCHAR(20),
  title VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  INDEX idx_org_status (organization_id, status),
  INDEX idx_unit_status (unit_id, status)
);
```

### Ticket Events Table
```sql
CREATE TABLE ticket_events (
  event_id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  actor_id UUID REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  previous_state VARCHAR(50),
  new_state VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

---

## 7. API Design (Key Endpoints)

### Ticket Assignment Endpoint
```
POST /api/tickets/:id/assign
Authorization: Manager/Admin only

Request Body:
{
  "technician_id": "uuid",
  "notes": "string"
}

Validations:
1. Check user has manager/admin role
2. Check technician has required skills
3. Check technician is assigned to the property
4. **CHECK: Target unit has no other open/in_progress tickets**
5. Use optimistic locking (row version) for concurrency control

Response (Success):
{
  "ticket_id": "uuid",
  "status": "in_progress",
  "assigned_to": "uuid",
  "assigned_at": "timestamp"
}

Response (Room Busy - 409 Conflict):
{
  "error": "ROOM_OCCUPIED",
  "message": "Room/Chair already has an active ticket",
  "conflicting_ticket_id": "uuid"
}
```

---

## 8. Concurrency Control Strategy

### Problem
20 parallel assignment requests on the same ticket should result in exactly **one** successful assignment.

### Solution: Optimistic Locking + Database Constraints

1. Add `version` column to `tickets` table
2. Every UPDATE includes `WHERE version = :current_version`
3. Increment version on each update
4. Failed updates (version mismatch) return 409 Conflict
5. Additionally, use PostgreSQL row-level locks (`SELECT FOR UPDATE`) during assignment validation

### Implementation Pattern
```typescript
// Pseudo-code
async function assignTicket(ticketId, technicianId) {
  const tx = await db.transaction();
  
  try {
    // Lock the ticket row
    const ticket = await tx.tickets.findUnique({
      where: { id: ticketId },
      lock: 'FOR UPDATE'
    });
    
    // Check room availability
    const busyRoom = await tx.tickets.count({
      where: {
        unit_id: ticket.unit_id,
        status: { in: ['open', 'in_progress'] }
      }
    });
    
    if (busyRoom > 0) {
      throw new RoomOccupiedError();
    }
    
    // Perform assignment
    await tx.tickets.update({
      where: { 
        id: ticketId,
        version: ticket.version 
      },
      data: {
        assigned_to: technicianId,
        status: 'in_progress',
        version: ticket.version + 1
      }
    });
    
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
```

---

## 9. Real-Time Updates (Socket.io)

### Events to Emit

- `ticket:created` - New ticket created
- `ticket:assigned` - Ticket assigned to technician
- `ticket:status_changed` - State transition occurred
- `ticket:comment_added` - New comment added
- `ticket:merged` - Duplicate tickets merged

### Room-Based Subscriptions

Users subscribe to Socket.io rooms based on:
- Organization ID (tenant isolation)
- Property IDs (property-scoped users)
- User ID (for personal notifications)

**Example:**
```javascript
// On user authentication
socket.join(`org:${orgId}`);
socket.join(`property:${propertyId}`);
socket.join(`user:${userId}`);

// On ticket assignment
io.to(`org:${ticket.organizationId}`)
  .to(`user:${ticket.assignedTo}`)
  .emit('ticket:assigned', ticketData);
```

---

## 10. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Backend | Node.js 22 + TypeScript + Express |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Queue | Redis + BullMQ |
| Real-time | Socket.io |
| File Storage | AWS S3 (presigned URLs) |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | Render |

---

## 11. Acceptance Criteria Review

✅ **Design document has sections for organisation model, ticket state machine and event history**  
✅ **Each state transition lists who may trigger it**  
✅ **Critical business rule (room occupancy) documented and validated**  
✅ **Permission matrix clearly defined**  
✅ **Multi-tenant isolation strategy outlined**  
✅ **Concurrency control approach specified**

---

*End of Design Document*
