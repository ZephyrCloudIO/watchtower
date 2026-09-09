# Watchtower Control Plane and Authorization Contract

## Scope and Authority

This contract records the v1 control-plane decisions approved in issue #15.
It governs self-service organizations, tenant resources, authentication,
authorization, credentials, settings, quotas, audit, and recovery. It is a
contract-only deliverable and creates no runtime, schema, UI, or deployment.
It is a v1 prerequisite with no calendar deadline.

`docs/servers-watchtower-components-contract.md` owns the six-unit boundaries,
internal handoffs, revocation fences, and coordinated release behavior.
`docs/servers-watchtower-runtime-contract.md` owns runtime, transport, errors,
workload authentication, and diagnostics.
`docs/servers-watchtower-canonical-telemetry-storage-contract.md` owns storage,
retention, lifecycle barriers, audit durability, and restore-independent fences.
This contract supplies the control-plane policy consumed at those boundaries;
it does not relax their safeguards. The project index owns downstream scope.

## Resource model and membership

- Users may sign up and create organizations. Existing organizations require invitations; SSO authentication never creates Watchtower membership by itself.
- An organization is exactly one tenant. Its Watchtower organization UUID is the canonical `tenant_id`; there is no separate tenant resource or translated tenant identifier. Each project belongs to exactly one such organization, and its immutable owning organization UUID is the `tenant_id` used in storage, messages, projections, authorization predicates, and deletion scope. A user may have memberships in multiple tenants but is not itself a tenant. WorkOS organization IDs are external references, never canonical tenant IDs.
- Organizations own projects. Teams are organization-scoped groups granting project access; multiple teams may access one project. Direct user grants are also supported.
- Teams have no separate administrator role. Owner and Admin manage teams and memberships.
- Environment names register automatically on first collection. Manage may hide them from the normal list; renaming, deletion, and environment-level authorization are unsupported. Hidden environments still count toward limits.
- Repository-owned identifiers are canonical lowercase UUID v7 values, persisted as PostgreSQL `uuid`. Organization slugs are globally unique; team and project slugs are unique within their organization. Slugs may change; display names need not be unique.
- Project organization ownership is immutable. Project transfers and organization merges are unsupported.
- Recreating a deleted resource requires a new ID and credentials, with no inherited data or permissions. Names and slugs may be reused only after deletion completes.

## External organization binding

- Within each deployment environment, each active Watchtower organization has exactly one exclusive WorkOS organization. API owns the versioned mapping from the immutable Watchtower organization UUID to the external organization ID. Neither external IDs nor bindings may be shared across tenants or environments. Ordinary metadata or SSO connection changes cannot replace this binding.
- Organization preparation provisions and confirms the external organization before Watchtower activation, in addition to the existing ownership, recovery and quota prerequisites. Provider failure leaves preparation pending and unavailable. Persist provisioning intent and reconcile uncertain provider outcomes before retrying; idempotent retries resume the same preparation and external allocation rather than creating another organization.
- Cancellation fences activation and durably schedules cleanup of its provisional external organization. Retry cleanup after provider failures; never reuse canceled allocations. Final Watchtower organization deletion also schedules external organization cleanup under the existing deletion deadlines and retains binding tombstones. No external callback may reactivate canceled or deleted Watchtower resources.
- API selects and validates Admin Portal targets, organization-specific SSO proofs and membership events against the current environment, external organization ID and binding generation. Unknown, mismatched or retired bindings confer no access; delayed events for a retired external organization cannot mutate the replacement's membership or policy. Provider roles remain non-authoritative.
- Unexpected external organization deletion blocks that Watchtower organization's user-session and personal-token access and enters reconciliation. It does not delete Watchtower data or memberships. Rebinding requires the existing registered Owner recovery email, organization recovery code and separate Support approval, with the same human-separation, expiry, current-Owner and suspension restrictions as organization recovery. Ordinary administration cannot rebind an organization.
- Recovery provisions an exclusive replacement for the same Watchtower organization UUID. Preserve the organization's authentication policy; prepare and test any required SSO connection and confirmed fresh Owner recovery bundles using the existing atomic SSO replacement rules before reopening access. A non-SSO organization retains its MFA requirements. Revoke old organization SSO proofs and personal tokens; DSNs and service tokens continue only while independently authorized. Recovery cannot lift suspension or bypass deletion.
- Serialize cutover against the expected binding and recovery-request versions. Persist a restore-independent binding intent and monotonically increasing generation, complete the existing owner-acknowledged revocation fences, then commit the replacement and confirmed recovery state. Partial execution remains pending with user access blocked. Retrying a completed cutover does not rotate state again. Retired external bindings are never reassigned to another tenant.
- Keep binding intents and retired-generation fences in encrypted, immutable, append-only registry versions outside restorable API rows, subject to existing erasable-context rules. Retain them through every affected backup horizon and unresolved cleanup. API reconciles the latest mapping and all affected owners install relevant fences through the existing snapshot boundary before readiness; missing or regressed evidence fails closed. Backup restore and delayed events cannot restore an old binding, proof or token.

## Invitation Lifecycle

- Owner/Admin may issue, resend, or revoke an organization invitation within their current membership-management authority. Direct Owner invitations remain forbidden.
- Invitations expire seven days after issuance and are single-use. Acceptance requires an authenticated account with the verified target email; knowing the link alone grants no authority.
- Store the organization, issuer, target email, proposed non-Owner role, and any explicitly proposed team/project grants with the invitation. The recipient cannot substitute or widen this scope at redemption. A changed offer requires a replacement invitation.
- Resending invalidates the previous link and issues a new seven-day invitation. Revocation and expiration prevent redemption; revoked or superseded links cannot be revived by retries.
- At acceptance, recheck the issuer's current authority to grant the offered role and permissions, the target resources' organization and existence, current organization state and SSO/MFA policy, and the member quota. A stale grant or policy failure creates no membership or partial grant.
- Commit acceptance, one-time consumption, membership, and allowed grants atomically with the quota decision. Concurrent redemption cannot consume the invitation twice or exceed the member limit. A retry after success returns the existing acceptance result without reapplying grants or undoing later permission changes.

## Organization and project authorization

Organization roles are Owner, Admin, Member, and Viewer. Project levels are Read, Write, and Manage.

- Owner and Admin have effective Manage permission on every project in their organization without a team or direct grant. This includes every Read and Write action in the matrix; it does not bypass credential scope, resource state, authentication conditions, or Owner-only restrictions.
- Member access is the union of explicit team and direct project grants.
- Viewer receives access only to granted projects and remains read-only regardless of a higher project grant.
- Current organization role, membership, project grants, credential scope, resource state, and applicable authentication policy are independently enforced.

| Action | Allowed authority |
| --- | --- |
| Create teams and projects; manage ordinary memberships and project grants | Owner, Admin |
| Change ordinary organization metadata, including display name and slug | Owner, Admin |
| Create, change, or remove Admin, Member, or Viewer | Owner, Admin |
| Designate, demote, or remove an Owner | Owner only |
| Organization SSO/MFA policy and organization deletion | Owner only |
| Approve non-Owner identity reconnection for this organization | A different human who is a current Owner, using a user session reauthenticated within five minutes; no token or staff-role substitute |
| Replace a deleted external organization binding | Verified Owner recovery with separate Support approval; no ordinary session or token authority |
| Project reads | Read, Write, Manage |
| Issue state, assignment, comments; release/artifact registration and modification; project alert-rule management | Write, Manage |
| Release/artifact deletion; reprocessing; ordinary project settings | Manage |
| Project DSN issuance, rotation, revocation, and redisplay | Manage |
| Create/delete organization service accounts; grant/change/remove their project permissions; revoke their tokens | Owner, Admin |
| Issue or rotate service-account tokens | Owner, Admin, using a recently reauthenticated user session |
| Issue or rotate own personal tokens | Owner, Admin, Member, Viewer, using their own recently reauthenticated user session |
| List own personal-token metadata or manually revoke own personal tokens | Owner, Admin, Member, Viewer, using their own authenticated user session |
| Export creation and download | Manage |
| Project access grants and project deletion | Owner, Admin |
| Project disablement, reactivation, and retention shortening | Owner, Admin |
| Organization/project audit access | Owner, Admin only |

Additional restrictions:

- Admin cannot change or remove an Owner.
- Ordinary organization metadata changes may use an Owner/Admin user session or an explicitly scoped Owner/Admin personal token. Member, Viewer, project-only Manage, service accounts, and unscoped tokens cannot change organization metadata. This authority excludes SSO/MFA policy, ownership, deletion and other separately restricted actions. Slug changes retain the immutable organization/tenant UUID and existing authorization scope, enforce global uniqueness, and use the observed-version conflict rule for settings.
- The creator is the initial Owner. Multiple Owners are supported, and the last Owner cannot leave or be demoted.
- Owner designation promotes an existing member; direct Owner invitations are unsupported. The promoting Owner must reauthenticate, and promotion completes only after the new Owner registers and verifies a recovery contact and confirms recovery-code storage. The completion transaction must also atomically check and consume the target user's ownership quota; promotion cannot create an eleventh ownership even though it creates no organization.
- Project deletion, disablement, reactivation, retention shortening, organization deletion, Owner changes, SSO/MFA policy changes, and management-token issuance require a recently reauthenticated user session.
- Personal tokens may remove or demote non-Owner members and revoke project grants when explicitly scoped and currently authorized.
- All ungranted actions are denied. Sentry adapters map their external requests to the same native authorization decisions.

## Authentication and sessions

- Use WorkOS AuthKit for email one-time-code, Google, and enterprise SSO authentication.
- Accept AuthKit’s verified-email identity linking. Linking does not grant organization membership, project access, or an exemption from organization authentication requirements.
- Watchtower has no v1 self-service primary-email-change screen. Verified provider changes follow stable external identity linkage and do not add permissions.
- Browser sessions have a maximum lifetime of seven days and an inactivity limit of 24 hours, subject to earlier revocation and policy enforcement.
- Sensitive actions require server-verified active authentication within five minutes using AuthKit `auth_time`, plus current organization SSO/MFA conditions. A refresh alone is insufficient. AuthKit selects the reauthentication factor; repeating both the original login method and MFA on every sensitive action is not required.
- Non-SSO MFA is optional by default and may be required organization-wide by Owner. Use account-level TOTP and personal recovery codes; exclude SMS and passkeys.
- SSO MFA is delegated to the enterprise IdP. Staff IdP MFA is mandatory for operator access.
- SSO proof is organization-specific. Authentication for one organization does not satisfy another organization’s SSO requirement.

## SSO administration

- Each organization has one active SSO connection. A replacement may be tested before switching; simultaneous active IdPs are unsupported.
- Owner configures the connection through WorkOS Admin Portal after Watchtower authorization and recent reauthentication.
- Portal activation alone does not enable Watchtower SSO enforcement. Require a successful connection test, a qualifying Owner, recovery-code readiness, and the explicit Watchtower activation step.
- SSO enforcement includes Owner. Existing sessions that do not meet a newly enforced SSO or MFA policy lose organization access immediately.
- Enabling SSO or organization MFA revokes that organization’s existing personal tokens. New personal tokens require a user session satisfying the applicable policy.
- Replacing SSO invalidates old organization SSO proofs and revokes organization personal tokens. DSNs and service-account tokens remain subject to their independent permissions and lifecycle.
- SSO replacement prepares a new connection generation and separately versioned Owner recovery bundles. Before cutover, at least one current Owner must have a verified recovery contact, a successful new-connection test, and confirmed storage of a new ten-code bundle bound to that generation. Prepared bundles are inactive until commit. Atomically switch the active connection and activate its confirmed bundles while invalidating all pre-replacement bundles; do not expose a new connection without at least one usable confirmed Owner bundle. Other Owners' old bundles are invalidated and they prepare new bundles under the current connection generation before using organization recovery.
- Recheck Owner authority, verified contacts, and the expected connection/bundle versions at cutover. Failure or abandonment before commit leaves the old connection and valid old bundles in place. Stale preparation, concurrent Owner removal or contact/bundle changes cannot complete cutover. Retrying a committed replacement preserves its active bundle generation without rotating it again or redisplaying plaintext. Existing SSO-proof and personal-token revocation fences remain required, so partial execution is pending rather than successful.
- Directory Sync, SCIM, automatic domain joining, and directory-driven team synchronization are excluded.

## Credentials

- Support project-scoped, collection-only DSNs; personal management tokens; and organization service-account tokens.
- Personal-token administration is self-service for every organization role, including Viewer. The session actor must equal the token owner; organization/project roles do not permit issuing, rotating, or inspecting another user's personal token through this self-service interface. Issuance/rotation requires current membership and applicable organization SSO/MFA conditions, and requested scopes cannot exceed the owner's current authority. Viewer tokens remain read-only. Metadata listing never returns plaintext; manual revocation uses the existing acknowledged fence protocol. Personal/service tokens cannot mint or rotate personal tokens. Policy-driven and account-wide revocation rules remain independently enforced.
- Management tokens belong to one organization and carry explicit action and project scopes. Effective permission is the intersection of token scope and the current principal’s permissions.
- Personal tokens have a default and maximum lifetime of 30 days; service tokens have a default and maximum lifetime of 90 days. Shorter lifetimes are allowed; indefinite tokens and automatic extension are not.
- DSNs remain valid until revoked and may collect for multiple environments in their project. Environment values are not authorization boundaries.
- Management-token plaintext is shown once and only a verification hash is retained. Authorized users may redisplay public collection DSNs.
- Rotation defaults to immediate old-credential revocation. Explicit overlap may last at most 24 hours; emergency revocation has no grace period.
- Overlapping credentials count toward limits. At the limit, reject overlapping rotation but allow immediate replacement.
- If a token-issuance response is lost, an idempotent retry returns its identifier and issuance status, not plaintext. The user must revoke and replace an unrecoverable token.
- Service accounts are restricted to explicitly granted project Read/Write/Manage operations. Explicit DSN management and export scopes are allowed. Organization administration, membership/grant management, project creation/deletion, service-account privilege changes, and management-token issuance are forbidden.
- Personal and service tokens may export only with explicit export scope and current Manage authority, subject to existing export audit, limits, and download checks.
- Organization service-account administration is Owner/Admin-only; project Manage alone grants no service-account administration authority. Creation, deletion, project-grant changes, and token revocation may use an authorized user session or an explicitly scoped Owner/Admin personal token. Issuance and rotation create new management-token secrets and require a recently reauthenticated Owner/Admin user session. No service token may perform these administration operations. Account deletion and permission reduction revoke affected access through the existing acknowledged fence protocol.
- Internal workload authentication remains mTLS with explicit caller policy, independent of customer service accounts.

## Recovery

Watchtower API owns recovery-code hashes, atomic consumption, code replacement, recovery requests, approvals, and audit. Recovery-driven WorkOS authentication-factor changes occur only through an authorized recovery flow. Ordinary MFA enrollment remains subject to the authentication and activation requirements above.

- Separate personal MFA recovery codes from organization-and-Owner-specific recovery codes.
- Each bundle contains ten single-use codes, shown once and stored only as hashes. Codes have no fixed expiry. Reissuing a bundle invalidates all prior codes in it.
- Require code-storage confirmation before MFA activation, organization creation completion, Owner promotion completion, and SSO enforcement or replacement.
- Organization creation and Owner promotion additionally require the prospective Owner to explicitly register and verify their organization-specific recovery email before completion. The login-profile address is not implicitly a registered recovery contact; using the same address requires explicit recovery-contact registration and verification. Initial registration occurs in the authenticated ownership-preparation flow alongside the first code bundle and does not require a nonexistent prior recovery code. Until both email verification and code-storage confirmation finish, ownership preparation remains incomplete. Later changes use the separate existing-contact replacement rules. SSO enforcement/replacement readiness requires this verified contact as well as the prepared code bundle.
- Owner privilege loss invalidates that Owner’s organization codes. SSO replacement invalidates only pre-replacement recovery-bundle generations at the atomic connection cutover; the confirmed replacement generation is activated, not invalidated.
- MFA recovery requires primary authentication and a personal recovery code. Revoke all other sessions and all personal tokens; the restricted recovery session must complete new MFA verification before ordinary access.
- Organization recovery requires the registered recovery email, an organization recovery code, and approval by one Support operator. Consume the code atomically when identity verification succeeds. The approving Support operator must be a different human from both the requester and the recovering Owner, even if they use different customer and staff registrations. API compares verified stable person identities from staff identity records and the recovery identity-verification evidence, including linked customer/staff identities; different WorkOS IDs or email addresses alone do not establish separation. Persist the verified linkage with the restricted recovery evidence and recheck it at approval and execution. Missing or ambiguous linkage blocks approval; the approver cannot establish separation by editing their own identity linkage.
- A verified request may await approval for 24 hours. Approval grants one hour of narrowly scoped recovery access. Retries resume the same request; a rejected or expired request requires a new code.
- SSO recovery permits connection repair/replacement and testing, not disabling SSO enforcement or reading customer data.
- Recheck current Owner authority, organization state, and request state at approval and every recovery action. Authority loss immediately cancels the request and recovery access.
- A deleted external identity may be reconnected to the same Watchtower Owner after the required proof and approval; arbitrary replacement-Owner promotion is forbidden.
- Identity reconnection revokes old sessions, personal tokens, personal MFA, and that Owner’s organization recovery codes. Require fresh MFA/recovery preparation and current organization authentication conditions.
- Recovery evidence from organization A restores A only. Other organization memberships remain blocked until each organization’s Owner reapproves access or that organization’s recovery evidence is supplied.
- Recovery contact email is separate from the login profile. Changing it requires recent reauthentication, new-address verification, and an existing organization recovery code. Prepare a fresh ten-code bundle, show it once, and require storage confirmation before changing the active contact. Commit the verified contact and confirmed new bundle together with consumption/invalidation of the old bundle and cancellation of that Owner's unfinished recovery requests. Notify the old address through the durable notification intent. Until this atomic transition commits, the old contact and bundle remain active and the prepared bundle is not usable for recovery. Recheck current Owner authority and the active contact/bundle version at commit; concurrent recovery consumption, bundle replacement, or authority loss must not allow a stale transition. A failed or abandoned preparation cannot strand the Owner with a changed contact but no usable codes. Retry a committed transition without replacing or redisplaying its bundle again.
- Missing registered email or recovery codes cannot be bypassed by Support or Operator. Document this limitation before activation.
- Support recovery never lifts an operator-imposed organization suspension.

### Non-Owner identity reconnection

- An Admin, Member or Viewer whose external user was deleted may reconnect to the same immutable Watchtower account only if that account is not currently an Owner in any organization. Check this global condition at request verification, approval and completion; becoming an Owner cancels this route and requires the existing Owner recovery procedure. Recovery never merges accounts or changes the target account UUID.
- Require a single-use email challenge to the verified email recorded for the target before external deletion, proof of control of the new WorkOS identity, and approval by a different human who is a current Owner of the organization being restored. Bind the verified evidence to the exact target account, proposed external identity, organization and expected binding version. A caller-supplied email or provider automatic linking cannot substitute for the pre-deletion record or approval. If the recorded address cannot be verified, this route is unavailable; use a new account with a fresh invitation and grants instead, without transferring the old account's history or authority.
- API owns verification, atomic challenge consumption, request state and binding changes through native recovery operations. Entry points hide account existence and use the existing preauthentication/security budgets. The approving Owner must use a user session actively reauthenticated within five minutes and satisfying that organization's authentication policy. Admin, Member, Viewer, management tokens and staff roles cannot substitute for Owner approval; no Support approval is required.
- Enforce different-human approval using verified stable person linkage, including linked identities, as in organization recovery. Different email addresses or external IDs alone do not prove separation; missing or ambiguous evidence blocks approval. The approver cannot modify their own linkage to satisfy this check.
- Show the approving Owner the target's current organization role, team memberships and direct grants. Approval authorizes only restoration of the still-valid permissions reviewed for that organization. Recheck target membership, approver authority, grant versions, request expiry, resource state and authentication policy at completion; changed permission state requires renewed review rather than restoring a historical snapshot or silently widening approval. Removed memberships and grants stay removed. Other organizations remain blocked until their respective Owners separately approve access under the same current-state checks.
- After evidence verification, approval must occur within 24 hours. Approval grants at most one hour of restricted access to finish the exact reconnection and required authentication preparation, with no ordinary customer-data access. Retries resume the same request; rejection or expiry requires a new request with fresh evidence. Persist audit and notification intent before completing transitions; notify the affected user and the approving organization's Owners about the request and result.
- Reject a proposed external identity already bound to another Watchtower account. Serialize reconnection using the expected account-binding and request versions; stale or concurrent approvals cannot replace a newer identity. Persist a restore-independent binding intent, revoke old sessions and all personal tokens, invalidate old personal MFA and recovery codes, and complete affected-owner revocation fences before committing the new binding. Require fresh MFA/recovery preparation wherever applicable and current organization authentication before ordinary access. A partial failure stays pending and blocked; retries never restore old credentials or reapply grants.
- Reuse the immutable, monotonically versioned binding intent and fence retention rules above for account reconnection. Reconcile the latest account binding and per-organization recovery gates before API or consumer readiness, with identifying evidence in erasable account context. Deleted accounts cannot reconnect, suspended organizations cannot be reopened, and backup restore, delayed identity events or automatic email linking cannot reinstate the old identity or bypass independent organization approval.

## External identity synchronization and outages

- Watchtower remains the authority for memberships and authorization. WorkOS changes cannot automatically grant Watchtower privileges.
- Poll WorkOS Events API every ten seconds, persist the cursor, deduplicate events, and process available backlog continuously.
- External session revocation terminates that session only; independently issued personal tokens remain governed by their own lifecycle unless an account-wide revocation rule applies.
- Unexpected external user deletion disables identity access and revokes sessions/personal tokens. Do not automatically delete Watchtower organizations, projects, or membership history.
- Unexpected WorkOS membership deletion or deactivation blocks the affected organization access and creates a reconciliation requirement; do not translate external role changes into new privileges.
- Internal security projections require an initial snapshot and have a maximum freshness of 60 seconds.
- If external security synchronization is unconfirmed for more than five minutes, block user-session and personal-token access. DSNs and service tokens continue only while their independent Watchtower authorization state is valid.
- During WorkOS outages, preserve only unexpired locally verifiable access within these bounds. New authentication, required provider verification, and unsupported renewal fail closed.
- Immediate Watchtower revocation uses the existing restore-independent intent and owner-acknowledged fence protocol. Neither freshness window replaces that protocol.

## Lifecycle and data handling

- Project creation follows the existing lifecycle barrier and remains unavailable until required owners and schedules acknowledge readiness.
- Project disablement stops new collection and ordinary changes but retains authorized reads and exports. Already accepted data completes processing and indexing; new alert delivery and reprocessing stop. Retention and deletion continue.
- Project disablement/reactivation requires an Owner/Admin user session reauthenticated within five minutes.
- Project deletion requires the same recent authentication and exact project-name confirmation. After the final request, cancellation and restoration are unsupported.
- Preserve existing prepare/activate barriers, durable pending state, cache invalidation, purge ownership, and restore-independent tombstones. Purge or irreversibly anonymize active project data within 14 days and backups within 90 days; deleted projects cannot return through restore.
- Retention shortening is Owner/Admin-session-only and obeys existing class defaults, source-preservation floors, activation barriers, and expiry rules. It cannot extend the owning storage contract’s limits.
- Only Owner may delete an organization, and only after every project deletion completes.
- Organization deletion immediately revokes access and credentials, destroys identifiable organization audit context, and removes or irreversibly anonymizes active data within 14 days and backups within 90 days. Retain only required anonymous evidence.
- Users may delete their accounts after resolving every last-Owner constraint and reauthenticating. Immediately revoke memberships, sessions, and personal tokens while preserving organization data.
- Account identity information and identifiable audit actor context are erased or irreversibly anonymized within 14 days in active stores and 90 days in backups. Non-identifying action evidence follows the audit lifecycle.

## Organization and Account Deletion Recovery Fences

API persists each authorized organization/account deletion intent in its encrypted,
immutable, versioned, restore-independent control registry before acknowledging acceptance or committing
the deletion in restorable PostgreSQL state. This is additional to project
tombstones and authorization-revocation fences; neither alone protects restored
account profiles, organization rows, or erased audit context.

Registry storage is an API-owned immutable S3 control-registry prefix, not merely
a separate mutable database. Intent, acknowledgement progress and terminal
tombstone transitions append new monotonic, integrity-checked versions; never
overwrite prior evidence in place. Enforce storage retention against overwrite,
rollback and deletion until required cleanup is acknowledged and every affected
restorable backup predating the deletion is gone. Acknowledging completion does
not release that retention early. Intent versions remain recoverable until their
terminal fence is durably retained under the same protection.

Recovery verifies complete version history and the latest authoritative registry
generation. Missing evidence, a regressed generation, or a conflicting digest
keeps affected access unready; a partial/older inventory cannot be treated as proof
that no deletion occurred. Only controlled cleanup after the recorded retention
conditions are met may retire these records. Audit cleanup retirement without
retaining deleted identity payloads.

The record contains the target kind (organization or account), a keyed target
identity that can match restored rows without retaining email/profile payload,
monotonic deletion generation, original deletion timestamp, erasure deadlines,
correlation/idempotency identity, integrity digest, and pending/completed owner
acknowledgements. The registry holds unresolved intents through reconciliation;
completion leaves a minimal deletion tombstone. Retain that tombstone until all
required cleanup is acknowledged and no API or affected-owner restorable backup
can predate the deletion, then purge it when no longer needed. Keep audit evidence
under its independently defined policy, without retaining deleted identity context.

Before API accepts traffic after any restore or replacement, it loads and
verifies these records, reinstalls deletion fences, resumes incomplete cleanup,
and prevents restored target rows, identity links, credentials, recovery codes,
and identifying audit context from becoming accessible. Original erasure deadlines
do not restart on restore. Account cleanup affects that account's identifying
context and authority, not unrelated organization data. A recreated organization
or user must have a new UUID and cannot inherit fenced authority.

API includes relevant organization/account deletion fences in the existing
owner-scoped `ControlRegistrySnapshotV1` recovery handoff. Every affected owner
must reconcile and durably enforce its fences before readiness, including the
component contract's paginated snapshot and final generation check; missing,
conflicting, or unavailable registry state keeps affected paths unready. During
normal deletion, retry owner acknowledgements durably and do not report cleanup
complete early. Stale snapshots, delayed changes and replay may not erase or
regress a deletion fence. Audit journal replay may restore anonymous event evidence
but cannot restore destroyed organization/account identity context.

## Settings and interfaces

- API owns control-plane state, versioned changes, authorization authority, and contract-level audit. Consumers own their projections; cross-component persistence access is forbidden.
- Define native `/api/v1` operations for the selected resource, membership/grant, credential, settings, quota, lifecycle, audit, and recovery flows.
- Define consumer-facing application contracts for Ingest, Query, Processor, Jobs, Web, and the Sentry adapter using existing internal `/internal/v1` unary Protobuf-over-HTTP and versioned-message boundaries.
- Settings mutations submit the observed resource version. Reject stale versions as conflicts.
- Expose the stored version separately from each relevant service’s application status, including pending and failed application. Retry durable delivery. Security revocation, deletion, and retention shortening retain their stronger barriers.
- Incomplete multi-owner operations return HTTP 202 and a UUID v7 operation ID with status lookup. The web must not display them as completed successes.
- Creation, deletion, and rotation require an idempotency key in the tuple `(principal_id, scope_kind, scope_id, operation, idempotency_key)`. Organization-owned operations use `scope_kind=organization` and the canonical organization UUID as `scope_id`. Account deletion uses `scope_kind=account` and the immutable target Watchtower account UUID, independently of all memberships; never select an arbitrary organization or use a nullable organization placeholder. Organization creation, before an organization exists, uses the creator's account scope. The operation discriminator separates these actions. Reusing a key with different content is a conflict; idempotency never bypasses current authentication or authorization.
- Retain idempotency state throughout unfinished execution and for at least 24 hours after termination.
- Native failures use a common safe error object with a stable code, message, request identifier, and applicable field errors.
- Authentication failure is 401. Inaccessible resources are indistinguishable from absent resources through 404. A visible resource with insufficient action permission returns 403. Use 409 for conflicts, 429 for exhausted limits, and 503 for unavailable enforcement dependencies.
- Settings ownership, permissions, versioning, and propagation are defined here. Sampling/grouping/processing/alerting algorithms and value defaults belong to their domain contracts.

## Quotas and rate limits

Operational upper bounds are independent of billing. Operator sets upper bounds; Owner/Admin may lower organization/project limits but cannot exceed them.

| Dimension | Initial upper bound |
| --- | ---: |
| Organizations owned by one user | 10 |
| Members per organization | 10,000 |
| Teams per organization | 1,000 |
| Projects per organization | 1,000 |
| Service accounts per organization | 1,000 |
| Valid DSNs per project | 50 |
| Environments per project, including hidden entries | 1,000 |
| Personal tokens per user/organization pair | 50 |
| Tokens per service account | 50 |

- Reject limit-exceeding new creation or collection without silently dropping data. Preserve permitted reads, deletion, recovery, and revocation.
- The per-user owned-organization count includes every completed Owner membership, including shared ownership. Organization creation and promotion use the same serialized per-user quota decision with their ownership commit; concurrent creations/promotions cannot each claim the final slot. Incomplete recovery preparation does not grant ownership. Failed or repeated promotion cannot consume an extra slot; at-cap rejection leaves the prior role intact and follows the quota-exhaustion response. Removing an Owner membership releases its slot only when that removal commits under the existing last-Owner protection. All ownership-quota checks include outstanding organization-creation reservations as well as completed ownerships.
- Starting organization preparation atomically reserves one of the creator's existing ten ownership slots before allocating durable preparation state. Completed ownerships plus outstanding reservations may not exceed that limit; an idempotent retry resumes the same reservation. Preparation confers no Owner membership, project access, or active organization. Completion converts its reservation to one ownership atomically without charging twice; concurrent creation or promotion must include these reservations.
- The initiating authenticated account may cancel its unfinished organization preparation. Cancellation durably terminalizes the preparation, discards provisional payload and releases its reservation atomically; repeated cancellation cannot release another slot. Retain only the existing required idempotency/audit/recovery evidence, and fence late callbacks so they cannot complete a canceled preparation. A crash must reconcile the reservation and preparation together before admitting new preparations.
- A proposed organization slug is not globally reserved during recovery-email/code preparation. Enforce global slug uniqueness only at the atomic organization activation commit; a conflict cannot activate the organization or steal another organization's slug. Abandoned preparations remain resumable/cancelable within the bounded slot count and cannot squat global slugs.
- Limits may be lowered below current usage. Keep existing resources, expose the exceeded state, and block additional creation.
- At the environment limit, reject collection for a new environment while continuing collection for existing environments.
- Organization-scoped general management APIs enforce both 600 requests per principal and 6,000 per organization over the preceding 60 seconds.
- Organization-scoped revocation, recovery, and deletion use an independent budget of 30 per principal and 300 per organization per preceding 60 seconds, without bypassing authentication, authorization, or audit.
- Authenticated account-scoped operations with no single owning organization use only the applicable principal budget: 600 per preceding 60 seconds for ordinary operations such as organization creation, or the independent 30-per-60-second security budget for account deletion/recovery/revocation. Do not select a membership, invent an organization, or charge every organization for such a request. No organization counter is required in this explicit exception; an unavailable applicable principal counter still fails closed with 503. Principal budgets aggregate across that principal's requests regardless of organization, session, or token, so changing memberships cannot reset the window. Organization-scoped requests always apply both their principal and organization limits.
- Watchtower-owned preauthentication entry points enforce 60 requests per IP per preceding minute and five per normalized target per preceding 15 minutes. Hide account existence.
- Rate-limit responses include `Retry-After`.
- If enforcement cannot be evaluated safely, return 503. Security paths operate only when their independent budget can be verified; no unrestricted fallback is allowed.
- Signal-specific collection/query quantities belong to their owning domain contracts. Existing export-specific limits remain authoritative.

## Operators and support

- Provide a separate internal operator web surface using a distinct staff SSO registration, mandatory IdP MFA, explicit staff permissions, and internal-network access.
- Support handles verified Owner/organization recovery approvals. Non-Owner identity reconnection is approved by the affected organization's Owner under its separate recovery procedure. Operator handles operational limits and suspension. Neither receives routine customer-data access or user impersonation.
- Emergency customer-data reads require a requesting Operator and approval by a different Operator, an incident reason, explicit organization/project/read scope, immutable audit, and a one-hour expiry.
- Emergency access cannot bypass retention expiry or deletion fences. Valid data in a suspended organization may be read only when explicitly included in the approval.
- Operator may suspend/reactivate an organization with a reason and audit. Suspension blocks collection, reads, and ordinary changes while retention continues.
- Verified Owner/Admin users may see only minimal suspension state, a customer-safe reason, and a support route.
- Process suspension-time deletion requests through verified support handling without requiring suspension removal or weakening deletion rules.
- Reactivation restores use only of otherwise valid, unrevoked credentials. Recovery and reactivation never revive revoked credentials.

### Staff Role Authority and Provisioning

API owns the authoritative assignments of `StaffAdmin`, `Support`, and
`Operator`. Staff SSO and mandatory IdP MFA authenticate staff identities;
IdP roles or groups never automatically grant Watchtower staff permissions.
Every staff operation checks the current API-owned role as well as the existing
network, authentication, resource-state, purpose, and audit requirements.

| Staff action | Required authority |
| --- | --- |
| Assign or revoke another staff member's roles, including StaffAdmin | StaffAdmin through the internal operator web with a user session actively reauthenticated within five minutes |
| Approve verified Owner/organization recovery | Support; StaffAdmin alone is insufficient; non-Owner reconnection instead requires the organization Owner |
| Change operational limits or suspend/reactivate organizations | Operator; StaffAdmin alone is insufficient |
| Request or approve emergency customer-data reads | Operator with the existing distinct-approver, scope, audit, and expiry requirements |
| Reconnect an inaccessible last StaffAdmin identity | Verified existing unrevoked assignment; deployment-operator verification and a distinct deployment-operator approval; no role changes |
| Register the first StaffAdmin | Authorized deployment operator through the audited, first-registration-only bootstrap procedure |

StaffAdmin carries no implicit customer recovery, suspension, impersonation, or
data-read authority. A staff member needs the corresponding separate role for
those operations. Support, Operator, and customer Owner/Admin alone cannot assign
staff roles. Self-assignment, self-revocation, and every other change to one's own
roles are forbidden. Another StaffAdmin may assign StaffAdmin, but removal of the
last StaffAdmin is rejected. Serialize role changes so concurrent removals cannot
bypass this invariant. Role mutation audit records identify the acting and target
staff identities, previous and new roles, reason, and outcome. Audit unavailability
blocks role changes; staff authentication alone is never authorization to mutate.

The initial StaffAdmin is designated by an authorized deployment operator in an
audited bootstrap operation. API records first registration durably outside its
restorable PostgreSQL state. Bootstrap is allowed only when no StaffAdmin has
ever been registered and no registration or revocation evidence exists; an empty
restored table is not proof of eligibility. Concurrent or repeated bootstrap
attempts cannot create additional initial administrators. Existing or unavailable
registry evidence prevents bootstrap. Subsequent assignments use the internal
web and the current StaffAdmin policy, not the bootstrap path.

### Inaccessible Last StaffAdmin Recovery

Loss or deletion of the last StaffAdmin's external SSO identity permits a narrowly
scoped identity-reconnection procedure, not bootstrap or a new role assignment.
API must verify that the existing immutable staff identity still has an unrevoked
StaffAdmin assignment and that no other StaffAdmin can currently administer roles.
If another administrator is available, use ordinary staff administration.

The affected staff member requests recovery. An authorized deployment operator
verifies continuity with the existing staff identity using the independently
maintained staff identity/employment record; control of a new email address or an
IdP group claim alone is insufficient evidence. A different authorized deployment
operator approves the request. Requester, recovery target, and approver identities
must be compared using stable identities: the approver cannot be the requester,
target, or verification operator. Neither operator obtains customer-data access
or an unrestricted staff-role mutation capability through this procedure.

Use the same restricted operational access boundary as bootstrap, with fresh
operator authentication and mandatory staff IdP MFA, but a separate recovery
operation. API owns the request and validates deployment authority independently
of the inaccessible StaffAdmin login. Record the incident reason, target staff
identity, evidence references, old/new external identity bindings, verifier,
approver, expected staff-authorization version and outcome in the durable audit
boundary; do not store secret identity-verification material in logs. Missing
identity evidence, unavailable authority validation, or audit failure blocks
reconnection without changing the existing assignment.

Before committing a reconnection, verify the target controls the new staff SSO
identity with IdP MFA and ensure that identity is not already bound to another
staff member. Recheck the target's unrevoked assignment, current approver/verifier
authority, and expected binding/authorization version. Approval is bound to this
exact target and new identity; changing either requires a new verification and
approval. Serialize completion so concurrent recovery or revocation cannot apply
stale approval. An approval is single-use, and retry resumes the same operation
without issuing another binding or role grant.

Persist a restore-independent reconnection intent and fence the old identity's
operating sessions, pending approvals and emergency capabilities before completing
the binding change. Advance the staff-authorization version and retain the existing
staff UUID and current unrevoked assignments only; never restore revoked roles,
old sessions or prior emergency access. Recovery creates no new StaffAdmin and
does not bypass the ban on self-role changes. The reconnected staff member must
sign in through the normal staff SSO/MFA and current-role checks.

Keep reconnection intents and completed binding/version fences outside restorable
API state through every affected backup horizon. On restore, reconcile them with
registration and revocation records before staff access; replay cannot reconnect
the old identity or reuse an approval. Failed or interrupted execution remains
restricted and retryable, never reopens bootstrap, and never reports success before
required fences and audit evidence are durable. Record the recovery request and
outcome in the staff audit trail for subsequent StaffAdmin review.

### Staff Role Revocation and Restore

Role revocation durably records a monotonically increasing staff-authorization
version and a restore-independent revocation intent before acknowledging success.
Fence role-dependent operating sessions, unfinished approvals, and active
emergency access at every affected enforcement surface before completing the
revocation. Requests and in-flight privileged use must recheck current authority;
remaining roles authorize only independently permitted actions and do not preserve
an approval or capability issued under the revoked role. A missing acknowledgement
leaves the revocation incomplete and fail-closed, never a successful stale grant.

Before restored API state or any affected enforcement surface admits staff
operations, reconcile the restore-independent registration and revocation records
and install the latest authorization version. Stale replay must not lower the
version, restore withdrawn roles or capabilities, or reopen bootstrap. Retain the
required evidence through every affected restorable-backup horizon; first-registration
evidence continues to prohibit subsequent bootstrap. Missing or unverifiable state
keeps staff access blocked. This extends the existing API-owned revocation and
audit boundary without granting consumers direct access to API persistence.

## Audit, notifications, and observability

- Audit all management changes and authentication, recovery, and operator-access successes/failures, in addition to existing mandatory lifecycle/export events. Ordinary reads use safe operational logs.
- Owner/Admin alone may query customer audit history; Member, Viewer, and service accounts cannot.
- Identifiable detailed audit history lasts 13 calendar months, subject to earlier project, organization, and account erasure rules.
- Preserve append-only audit rows, restore-independent journal recovery, erasable context, and required minimal anonymous evidence. The storage contract defines independently erasable project/organization target and account/staff actor context, including non-project authentication and recovery events. No plaintext identifying context belongs in immutable rows or journals; API reconciles context-erasure fences before replay so anonymous evidence cannot restore erased identity.
- Audit persistence failure blocks new management changes, new authentication, MFA verification, identity linking, and recovery completion. Existing otherwise-valid reads may continue. Record the inability to audit through safe operational logs and alerts.
- Provide in-app history and security email. Notify organization Owners about Owner changes, SSO/MFA policy changes, support recovery, emergency access, project/organization deletion, suspension/reactivation, and Owner identity-reconnection requests/results. Notify the affected user about personal authentication-method and token changes.
- Persist audit and notification intent before completing the associated operation. Email failure does not reverse the operation; retry with exponential backoff for up to 24 hours, then alert and support manual resend.
- WorkOS sends login-code and AuthKit verification email. Watchtower invitation, recovery-contact verification, and security-message delivery are implemented through #28/#29.
- Never include secrets or internal incident details in customer notifications.
- Record safe structured logs, metrics, and traces for authentication/authorization outcomes, quota decisions, operation state, synchronization age, revocation fences, configuration application, recovery, and notification delivery. Propagate existing request/operation/message identifiers and trace context.
- Page immediately for tenant-isolation violations or successful access after completed revocation. Alert immediately when internal security state exceeds 60 seconds. Alert on five-minute change/audit-delivery stalls and terminal notification failure.
- Never log tokens, recovery codes, credentials, opaque sessions, or unrestricted payloads.

## UX, operations, and contract handoffs

- Provide user web/API flows and a separate operator web; no operator CLI is required.
- Watchtower v1 web copy is English and must meet WCAG 2.2 AA. #22 owns detailed screens and interaction design while preserving this contract’s permissions, progress, errors, and recovery limits.
- Feature flags do not apply to the mandatory authentication, authorization, and resource-management foundation.
- Before implementation, record numeric latency, availability, throughput, capacity, and cost targets in the follow-up operating contract. Do not imply an agreed numeric SLO here.
- Before release, complete non-production verification, threat-model review, operator/support runbooks, and customer authentication, credential, retention, deletion, and recovery documentation.
- Follow the existing six-unit release train, bounded N/N-1 compatibility, and expand/contract changes. Rollback must not restore revoked authorization, deleted resources, erased context, or obsolete recovery secrets.
- #16 owns Sentry routes/DTOs and compatible error mapping; #17 owns admission details; #18–#20 own processing, grouping, and artifact behavior; #21 and #23–#27 own query and signal semantics; #22 owns detailed web design; #28/#29 own notification execution and background orchestration.

## Interface Responsibility Matrix

These are application boundaries, not new wire protocols or permission grants.
Native commands and compatible management remain API-owned; native read/query
routes remain Query-owned under the component contract. Web reaches only public
routes. No owner may fulfill a request by reading another owner's persistence.

| Boundary | Owner and consumer | Required context and result |
| --- | --- | --- |
| Resource, membership, grant, credential, quota, and settings commands | API; user web and compatible management adapter | Current actor, organization, resource, action and credential scope; observed version for settings; idempotency for creation, deletion and rotation; safe result or conflict |
| Native reads, exports, and operation visibility | Query's public reads with API-owned authority and consumer projections; user web and external clients | Current authorized scope and resource state; operation ID for unfinished work; no resource-existence disclosure across unauthorized scopes |
| Security snapshots and changes | API to Ingest, Query, and applicable internal owners | Initial complete snapshot, authorization revision and the runtime envelope's project/organization/account/staff scope; freshness enforcement; consumer-owned applied state |
| Immediate revocation | API to every affected public owner through existing `AuthorizationRevocationFenceV1` | Durable pre-commit intent, monotonic revision, scope and correlation; all affected owner fences acknowledged before successful authoritative revocation |
| Project lifecycle and retention | API and existing owner/Jobs lifecycle barriers | Generation-matched prepare/activate/enablement acknowledgements; durable pending operation; no premature success or destructive rollback |
| Settings application | API to applicable domain consumers | Stored version and consumer-specific application result; retries do not overwrite a newer observed version; special security/lifecycle barriers still apply |
| Staff role provisioning and revocation | API; internal staff web and affected enforcement surfaces | Current StaffAdmin, recent reauthentication, no self-change or last-admin removal; audited first registration, monotonic revocation and reconciliation before staff access |
| Non-Owner identity reconnection | API; restricted user recovery and organization Owner approval web | Pre-deletion email proof, new external identity proof, different-human Owner approval, expected account binding, current grants and per-organization recovery gates |
| Recovery and staff administration | API; user recovery and separate internal staff web | Verified identity evidence, current role, purpose, expiry, scoped approval and audit; no implicit customer-data privilege |
| Audit | API; all components through existing `AuditIntentV1`/`AuditEvidenceV1` | Durable audit acknowledgement before required side effects; correlated outcome, restore replay and erasable identity context |
| External organization provisioning and replacement | API; WorkOS integration and restricted Owner recovery | Exclusive environment-bound mapping, expected generation, provisioning reconciliation, approved recovery and durable retired-binding fences |
| External authentication events | WorkOS to API through Events API polling | Durable cursor and event identity; no external grant authority; unresolved security mismatch blocks affected user access |
| Notification execution | API's durable intent to Jobs and the #28 delivery boundary | Decided recipient and safe event content; execution result, bounded retry and manual-resend visibility; API remains audit authority |

## Lifecycle and Recovery State Matrix

The labels below describe observable contract states; they do not add a database
schema or override existing protocol enum definitions. Authorization and expiry
are rechecked at transitions and use, not only at the initial request.

| Resource or flow | Transition and guard | Result and recovery |
| --- | --- | --- |
| Organization creation / Owner promotion | Preparation to completion after verified Owner recovery-contact registration, code-storage confirmation, and atomic ownership-quota check | No completed organization creation or Owner promotion without both verified recovery contact and prepared codes; last-Owner removal stays forbidden |
| Project creation | `accepted_pending` to active only after the existing owner/schedule barrier | Unavailable until completion; retry the same durable operation |
| Project disablement | Active to disabled by recently reauthenticated Owner/Admin | New collection and ordinary changes stop; accepted processing, authorized reads/exports and retention continue; no new alerts or reprocessing |
| Project reactivation | Disabled to active by recently reauthenticated Owner/Admin | Re-evaluate current permissions and credential expiry/revocation; never resurrect invalid credentials |
| Project deletion | Final confirmed request to `accepted_pending`, active tombstone and purge completion | No cancellation/restoration; existing prepare/activate barriers and 14-day active/90-day backup cleanup apply |
| Organization deletion | Empty organization to deletion by Owner | Wait for all project deletions first; immediately revoke access and credentials, erase organization context and complete bounded cleanup |
| Account deletion | Authenticated account to deletion after last-Owner checks | Revoke memberships, sessions and tokens; erase identifying profile/audit context while retaining organization data |
| Organization suspension | Active to suspended by Operator, or suspended to active by separate audited Operator action | Minimal Owner/Admin status only; support recovery does not lift suspension; deletion uses verified support handling |
| Credential rotation | Valid old credential to immediate replacement, or explicitly bounded overlap | At most 24 hours of overlap; emergency revocation immediate; all valid overlap counts toward the quota |
| SSO/MFA enforcement | Prepared policy to enforced after the required test, authentication and recovery readiness | Block nonqualifying organization sessions and revoke its personal tokens; no callback-only enforcement |
| External organization binding | Prepared exclusive external organization to active mapping; external deletion to blocked recovery and versioned replacement | Activation requires confirmed provisioning; preserve tenant UUID and policy; fence retired proofs/tokens before recovery completes |
| Organization recovery | Identity-verified request to awaiting approval, approved one-hour access, then completion | Code consumed at verification; approval wait expires after 24 hours; identity/role/state changes can cancel access; retries resume the original request |
| MFA recovery | Primary-authenticated recovery proof to restricted reenrollment to ordinary access | Revoke other sessions and personal tokens first; require new MFA verification before general access |
| Recovery contact replacement | Verified new address and confirmed replacement codes to one atomic active-contact/bundle transition | Old contact/codes remain active until commit; invalidate old codes and unfinished recovery requests together; failed preparation preserves existing recovery |
| Owner identity reconnection | Approved organization recovery to scoped restored access | Other organizations stay blocked until their independent reapproval/evidence; prepare fresh authentication/recovery state |
| Non-Owner identity reconnection | Verified email/new identity to Owner approval within 24 hours, then one-hour restricted completion | No current ownership anywhere; fence old identity/credentials, prepare current authentication and restore only independently approved organization access |
| Settings propagation | Version-checked stored change to pending/applied/failed consumer status | Distinguish durable storage from application; retry safely and expose unfinished operation IDs |

## Threat-Model Review

The documentation review covers untrusted public inputs, authenticated customer
principals, compromised credentials, external identity events, privileged staff,
consumer projections, and stale backup/replay state. The protected assets are
cross-tenant telemetry, control-plane authority, credentials/recovery material,
audit identity context, and irreversible revocation/deletion decisions.

| Threat | Contract control and required validation |
| --- | --- |
| Cross-tenant probing or privilege escalation | UUID ownership checks, inaccessible-resource 404, deny-by-default role ceilings and token intersections; test every role/action and cross-tenant reference |
| Provider callback or automatic linking grants access | API-owned membership, organization-specific SSO proof, current MFA and durable audit; provider authentication alone never authorizes a Watchtower operation |
| Stolen token survives privilege loss | Current principal checks, short management-token lifetimes and acknowledged revocation fences; test in-flight requests and stale consumer projections |
| External organization confusion or stale binding replay | Exclusive API-owned environment/tenant mapping, validated portal/proof/event targets and restore-independent binding generations; test retired events, cancellation and restored snapshots |
| WorkOS outage conceals identity revocation | Separate five-minute external and 60-second internal limits; test each outage independently, including DSN/service-token behavior |
| Recovery escalates privileges across organizations | Purpose-separated code hashes, atomic single use, current Owner rechecks and per-organization reapproval; test evidence reuse, expiry and cross-organization reconnection |
| Non-Owner recovery captures another account or restores old grants | Pre-deletion email and new-identity proof, global Owner exclusion, distinct-human current Owner approval, reviewed current grants and versioned binding fences; test aliases, binding collisions, expired approvals and cross-organization access |
| Contact change captures future recovery | Fresh authentication, existing recovery code and new-address proof; invalidate old bundles and requests, notify old address |
| Staff abuse or self-approved raw access | API-owned StaffAdmin/Support/Operator assignments, no IdP-derived grants, no self-role change, last-StaffAdmin protection, restore-independent bootstrap/revocation evidence, distinct emergency approver, explicit scope and one-hour expiry; no deletion/retention bypass or routine impersonation |
| Repeated or concurrent changes duplicate authority | Scoped idempotency through execution plus 24 hours after completion, version conflicts and honest pending state; never replay token plaintext |
| Backup/replay restores deleted or revoked state | Restore-independent tombstones, authorization fences and audit reconciliation before readiness; erased actor/organization context must not reappear |
| Audit outage silently permits privileged changes | Durable intent and fail-closed new authentication/management changes; existing permitted reads only; safely report the inability to audit |
| Quota exhaustion blocks security response | Independent security budgets with full authorization/audit and no unlimited fallback; test general-budget exhaustion and enforcement outages |

External provider actions already performed outside Watchtower cannot be
retroactively blocked by an API audit outage. Watchtower must withhold its own
new authentication completion or access grant and reconcile the external event
through its authoritative audit and security state. Likewise, organization
suspension and project disablement do not suspend mandatory retention cleanup.

This is a contract-level review, not evidence that an implementation has passed
security tests. Implementation acceptance still requires the scenarios below,
provider integration validation, and another threat-model review before release.

## Acceptance Criteria

- The authoritative contract contains the resource hierarchy, action-by-role/principal matrix, authentication conditions, credential scopes, and lifecycle/recovery transitions described above.
- Every allowed operation is constrained by current membership, role, scope, organization/project state, and applicable authentication conditions.
- No team grant, direct grant, personal token, service account, support action, SSO callback, or external identity event bypasses those constraints.
- Revocation, deletion, audit, and restoration preserve existing component/storage barriers and ownership.
- Recovery cannot grant an arbitrary identity access, cross organization boundaries without separate approval, disable required SSO, or lift suspension.
- Quota enforcement, idempotency, pending operations, synchronization outages, audit failure, and notification failure have the specified observable outcomes.
- Every delegated detail names its owning contract and implementation prerequisite.
- Contract completion includes permission/state tables, threat-model review, and consistency checks against existing authoritative contracts.

## Test Scenarios

- Redeem invitations at and after their seven-day expiry; test wrong/unverified email, revocation, resend, issuer demotion/removal, changed SSO/MFA policy, deleted grant targets, quota races, concurrent redemption, and retries after later grant revocation. No rejected acceptance creates partial membership or grants.
- Create an organization, prepare Owner recovery codes, invite a member, create teams/projects, grant access, and register environments through collection.
- Verify Owner and Admin can perform Read, Write, and Manage project actions without explicit grants, while token scopes, disabled resources, recent authentication, and Owner-only operations remain enforced.
- Exercise every role/action/principal combination, including Viewer ceilings, team/direct unions, Admin management, last-Owner protection, and token restrictions.
- Verify every project carries its owning organization UUID as `tenant_id` across API, storage, messages, and projections; reject a different organization UUID or WorkOS organization identifier, including for a user who belongs to both organizations.
- Verify organization name/slug changes by Owner/Admin and explicitly scoped personal tokens; deny Member, Viewer, project-only Manage, service tokens, and missing scopes. Reject duplicate slugs and stale versions; preserve the organization/tenant UUID and Owner-only restrictions.
- Attempt cross-tenant reads/writes, resource probing, credential reuse, mismatched organization SSO, external-role privilege injection, and replay of stale grants.
- Exercise email-code, Google, SSO, organization MFA, active reauthentication, SSO enforcement/replacement, and WorkOS outages across the 60-second internal and five-minute external boundaries.
- Verify Owner/Admin service-account creation, deletion, project-grant changes, and token revocation; require recent user reauthentication for issuance/rotation and deny all service-account administration to project-only Manage and service tokens.
- Verify each organization role can issue/rotate its own personal token only after recent reauthentication, inspect only safe own-token metadata, and revoke its own token. Deny another owner ID, excessive scopes, Viewer writes, and token-authenticated issuance/rotation; preserve policy-driven revocation.
- Verify credential issuance response loss, expiry, emergency revocation, overlapping rotation, at-limit replacement, and concurrent in-flight requests.
- Attempt organization creation and Owner promotion with only recovery codes, only a verified contact, or an unverified contact; completion must require both verified contact registration and confirmed codes. Verify initial contact registration does not require an old code and does not silently inherit the login profile.
- Interrupt recovery-contact replacement before confirmation and before commit; verify the old contact/codes remain usable and new codes are inactive. After commit, verify only the new contact/bundle works and old requests are canceled. Test concurrent code consumption, Owner removal, replacement, response loss, and retries without a second rotation or plaintext redisplay.
- Replace SSO with multiple Owners and crash before/after cutover. Verify old bundles work only before commit, confirmed new-generation bundles work only after commit, at least one verified current Owner can recover immediately after an IdP failure, and retries, concurrent Owner removal, or stale contact/bundle versions cannot invalidate the replacement generation.
- Attempt organization recovery approval by the same human through distinct customer/staff accounts, aliases, and changed external IDs; deny self-approval and unverifiable person linkage. Permit only a verified different current Support operator, with separation rechecked before execution.
- Test external organization provisioning failure, uncertain creation response, idempotent retries, cancellation and cleanup retry; no activation or duplicate allocation before confirmation. Reject shared, cross-environment and mismatched portal/proof/event bindings. Delete the external organization and recover the same tenant only with Owner evidence and separate Support approval; preserve policy, require new SSO/recovery readiness, revoke personal tokens, and retain independently valid DSNs/service tokens. Race replacement with Owner loss, suspension, deletion and stale events; inject audit/fence failure and old-backup restore without reviving retired bindings.
- Reconnect a deleted non-Owner identity using its recorded verified email, new external identity and separate current Owner approval. Reject changed or unavailable email evidence, reused challenges, another account's external identity, self-approval through aliases, token/Support substitutes, and any account with an Owner membership elsewhere. Test the 24-hour approval and one-hour completion limits, concurrent grants/Owner promotion/removal, stale binding versions, revoked permissions and independent approval for every organization. Inject audit/fence failure, delayed external events and old-backup restore; no old sessions, tokens, MFA, grants or deleted/suspended access may return.
- Test MFA recovery, Owner recovery, consumed-code retries, approval expiry, privilege loss during recovery, contact changes, identity reconnection, and cross-organization reapproval.
- Disable/reactivate projects while collection, processing, alerts, queries, exports, and retention are active.
- Attempt overwrite, premature removal, or rollback of organization/account deletion registry versions after cleanup. Verify retention prevents early retirement and missing/regressed/conflicting recovery evidence blocks readiness instead of reviving deleted identities.
- Restore API and each affected owner from before organization/account deletion, including a crash after registry intent but before PostgreSQL commit and after partial cleanup. Verify reconciliation before readiness, original deadlines, erased audit-context protection, rejection of stale grants/recovery material, retention through the last usable backup, and preservation of unrelated organization data.
- Delete projects, organizations, and accounts; verify deadlines, erasure, last-Owner constraints, no post-request project restoration, and no resurrection after backup restore or rollback.
- Retry account deletion for a user with zero, one, or multiple organization memberships, including after membership removal. Verify the same immutable account namespace and operation are used, another account/organization cannot collide with the key, different payloads conflict, and current authorization remains required.
- Exercise optimistic conflicts, duplicate requests, mismatched idempotency payloads, operations lasting beyond 24 hours, delayed acknowledgements, and honest pending UI.
- Exercise first-organization creation and account deletion with zero, one, and multiple memberships. Verify 600 ordinary/30 security requests per principal per rolling minute without an organization counter, unchanged windows across membership/session/token changes, 429 on exhaustion and 503 only when an applicable counter is unavailable.
- Promote a user owning ten organizations and verify rejection with no role change. Race two promotions or a promotion with organization creation at nine ownerships; exactly one may acquire the final slot. Retry success/failure and verify no double counting; completed demotion releases a slot only when last-Owner constraints permit it.
- Start preparations without confirming email/codes until completed ownerships plus reservations reach ten; reject another allocation. Verify retries do not duplicate slots, cancellation frees only its reservation, late callbacks cannot activate canceled state, crash recovery preserves accounting, and another user can claim a merely proposed slug.
- Verify every quota boundary, lowered limits, hidden environments, rolling rate windows, independent security budgets, and unavailable enforcement dependencies.
- Inject reordered/replayed internal changes and duplicate external events; verify cursor recovery, revocation fences, readiness gating, and no unauthorized privilege restoration.
- Verify IdP group changes do not grant staff roles; deny role mutations by Support/Operator or customer administrators without StaffAdmin. Test self-assignment/removal, concurrent last-StaffAdmin removal, repeated bootstrap and bootstrap after an old backup restore. Revoke a role during a session, pending approval and emergency read; verify immediate role-dependent fencing and only independently permitted remaining-role actions. Reject role changes during audit failure and block restored staff access until current registration/revocation records are reconciled.
- Delete or lose the sole StaffAdmin SSO identity and recover the same staff UUID through independently verified identity continuity and distinct deployment-operator approval. Deny self-approval, missing evidence, revoked assignment, a new identity bound to someone else, and stale/concurrent approvals. Inject audit/fence failure and a pre-recovery backup restore; verify no old identity, session, approval, emergency capability, or bootstrap eligibility returns, and no role is added.
- Test staff-role separation, self-approval denial, emergency-access expiry, retention/deletion restrictions, suspension recovery, and customer-visible notifications.
- Audit organization-only, account authentication/recovery, staff-only, and pre-account failure events without fabricating a project. Erase/expire the relevant context and replay older PostgreSQL/journal backups; verify identity, keys and subject lookups stay erased while unrelated context and required anonymous evidence survive.
- Verify audit fail-closed behavior, journal recovery, privacy erasure, email retries/manual resend, and configured alert conditions.
- Validate core web flows, keyboard and assistive-technology access, WCAG 2.2 AA requirements, and customer-safe error/progress/recovery guidance in isolated non-production environments.

## Out of Scope

- Implementing services, middleware, storage schemas, applications, infrastructure, or production deployment in this issue.
- Billing, pricing, subscription entitlements, and feature-flag rollout.
- Custom roles, team administrators, automatic domain membership, SCIM, and Directory Sync.
- Multiple simultaneously active enterprise IdPs, Watchtower MFA after SSO, SMS MFA, and passkeys.
- Project transfer, organization merge, environment rename/deletion, and environment-level authorization.
- Self-service primary-email editing, general operator impersonation, or recovery without required evidence.
- Cancellation/restoration after final project deletion.
- Sentry wire semantics, signal algorithms/defaults, notification-provider implementation, and numeric SLO choices delegated above.
