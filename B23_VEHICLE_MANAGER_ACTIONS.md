# Build 23 vehicle manager actions

This draft adds a database authorization boundary for a vehicle intake and corrective workflow. It requires the Build 23 onboarding session migration and the existing V6 corrective RPCs. The phone dashboard has yet to be wired to this boundary.

## Findings from the pilot

- `all_inspections` and `manager_queue` are independent. The former returns saved findings under a hard-coded read-only detail template. The latter only brings in unassigned open findings when they are RED, High, or Critical. Notification receipt does not confer queue eligibility.
- The verification queue requires an equipment-table match. A vehicle-only finding references `vehicle_asset_id` and can disappear from independent verification after completion.
- The legacy edge function accepts manager IDs from requests. The legacy ownership and verification RPCs do not establish the caller's identity or site authority. Linking history to those endpoints would make the UI an authorization boundary.
- Vehicle submission sets the inspection mine to the first configured mine. The draft therefore requires a reviewed vehicle asset-to-site mapping and explicit manager-to-site enrollment. It rejects findings with missing or mismatched organization scope. A read-only aggregate check found a saved vehicle finding without an organization ID.

## Release blockers

1. Confirm the authoritative site roster and vehicle site mapping, including historical or transferred vehicles. Resolve missing organization scope through a separately reviewed repair. The migration seeds neither mappings nor historical changes.
2. Confirm role ownership for enrollment. This proposal lets enrolled Rotation Managers see open intake and their existing assignments in scope. Only an enrolled Plant Manager can start, complete, or independently verify work through the new RPC.
3. Integrate the dashboard through a bearer-authenticated Edge route and implement a scoped After Repair photo upload that validates current action ownership before accessing storage.
4. Audit and cut over the legacy manager write and verification paths. Protect the supported application entry points and close direct bypasses before enabling the new controls. Preserve RED acknowledgement, independent verification, and other existing corrective workflows.
5. Run end-to-end checks against an isolated backend with synthetic identities and assets. This draft's PGlite test exercises the authorization wrapper using stand-ins for the hosted legacy RPCs.

Run the isolated test with `node tests/vehicle-manager-actions.test.mjs`.
