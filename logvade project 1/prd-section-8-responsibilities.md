# PRD Section 8 — Module and Platform Responsibilities

**Status:** Draft, inferred from the linked DeskOps design document. The source document’s section 8 describes concurrency control; it does not contain this responsibility table. The assignments below use the design document’s core entities, permission matrix, API/state-machine requirements, and technology stack. Confirm the owner split with the team before finalizing.

| Intern / owner | FR ownership | Module responsibility | Platform responsibility |
|---|---|---|---|
| Engineer A | FR-1.01, FR-1.05 | Organization/property/unit scoping and authorized ticket state transitions | PostgreSQL schema, tenant-scoped data constraints, and Prisma migrations |
| Engineer B | FR-1.02, FR-1.06 | Role/property permissions and immutable ticket event history | Node.js/Express authorization and ticket API endpoints |
| Engineer C | FR-1.03, FR-1.07 | Ticket intake, unit association, and public/internal comments | React 18 + TypeScript ticket and comment UI |
| Engineer D | FR-1.04, FR-1.08 | Assignment validation, room occupancy, and concurrency protection | Docker-based deployment and GitHub Actions CI for assignment/integration checks |

## Source-derived responsibility notes

- The design document describes tenant/property/unit hierarchy and scoped permissions in sections 1–2.
- Ticket assignment, transitions, event history, and concurrency requirements are in sections 3–8.
- The platform assignments draw on the design document’s technology stack summary in section 10.
- The FR numbering and balanced A–D ownership above are proposed for this draft; they were not present in the linked source.

