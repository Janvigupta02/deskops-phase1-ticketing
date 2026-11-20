/**
 * Ticket State Machine
 * 
 * Based on the design document, this module defines allowed state transitions
 * for the DeskOps ticketing system.
 * 
 * States: open, in_progress, resolved, closed
 * 
 * Transition rules:
 * - open → in_progress (Manager/Admin assigns ticket)
 * - in_progress → resolved (Technician marks complete)
 * - resolved → closed (Manager/Admin/Resident confirms)
 * - closed → open (Reopen within window)
 */

// TypeScript enum for ticket states
export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

// Allowed state transitions map
// Key: current state, Value: array of allowed next states
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [
    TicketStatus.IN_PROGRESS  // Manager/Admin assigns ticket
  ],
  
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.RESOLVED     // Technician marks complete
  ],
  
  [TicketStatus.RESOLVED]: [
    TicketStatus.CLOSED       // Manager/Admin/Resident confirms
  ],
  
  [TicketStatus.CLOSED]: [
    TicketStatus.OPEN         // Reopen within configured window
  ]
};

/**
 * Check if a state transition is valid
 * @param currentState - The current ticket state
 * @param nextState - The desired next state
 * @returns true if transition is allowed, false otherwise
 */
export function isTransitionAllowed(
  currentState: TicketStatus,
  nextState: TicketStatus
): boolean {
  const allowedNextStates = ALLOWED_TRANSITIONS[currentState];
  return allowedNextStates.includes(nextState);
}

/**
 * Get all allowed next states for a given current state
 * @param currentState - The current ticket state
 * @returns Array of allowed next states
 */
export function getAllowedNextStates(currentState: TicketStatus): TicketStatus[] {
  return ALLOWED_TRANSITIONS[currentState] || [];
}

/**
 * State transition error for illegal transitions
 */
export class IllegalTransitionError extends Error {
  public readonly statusCode: number = 400;
  public readonly currentState: TicketStatus;
  public readonly attemptedState: TicketStatus;
  public readonly allowedStates: TicketStatus[];

  constructor(currentState: TicketStatus, attemptedState: TicketStatus) {
    const allowedStates = getAllowedNextStates(currentState);
    super(
      `Illegal state transition: cannot move from '${currentState}' to '${attemptedState}'. ` +
      `Allowed transitions: [${allowedStates.join(', ')}]`
    );
    
    this.name = 'IllegalTransitionError';
    this.currentState = currentState;
    this.attemptedState = attemptedState;
    this.allowedStates = allowedStates;
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Format error for API response (uniform error format)
   */
  toJSON() {
    return {
      error: {
        code: 'ILLEGAL_STATE_TRANSITION',
        message: this.message,
        details: {
          currentState: this.currentState,
          attemptedState: this.attemptedState,
          allowedTransitions: this.allowedStates
        }
      }
    };
  }
}

/**
 * Validate and perform a state transition
 * @param currentState - The current ticket state
 * @param nextState - The desired next state
 * @throws IllegalTransitionError if transition is not allowed
 */
export function validateTransition(
  currentState: TicketStatus,
  nextState: TicketStatus
): void {
  if (!isTransitionAllowed(currentState, nextState)) {
    throw new IllegalTransitionError(currentState, nextState);
  }
}

// Example usage and validation
if (require.main === module) {
  console.log('=== Ticket State Machine - Allowed Transitions ===\n');
  
  Object.entries(ALLOWED_TRANSITIONS).forEach(([state, nextStates]) => {
    console.log(`${state}:`);
    nextStates.forEach(next => console.log(`  → ${next}`));
    console.log('');
  });

  console.log('\n=== Testing Transitions ===\n');
  
  // Legal transition
  try {
    validateTransition(TicketStatus.OPEN, TicketStatus.IN_PROGRESS);
    console.log('✓ Legal: open → in_progress');
  } catch (error) {
    console.error('✗ Unexpected error:', error);
  }

  // Illegal transition
  try {
    validateTransition(TicketStatus.OPEN, TicketStatus.CLOSED);
    console.log('✗ Should have thrown error for open → closed');
  } catch (error) {
    if (error instanceof IllegalTransitionError) {
      console.log('✓ Illegal: open → closed (correctly rejected)');
      console.log('  Error:', error.message);
    }
  }
}
