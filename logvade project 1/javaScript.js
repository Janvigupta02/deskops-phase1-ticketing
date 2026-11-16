
    <script>
        /**
         * 1. TICKET STATUS RULES
         */
        const STATES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

        const VALID_TRANSITIONS = {
            OPEN: ['IN_PROGRESS', 'CLOSED'],
            IN_PROGRESS: ['RESOLVED', 'OPEN'],
            RESOLVED: ['CLOSED', 'IN_PROGRESS'],
            CLOSED: []
        };

        const STATE_STYLES = {
            OPEN: {
                badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                dot: 'bg-sky-400',
                nodeStroke: '#38bdf8'
            },
            IN_PROGRESS: {
                badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                dot: 'bg-amber-400',
                nodeStroke: '#fbbf24'
            },
            RESOLVED: {
                badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                dot: 'bg-emerald-400',
                nodeStroke: '#34d399'
            },
            CLOSED: {
                badge: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
                dot: 'bg-slate-400',
                nodeStroke: '#94a3b8'
            }
        };

        const NODE_CENTERS = {
            OPEN: { x: 90, y: 91 },
            IN_PROGRESS: { x: 360, y: 91 },
            RESOLVED: { x: 610, y: 91 },
            CLOSED: { x: 360, y: 193 }
        };

        const $ = (id) => document.getElementById(id);

        const ensureDomReady = (callback) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', callback, { once: true });
                return;
            }
            callback();
        };

        /**
         * 2. IN-MEMORY DATA
         */
        let tickets = [];
        let auditLogs = [];
        let selectedTicketId = 101;
        let nextTicketId = 104;
        let nextEventId = 1;
        let lastInsertedEventId = null;

        function isValidState(state) {
            return STATES.includes(state);
        }

        function getActiveTicket() {
            return tickets.find((ticket) => ticket.id === selectedTicketId) || null;
        }

        function seedInitialData() {
            const baseTime = Date.now() - 1000 * 60 * 45;

            tickets = [
                {
                    id: 101,
                    title: 'Investigate API rate-limiter memory leak',
                    status: 'OPEN',
                    updated_at: new Date(baseTime).toISOString()
                },
                {
                    id: 102,
                    title: 'Add OAuth2 PKCE support for mobile clients',
                    status: 'IN_PROGRESS',
                    updated_at: new Date(baseTime + 1000 * 60 * 15).toISOString()
                },
                {
                    id: 103,
                    title: 'Upgrade PostgreSQL cluster to v16.2',
                    status: 'RESOLVED',
                    updated_at: new Date(baseTime + 1000 * 60 * 30).toISOString()
                }
            ];

            auditLogs = [
                {
                    id: 1,
                    ticket_id: 102,
                    from_state: 'OPEN',
                    to_state: 'IN_PROGRESS',
                    actor: 'Bob (Engineer)',
                    timestamp: new Date(baseTime + 1000 * 60 * 15).toISOString()
                },
                {
                    id: 2,
                    ticket_id: 103,
                    from_state: 'OPEN',
                    to_state: 'IN_PROGRESS',
                    actor: 'Alice (Support)',
                    timestamp: new Date(baseTime + 1000 * 60 * 20).toISOString()
                },
                {
                    id: 3,
                    ticket_id: 103,
                    from_state: 'IN_PROGRESS',
                    to_state: 'RESOLVED',
                    actor: 'Bob (Engineer)',
                    timestamp: new Date(baseTime + 1000 * 60 * 30).toISOString()
                }
            ];

            selectedTicketId = 101;
            nextTicketId = 104;
            nextEventId = 4;
            lastInsertedEventId = null;
        }

        /**
         * 3. SIMULATED API ENDPOINT
         * PATCH /api/v1/tickets/:id/status
         */
        function apiUpdateTicketStatus(ticketId, targetState, actor) {
            const startTime = performance.now();
            const ticket = tickets.find((item) => item.id === ticketId);

            if (!ticket) {
                return {
                    status: 404,
                    statusText: '404 Not Found',
                    latency: Math.max(4, Math.round(performance.now() - startTime + 12)),
                    body: {
                        error: 'NotFoundError',
                        message: `Ticket #${ticketId} does not exist.`
                    }
                };
            }

            if (!isValidState(targetState)) {
                return {
                    status: 422,
                    statusText: '422 Unprocessable Entity',
                    latency: Math.max(6, Math.round(performance.now() - startTime + 14)),
                    body: {
                        error: 'IllegalStateTransitionError',
                        status_code: 422,
                        ticket_id: ticket.id,
                        current_state: ticket.status,
                        attempted_state: targetState,
                        allowed_transitions: VALID_TRANSITIONS[ticket.status] || [],
                        actor,
                        detail: `Unknown status '${targetState}'.`,
                        audit_log_written: false
                    }
                };
            }

            const currentState = ticket.status;
            const allowedTargets = VALID_TRANSITIONS[currentState] || [];
            const isLegal = allowedTargets.includes(targetState);

            if (!isLegal) {
                const reason = currentState === targetState
                    ? `Ticket is already in '${currentState}' state (self-transitions are disallowed).`
                    : currentState === 'CLOSED'
                        ? `'CLOSED' is a terminal state and allows no outbound transitions.`
                        : `Cannot transition ticket from '${currentState}' to '${targetState}'.`;

                return {
                    status: 422,
                    statusText: '422 Unprocessable Entity',
                    latency: Math.max(6, Math.round(performance.now() - startTime + 14)),
                    body: {
                        error: 'IllegalStateTransitionError',
                        status_code: 422,
                        ticket_id: ticket.id,
                        current_state: currentState,
                        attempted_state: targetState,
                        allowed_transitions: allowedTargets,
                        actor,
                        detail: reason,
                        audit_log_written: false
                    }
                };
            }

            const nowIso = new Date().toISOString();
            ticket.status = targetState;
            ticket.updated_at = nowIso;

            const newEvent = {
                id: nextEventId++,
                ticket_id: ticket.id,
                from_state: currentState,
                to_state: targetState,
                actor,
                timestamp: nowIso
            };

            auditLogs.unshift(newEvent);
            lastInsertedEventId = newEvent.id;

            return {
                status: 200,
                statusText: '200 OK',
                latency: Math.max(9, Math.round(performance.now() - startTime + 18)),
                body: {
                    message: 'State transition committed atomically.',
                    ticket: {
                        id: ticket.id,
                        title: ticket.title,
                        status: ticket.status,
                        updated_at: ticket.updated_at
                    },
                    audit_event_created: newEvent
                }
            };
        }

        /**
         * 4. UI HELPERS
         */
        function renderStateBadge(state) {
            const style = STATE_STYLES[state] || STATE_STYLES.CLOSED;
            return `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${style.badge}">
                    <span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span>
                    ${state}
                </span>
            `;
        }

        function renderTicketSelector() {
            const select = $('#ticket-select');
            if (!select) return;

            select.innerHTML = tickets.map((ticket) => `
                <option value="${ticket.id}" ${ticket.id === selectedTicketId ? 'selected' : ''}>
                    #${ticket.id} — ${ticket.title} [${ticket.status}]
                </option>
            `).join('');

            const activeTicket = getActiveTicket();
            if (!activeTicket) return;

            $('#current-ticket-title').textContent = `#${activeTicket.id}: ${activeTicket.title}`;
            $('#current-state-badge').innerHTML = renderStateBadge(activeTicket.status);
            $('#http-request-line').textContent = `PATCH /api/v1/tickets/${activeTicket.id}/status`;
        }

        function renderTransitionButtons() {
            const container = $('#transition-buttons-grid');
            if (!container) return;

            const activeTicket = getActiveTicket();
            if (!activeTicket) return;

            const currentState = activeTicket.status;
            const allowedTargets = VALID_TRANSITIONS[currentState] || [];

            container.innerHTML = STATES.map((targetState) => {
                const isLegal = allowedTargets.includes(targetState);
                const isSame = targetState === currentState;

                const btnClasses = isLegal
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-950 hover:bg-rose-950/30 border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300';

                const tagHtml = isLegal
                    ? '<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">LEGAL</span>'
                    : `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400/90">${isSame ? 'SELF' : 'ILLEGAL'}</span>`;

                return `
                    <button
                        type="button"
                        data-target-state="${targetState}"
                        class="transition-trigger-btn flex flex-col items-start justify-between p-3 rounded-lg border transition-all duration-150 cursor-pointer text-left group ${btnClasses}">
                        <div class="w-full flex items-center justify-between mb-1">
                            <span class="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">TO &rarr;</span>
                            ${tagHtml}
                        </div>
                        <span class="font-mono text-xs font-semibold tracking-tight">${targetState}</span>
                    </button>
                `;
            }).join('');

            document.querySelectorAll('.transition-trigger-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const targetState = btn.getAttribute('data-target-state');
                    if (targetState) {
                        handleTransitionAttempt(targetState);
                    }
                });
            });
        }

        function renderMatrixTable() {
            const tbody = $('#matrix-table-body');
            if (!tbody) return;

            const activeTicket = getActiveTicket();
            const currentState = activeTicket ? activeTicket.status : null;

            tbody.innerHTML = STATES.map((fromState) => {
                const isRowActive = fromState === currentState;
                const allowed = VALID_TRANSITIONS[fromState] || [];

                const cells = STATES.map((toState) => {
                    const isLegal = allowed.includes(toState);
                    return isLegal
                        ? `
                            <td class="py-2.5 px-3 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px]">
                                    ✓ 200
                                </span>
                            </td>
                        `
                        : `
                            <td class="py-2.5 px-3 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400/80 border border-rose-500/20 text-[11px]">
                                    ✕ 422
                                </span>
                            </td>
                        `;
                }).join('');

                return `
                    <tr class="${isRowActive ? 'bg-indigo-500/10' : 'hover:bg-slate-900/50'} transition-colors">
                        <td class="py-2.5 px-3 font-semibold ${isRowActive ? 'text-indigo-300' : 'text-slate-300'} flex items-center gap-2">
                            ${isRowActive ? '<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-transparent"></span>'}
                            ${fromState}
                        </td>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }

        function updateSvgDiagram(lastTransition = null) {
            const activeTicket = getActiveTicket();
            const currentState = activeTicket ? activeTicket.status : 'OPEN';
            const allowedTargets = VALID_TRANSITIONS[currentState] || [];

            STATES.forEach((state) => {
                const nodeGroup = document.getElementById(`node-${state}`);
                if (!nodeGroup) return;

                const rect = nodeGroup.querySelector('rect');
                if (!rect) return;

                if (state === currentState) {
                    rect.setAttribute('fill', '#1e1b4b');
                    rect.setAttribute('stroke-width', '3');
                } else {
                    rect.setAttribute('fill', '#0f172a');
                    rect.setAttribute('stroke-width', '2');
                }
            });

            const allLegalEdges = [
                'OPEN-IN_PROGRESS',
                'IN_PROGRESS-OPEN',
                'IN_PROGRESS-RESOLVED',
                'RESOLVED-IN_PROGRESS',
                'OPEN-CLOSED',
                'RESOLVED-CLOSED'
            ];

            allLegalEdges.forEach((edgeKey) => {
                const el = document.getElementById(`edge-${edgeKey}`);
                if (!el) return;

                const [from, to] = edgeKey.split('-');

                if (lastTransition && lastTransition.success && lastTransition.from === from && lastTransition.to === to) {
                    el.setAttribute('stroke', '#34d399');
                    el.setAttribute('stroke-width', '3.5');
                    el.setAttribute('marker-end', 'url(#arrow-success)');
                } else if (from === currentState && allowedTargets.includes(to)) {
                    el.setAttribute('stroke', '#10b981');
                    el.setAttribute('stroke-width', '2.5');
                    el.setAttribute('marker-end', 'url(#arrow-active)');
                } else {
                    el.setAttribute('stroke', '#334155');
                    el.setAttribute('stroke-width', '1.75');
                    el.setAttribute('marker-end', 'url(#arrow-default)');
                }
            });

            const illegalFlash = document.getElementById('edge-illegal-flash');
            if (!illegalFlash) return;

            if (lastTransition && !lastTransition.success) {
                const start = NODE_CENTERS[lastTransition.from];
                const end = NODE_CENTERS[lastTransition.to];
                if (start && end) {
                    if (lastTransition.from === lastTransition.to) {
                        illegalFlash.setAttribute('d', `M ${start.x - 15} ${start.y - 22} C ${start.x - 30} ${start.y - 65}, ${start.x + 30} ${start.y - 65}, ${start.x + 15} ${start.y - 22}`);
                    } else {
                        illegalFlash.setAttribute('d', `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
                    }
                    illegalFlash.setAttribute('opacity', '1');
                    setTimeout(() => {
                        illegalFlash.setAttribute('opacity', '0');
                    }, 1600);
                }
            } else {
                illegalFlash.setAttribute('opacity', '0');
            }
        }

        function renderAuditLogs() {
            const tbody = $('#audit-log-body');
            const filter = $('#filter-current-ticket');
            if (!tbody || !filter) return;

            const displayedLogs = filter.checked
                ? auditLogs.filter((log) => log.ticket_id === selectedTicketId)
                : auditLogs;

            $('#audit-count-badge').textContent = `${displayedLogs.length} row${displayedLogs.length === 1 ? '' : 's'}`;

            if (displayedLogs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-slate-500 font-sans text-xs">
                            There are no activity entries here yet. Make a valid update to add one to the log.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = displayedLogs.map((log) => {
                const isNew = log.id === lastInsertedEventId;
                return `
                    <tr class="${isNew ? 'animate-row-insert' : 'hover:bg-slate-900/60'} transition-colors">
                        <td class="py-3 px-4 text-slate-400">#${String(log.id).padStart(4, '0')}</td>
                        <td class="py-3 px-4 text-indigo-300 font-semibold">ticket_${log.ticket_id}</td>
                        <td class="py-3 px-4">${renderStateBadge(log.from_state)}</td>
                        <td class="py-3 px-4">${renderStateBadge(log.to_state)}</td>
                        <td class="py-3 px-4 text-slate-200">${log.actor}</td>
                        <td class="py-3 px-4 text-slate-400">${log.timestamp}</td>
                    </tr>
                `;
            }).join('');
        }

        function renderApiInspector(response) {
            const statusPill = $('#http-status-pill');
            const latencyEl = $('#http-latency');
            const bodyEl = $('#api-response-body');
            const inspectorCard = $('#api-inspector-card');

            if (!statusPill || !latencyEl || !bodyEl || !inspectorCard) return;

            latencyEl.textContent = `${response.latency} ms`;
            bodyEl.textContent = JSON.stringify(response.body, null, 2);

            if (response.status === 200) {
                statusPill.textContent = response.statusText;
                statusPill.className = 'px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40';
                bodyEl.className = 'flex-1 bg-slate-950 border border-emerald-500/30 rounded-b-lg p-3.5 text-xs font-mono text-emerald-200 overflow-x-auto leading-relaxed min-h-[175px] max-h-[240px]';
                return;
            }

            statusPill.textContent = response.statusText;
            statusPill.className = 'px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40';
            bodyEl.className = 'flex-1 bg-slate-950 border border-rose-500/40 rounded-b-lg p-3.5 text-xs font-mono text-rose-200 overflow-x-auto leading-relaxed min-h-[175px] max-h-[240px]';

            inspectorCard.classList.remove('animate-shake');
            void inspectorCard.offsetWidth;
            inspectorCard.classList.add('animate-shake');
        }

        /**
         * 5. EVENT HANDLERS
         */
        function handleTransitionAttempt(targetState) {
            const activeTicket = getActiveTicket();
            if (!activeTicket) return;

            const fromState = activeTicket.status;
            const actor = $('#actor-select')?.value || 'Unknown Actor';
            const response = apiUpdateTicketStatus(selectedTicketId, targetState, actor);
            const rejectionAlert = $('#rejection-alert');

            if (response.status === 200) {
                rejectionAlert?.classList.add('hidden');
                refreshAllUI({ from: fromState, to: targetState, success: true });
            } else {
                lastInsertedEventId = null;
                rejectionAlert?.classList.remove('hidden');
                $('#rejection-alert-text').textContent =
                    `Rejected '${fromState}' → '${targetState}' by ${actor}. Transaction rolled back; 0 rows written to ticket_transitions.`;
                refreshAllUI({ from: fromState, to: targetState, success: false });
            }

            renderApiInspector(response);
        }

        function refreshAllUI(lastTransition = null) {
            renderTicketSelector();
            renderTransitionButtons();
            renderMatrixTable();
            updateSvgDiagram(lastTransition);
            renderAuditLogs();
        }

        function initDemo() {
            const requiredIds = [
                'ticket-select',
                'filter-current-ticket',
                'new-ticket-form',
                'new-ticket-title',
                'btn-toggle-new-ticket',
                'btn-cancel-new-ticket',
                'btn-reset-demo',
                'rejection-alert',
                'http-status-pill',
                'http-latency',
                'api-response-body',
                'current-ticket-title',
                'current-state-badge',
                'http-request-line',
                'transition-buttons-grid',
                'matrix-table-body',
                'audit-log-body',
                'audit-count-badge',
                'api-inspector-card',
                'actor-select'
            ];

            if (!requiredIds.every((id) => $(id))) {
                return;
            }

            seedInitialData();
            refreshAllUI();

            $('#ticket-select').addEventListener('change', (event) => {
                selectedTicketId = Number(event.target.value);
                lastInsertedEventId = null;
                $('#rejection-alert').classList.add('hidden');
                refreshAllUI();
            });

            $('#filter-current-ticket').addEventListener('change', () => {
                renderAuditLogs();
            });

            const newTicketForm = $('#new-ticket-form');
            $('#btn-toggle-new-ticket').addEventListener('click', () => {
                newTicketForm.classList.toggle('hidden');
                if (!newTicketForm.classList.contains('hidden')) {
                    $('#new-ticket-title').focus();
                }
            });

            $('#btn-cancel-new-ticket').addEventListener('click', () => {
                newTicketForm.classList.add('hidden');
            });

            newTicketForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const input = $('#new-ticket-title');
                const title = input.value.trim();
                if (!title) return;

                const newTicket = {
                    id: nextTicketId++,
                    title,
                    status: 'OPEN',
                    updated_at: new Date().toISOString()
                };

                tickets.unshift(newTicket);
                selectedTicketId = newTicket.id;
                input.value = '';
                newTicketForm.classList.add('hidden');
                $('#rejection-alert').classList.add('hidden');

                refreshAllUI();
                renderApiInspector({
                    status: 200,
                    statusText: '201 Created',
                    latency: 11,
                    body: {
                        message: 'Ticket initialized in default OPEN state.',
                        ticket: newTicket
                    }
                });
            });

            $('#btn-reset-demo').addEventListener('click', () => {
                seedInitialData();
                $('#rejection-alert').classList.add('hidden');
                $('#http-status-pill').textContent = 'IDLE';
                $('#http-status-pill').className = 'px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700';
                $('#http-latency').textContent = '-- ms';
                $('#api-response-body').textContent = '// Sandbox reset to initial state.\n// Select a target state above to dispatch a PATCH request.';
                $('#api-response-body').className = 'flex-1 bg-slate-950 border border-slate-800 rounded-b-lg p-3.5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed min-h-[175px] max-h-[240px]';
                refreshAllUI();
            });
        }

        ensureDomReady(() => {
            initDemo();
        });
    </script>
</body>