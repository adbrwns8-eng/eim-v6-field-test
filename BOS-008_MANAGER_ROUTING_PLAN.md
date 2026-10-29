# BOS-008 — Manager routing and owner visibility (development proposal)

Status: DEVELOPMENT ONLY. No production deployment or database changes authorized.

## Verified defect
Inspection #13 / Finding #13: moderate, open, no corrective action, no due date. Two in-app finding alerts recorded to manager-level recipients, but the tested manager queue was empty. The current `app-v11.js` calls `manager_queue(manager_id)`, a manager-specific work queue; it has no unassigned-finding intake section. The owner dashboard currently shows open findings but not unassigned count.

## Proposed backend contract (not implemented or deployed)
- `unassigned_findings` endpoint: derive actor from a verified authentication session (not an arbitrary employee_id or PIN), authorize manager/admin, restrict results by tenant AND permitted mine/site, list only open actionable findings with no active corrective action; paginate and return finding_id, finding_no, equipment, site, severity, status, reported_at, due_at. Never expose cross-tenant findings.
- `assign_finding` endpoint: verify actor/site access, require finding_id, assignee_id, task_description, due_at; validate assignee/site and due date; transactionally create corrective_action only if none active; record audit log and notification; handle concurrent assignments idempotently; return created action. High/RED findings continue their separate immediate response and out-of-service logic.
- `owner_finding_summary` endpoint: tenant/site scoped counts for open_findings and unassigned_findings with a consistent definition (open finding with no active corrective action). Include severity breakdown; count visibility is role-authorized.
- Use authenticated server-side identities and RLS policies. Do not trust client-supplied manager_id or mine_id for authorization.
- Keep independent verifier separate from the person completing repairs. Require after evidence and verification before closure.

## UI behavior
Manager: new section "New Findings — Awaiting Assignment"; load endpoint alongside existing queue; render empty/error states separately; show finding number, site, asset, severity, age; select eligible assignee, due date and task description; require confirmation; refresh queues after assignment. Never silently hide failed loads.
Owner: show "Open Findings" and "Unassigned Findings" as distinct counts; unassigned >0 is actionable and links to management intake. Existing RED counts remain visible.

## Acceptance tests
1. Moderate finding with no corrective action appears in authorized manager's site intake.
2. Manager in another tenant/site cannot read or assign it.
3. Two managers assigning simultaneously produce one active corrective action.
4. Valid assignment records assignee, due date, audit event and notification.
5. Finding disappears from unassigned intake, appears in assigned queue.
6. Owner counts update (open unchanged, unassigned decreases).
7. RED immediate shutdown/escalation path remains unchanged.
8. Completion requires after-photo and independent verification; unauthorized closure denied.
9. Network/API failure displays error, not "No findings".
10. Tests use fictional data and isolated environment.

## Security release blocker
Seven existing public tables were flagged with RLS disabled: corrective_action_revisions, finding_evidence, red_alert_escalations, red_alerts, vehicle_inspection_assets, manager_daily_presence, maintenance_projects. Audit existing grants and policies; plan migration and tests. Do not enable RLS blindly or expose real client data.

## Release gate
CEO approval required separately for database migration, edge-function deployment, application deployment, and any production test with real data.
