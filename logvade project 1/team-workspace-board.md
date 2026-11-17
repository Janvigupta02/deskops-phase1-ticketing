# Team Workspace Board — DeskOps Phase 1

**Status:** Draft  
**Basis:** Inferred from `docs/design.md` (sections 1–9). The linked document does not include the source PRD FR list or the agreed Engineer A–D split. Owners below are a balanced provisional allocation; confirm against the team agreement before treating them as final.

## Task cards

### FR-1.01 — Tenant, property, and unit scoping
- **Owner:** Engineer A
- **Acceptance criteria:**
  - Organizations contain properties, and properties contain units.
  - A unit number cannot be duplicated within the same property.
  - Tenant-scoped queries cannot return another tenant’s properties, units, or tickets.

### FR-1.02 — Property-scoped roles and permissions
- **Owner:** Engineer B
- **Acceptance criteria:**
  - Tenant Admin, Property Manager, Resident, and Technician actions follow the permission matrix in the design.
  - Property-scoped users can access only resources within their assigned scope; residents can access only their own unit’s tickets.
  - Unauthorized actions are rejected and do not mutate ticket data.

### FR-1.03 — Ticket intake and unit association
- **Owner:** Engineer C
- **Acceptance criteria:**
  - Residents and managers can create a ticket for a unit in their permitted scope.
  - A new ticket records its organization, property, unit, creator, title, and initial `open` status.
  - Invalid or out-of-scope unit references are rejected without creating a ticket.

### FR-1.04 — Ticket assignment validation
- **Owner:** Engineer D
- **Acceptance criteria:**
  - Only a manager or admin in scope can assign a ticket.
  - Assignment is rejected if the technician lacks required skills or is not assigned to the ticket’s property.
  - Assignment is rejected with a conflict response if another ticket for the same unit is `open` or `in_progress`.
  - A successful assignment records the technician and moves the ticket to `in_progress`.

### FR-1.05 — Authorized ticket state transitions
- **Owner:** Engineer A
- **Acceptance criteria:**
  - Only the documented transitions are accepted: `open` → `in_progress`, `in_progress` → `resolved`, `resolved` → `closed`, and an eligible `closed` → `open` reopen.
  - Each transition is allowed only for the roles described in the design.
  - Resolving requires resolution notes or completion confirmation; reopening is rejected outside the configured reopen window.
  - Invalid transitions return an error and leave the ticket unchanged.

### FR-1.06 — Immutable ticket event history
- **Owner:** Engineer B
- **Acceptance criteria:**
  - Ticket creation, state changes, assignments, comments, merges, reopen actions, and room-occupancy validation failures create event records.
  - Each event records its actor, timestamp, action type, ticket, applicable states, and metadata.
  - Event records cannot be updated or deleted through application operations.

### FR-1.07 — Public and internal comments
- **Owner:** Engineer C
- **Acceptance criteria:**
  - Residents can add public comments to tickets they may access.
  - Authorized staff can add internal comments; residents cannot create or view internal comments.
  - Each comment records its author, visibility, ticket, and timestamp, and is represented in the event history.

### FR-1.08 — Concurrent assignment protection
- **Owner:** Engineer D
- **Acceptance criteria:**
  - Ticket updates use a version check; a stale concurrent update receives a conflict response and does not overwrite the winning update.
  - Assignment validation and update execute transactionally with the documented row-locking strategy.
  - In a test with 20 concurrent assignment requests for the same ticket version, exactly one succeeds and the others receive conflicts.
  - No two active tickets can be assigned to the same unit.

