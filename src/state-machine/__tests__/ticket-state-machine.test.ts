/**
 * Tests for Ticket State Machine
 * 
 * Covers legal and illegal state transitions as per acceptance criteria
 */

import {
  TicketStatus,
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  getAllowedNextStates,
  validateTransition,
  IllegalTransitionError
} from '../ticket-state-machine';

describe('Ticket State Machine', () => {
  describe('ALLOWED_TRANSITIONS map', () => {
    it('should define transitions for all states', () => {
      expect(ALLOWED_TRANSITIONS[TicketStatus.OPEN]).toBeDefined();
      expect(ALLOWED_TRANSITIONS[TicketStatus.IN_PROGRESS]).toBeDefined();
      expect(ALLOWED_TRANSITIONS[TicketStatus.RESOLVED]).toBeDefined();
      expect(ALLOWED_TRANSITIONS[TicketStatus.CLOSED]).toBeDefined();
    });

    it('should allow open → in_progress', () => {
      expect(ALLOWED_TRANSITIONS[TicketStatus.OPEN]).toContain(TicketStatus.IN_PROGRESS);
    });

    it('should allow in_progress → resolved', () => {
      expect(ALLOWED_TRANSITIONS[TicketStatus.IN_PROGRESS]).toContain(TicketStatus.RESOLVED);
    });

    it('should allow resolved → closed', () => {
      expect(ALLOWED_TRANSITIONS[TicketStatus.RESOLVED]).toContain(TicketStatus.CLOSED);
    });

    it('should allow closed → open (reopen)', () => {
      expect(ALLOWED_TRANSITIONS[TicketStatus.CLOSED]).toContain(TicketStatus.OPEN);
    });
  });

  describe('isTransitionAllowed', () => {
    describe('Legal transitions', () => {
      it('should allow open → in_progress', () => {
        expect(isTransitionAllowed(TicketStatus.OPEN, TicketStatus.IN_PROGRESS)).toBe(true);
      });

      it('should allow in_progress → resolved', () => {
        expect(isTransitionAllowed(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED)).toBe(true);
      });

      it('should allow resolved → closed', () => {
        expect(isTransitionAllowed(TicketStatus.RESOLVED, TicketStatus.CLOSED)).toBe(true);
      });

      it('should allow closed → open (reopen)', () => {
        expect(isTransitionAllowed(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(true);
      });
    });

    describe('Illegal transitions', () => {
      it('should reject open → closed', () => {
        expect(isTransitionAllowed(TicketStatus.OPEN, TicketStatus.CLOSED)).toBe(false);
      });

      it('should reject open → resolved', () => {
        expect(isTransitionAllowed(TicketStatus.OPEN, TicketStatus.RESOLVED)).toBe(false);
      });

      it('should reject in_progress → open', () => {
        expect(isTransitionAllowed(TicketStatus.IN_PROGRESS, TicketStatus.OPEN)).toBe(false);
      });

      it('should reject in_progress → closed', () => {
        expect(isTransitionAllowed(TicketStatus.IN_PROGRESS, TicketStatus.CLOSED)).toBe(false);
      });

      it('should reject resolved → open', () => {
        expect(isTransitionAllowed(TicketStatus.RESOLVED, TicketStatus.OPEN)).toBe(false);
      });

      it('should reject resolved → in_progress', () => {
        expect(isTransitionAllowed(TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS)).toBe(false);
      });

      it('should reject closed → in_progress', () => {
        expect(isTransitionAllowed(TicketStatus.CLOSED, TicketStatus.IN_PROGRESS)).toBe(false);
      });

      it('should reject closed → resolved', () => {
        expect(isTransitionAllowed(TicketStatus.CLOSED, TicketStatus.RESOLVED)).toBe(false);
      });
    });
  });

  describe('getAllowedNextStates', () => {
    it('should return correct next states for open', () => {
      const nextStates = getAllowedNextStates(TicketStatus.OPEN);
      expect(nextStates).toEqual([TicketStatus.IN_PROGRESS]);
    });

    it('should return correct next states for in_progress', () => {
      const nextStates = getAllowedNextStates(TicketStatus.IN_PROGRESS);
      expect(nextStates).toEqual([TicketStatus.RESOLVED]);
    });

    it('should return correct next states for resolved', () => {
      const nextStates = getAllowedNextStates(TicketStatus.RESOLVED);
      expect(nextStates).toEqual([TicketStatus.CLOSED]);
    });

    it('should return correct next states for closed', () => {
      const nextStates = getAllowedNextStates(TicketStatus.CLOSED);
      expect(nextStates).toEqual([TicketStatus.OPEN]);
    });
  });

  describe('validateTransition', () => {
    describe('Legal transitions', () => {
      it('should not throw for open → in_progress', () => {
        expect(() => {
          validateTransition(TicketStatus.OPEN, TicketStatus.IN_PROGRESS);
        }).not.toThrow();
      });

      it('should not throw for in_progress → resolved', () => {
        expect(() => {
          validateTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED);
        }).not.toThrow();
      });

      it('should not throw for resolved → closed', () => {
        expect(() => {
          validateTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED);
        }).not.toThrow();
      });

      it('should not throw for closed → open', () => {
        expect(() => {
          validateTransition(TicketStatus.CLOSED, TicketStatus.OPEN);
        }).not.toThrow();
      });
    });

    describe('Illegal transitions', () => {
      it('should throw IllegalTransitionError for open → closed', () => {
        expect(() => {
          validateTransition(TicketStatus.OPEN, TicketStatus.CLOSED);
        }).toThrow(IllegalTransitionError);
      });

      it('should throw IllegalTransitionError for open → resolved', () => {
        expect(() => {
          validateTransition(TicketStatus.OPEN, TicketStatus.RESOLVED);
        }).toThrow(IllegalTransitionError);
      });

      it('should throw IllegalTransitionError for in_progress → closed', () => {
        expect(() => {
          validateTransition(TicketStatus.IN_PROGRESS, TicketStatus.CLOSED);
        }).toThrow(IllegalTransitionError);
      });
    });
  });

  describe('IllegalTransitionError', () => {
    it('should have correct properties', () => {
      const error = new IllegalTransitionError(TicketStatus.OPEN, TicketStatus.CLOSED);
      
      expect(error.name).toBe('IllegalTransitionError');
      expect(error.statusCode).toBe(400);
      expect(error.currentState).toBe(TicketStatus.OPEN);
      expect(error.attemptedState).toBe(TicketStatus.CLOSED);
      expect(error.allowedStates).toEqual([TicketStatus.IN_PROGRESS]);
    });

    it('should have descriptive error message', () => {
      const error = new IllegalTransitionError(TicketStatus.OPEN, TicketStatus.CLOSED);
      
      expect(error.message).toContain('Illegal state transition');
      expect(error.message).toContain('open');
      expect(error.message).toContain('closed');
      expect(error.message).toContain('in_progress');
    });

    it('should format to uniform error JSON format', () => {
      const error = new IllegalTransitionError(TicketStatus.OPEN, TicketStatus.CLOSED);
      const json = error.toJSON();

      expect(json).toHaveProperty('error');
      expect(json.error).toHaveProperty('code', 'ILLEGAL_STATE_TRANSITION');
      expect(json.error).toHaveProperty('message');
      expect(json.error).toHaveProperty('details');
      expect(json.error.details).toHaveProperty('currentState', TicketStatus.OPEN);
      expect(json.error.details).toHaveProperty('attemptedState', TicketStatus.CLOSED);
      expect(json.error.details).toHaveProperty('allowedTransitions');
    });

    it('should return 400 status code for API responses', () => {
      const error = new IllegalTransitionError(TicketStatus.IN_PROGRESS, TicketStatus.OPEN);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Complete state machine flow', () => {
    it('should validate complete ticket lifecycle', () => {
      // open → in_progress
      expect(() => validateTransition(TicketStatus.OPEN, TicketStatus.IN_PROGRESS)).not.toThrow();
      
      // in_progress → resolved
      expect(() => validateTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED)).not.toThrow();
      
      // resolved → closed
      expect(() => validateTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED)).not.toThrow();
      
      // closed → open (reopen)
      expect(() => validateTransition(TicketStatus.CLOSED, TicketStatus.OPEN)).not.toThrow();
    });

    it('should reject skipping states', () => {
      // Cannot skip from open to closed
      expect(() => validateTransition(TicketStatus.OPEN, TicketStatus.CLOSED)).toThrow();
      
      // Cannot skip from open to resolved
      expect(() => validateTransition(TicketStatus.OPEN, TicketStatus.RESOLVED)).toThrow();
      
      // Cannot skip from in_progress to closed
      expect(() => validateTransition(TicketStatus.IN_PROGRESS, TicketStatus.CLOSED)).toThrow();
    });
  });
});
