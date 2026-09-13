# Watchtower Ingestion Admission and Durable Handoff Contract

## Scope and authority

This contract is the authoritative documentation-only decision for issue #17.
It defines v1 admission of supported Sentry-compatible error events, native
crashes, and error attachments from public request through durable raw
acceptance and recoverable processing handoff. It defines no handlers,
workers, schemas, migrations, storage adapters, queues, infrastructure,
runtime rollout, or customer-facing acceptance-status API.

The completed issue #16 Sentry compatibility contract is the prerequisite for
this admission contract; this document consumes its pinned routes, wire
formats, limits, and response mappings without selecting a second protocol
baseline.

The following contracts remain authoritative at their boundaries:

- [`Watchtower Sentry compatibility`](servers-watchtower-sentry-compatibility-contract.md)
  owns the supported clients, public routes, wire formats, protocol limits,
  compatibility DTOs, and external response mappings. The exact supported
  behavior is restated here so admission cannot silently diverge from it.
- [`Watchtower component and deployment boundary`](servers-watchtower-components-contract.md)
  owns component ownership, dependency direction, internal boundaries, and
  failure isolation.
- [`Watchtower control plane and authorization`](servers-watchtower-control-plane-contract.md)
  owns tenant/project authority, collection DSNs, authorization, project and
  organization lifecycle, environment registration, revocation, and quota
  policy.
- [`Watchtower canonical telemetry and storage`](servers-watchtower-canonical-telemetry-storage-contract.md)
  owns raw storage topology, retention and deletion fences, MSK durability,
  replay, and restore-independent lifecycle evidence.
- [`Watchtower server runtime`](servers-watchtower-runtime-contract.md) owns
  the common message envelope, workload authentication, internal transport,
  safe errors, readiness, shutdown, and coordinated compatibility.

Ingest is the only writer of raw accepted records, acceptance metadata, quota
charge state associated with an accepted unit, and the recoverable processing
outbox. API remains authoritative for authorization, lifecycle, environment
registration, quota policy, and revocation. Processor never reads Ingest S3
directly and never becomes a synchronous prerequisite for public acceptance.

## Compatibility baseline consumed from #16

### Supported public paths and formats

The following paths and methods are the complete v1 collection surface. A
request is authenticated by a current project-scoped collection DSN and never
by a management credential.

| Path | Methods | Accepted format and admission role |
| --- | --- | --- |
| `/api/<project_id>/envelope/` | `POST` | `application/x-sentry-envelope`, browser `text/plain;charset=UTF-8`, or the pinned binary transport's `application/octet-stream`/absent content type; identity or gzip encoding. Carries error events, attachments, client reports, and supported native-crash event/attachment combinations. |
| `/api/<project_id>/envelope/` | `OPTIONS` | DSN-authenticated configured project-origin CORS preflight; `204` with no persistence side effect. |
| `/api/<project_id>/store/` | `POST` | `application/json`, identity or gzip encoding; one legacy JSON error event only. It cannot carry an arbitrary batch. |
| `/api/<project_id>/minidump/` | `POST` | `multipart/form-data` with a boundary, identity or gzip encoding; exactly one `upload_file_minidump`, exactly one `sentry` JSON metadata part, and only the pinned Crashpad scalar annotation parts. |
| `/api/<project_id>/upload/` | `POST` | Native TUS creation with `Tus-Resumable: 1.0.0`, integer `Upload-Length` from `0` through `20,000,000`, and the exact `sentry` attachment metadata form. Creation stores no accepted attachment bytes but reserves project-scoped TUS staging capacity. |
| `/api/<project_id>/upload/<upload_id>` | `HEAD`, `PATCH` | Native TUS status and append path. `PATCH` uses `application/offset+octet-stream`, the expected decimal `Upload-Offset`, and identity encoding only. A completed upload remains unbound until an Envelope binds it to an accepted event. |
| `/api/<project_id>/security-report/` | `POST` | Explicitly unsupported; `501 unsupported_capability` with no persistence side effect. Other methods follow the #16 known-route method rules. |

The TUS creation metadata is exactly:

```text
Upload-Metadata: sentry <base64({"attachment_type":"event.minidump"})>
```

The TUS `Location` contains a canonical lowercase UUID v7 `upload_id` and is
project-bound. A positive-length upload has a fixed 24-hour pending lifetime;
an upload that reaches its declared length has a fixed 24-hour
`complete-unbound` lifetime. Append does not extend either lifetime. A
zero-length creation becomes `complete-unbound` immediately. No TUS creation
or append is an accepted event, attachment, final attachment quota charge, or
Processor handoff. Each upload nevertheless reserves one project-scoped
`tus_staging` slot and its declared `Upload-Length` bytes at creation,
including a slot for a zero-length upload. The reservation is keyed by the
upload ID and covers both `pending` and `complete-unbound` states; `PATCH`
cannot exceed it or extend it. Binding atomically converts the reservation to
the final attachment-byte charge. Expiry, deletion, or a lifecycle fence
releases it. Exhausted staging capacity returns `429 rate_limited`; an
unavailable staging-capacity projection returns `503 unavailable`.

For `/api/<project_id>/security-report/`, `POST` returns `501
unsupported_capability`; another non-`HEAD` method returns `405
method_not_allowed` with `Allow: POST`; and `HEAD` returns the bodyless `501`
status/header-only response defined by #16.

The minidump multipart shape is exact: one binary `upload_file_minidump` part,
one JSON `sentry` part, and at most one of each optional scalar annotation
part `prod`, `ver`, `ptype`, `plat`, and `guid`; no other file or annotation
part is admitted. Annotation parts have a `form-data` disposition with the
part name and no filename, and exactly `text/plain; charset=utf-8` media type.
Their bodies are strict, non-empty UTF-8 scalar strings, NFC-normalized, and
at most 256 UTF-8 bytes. A missing or mismatched annotation media type is
`415 unsupported_media_type`; duplicate, missing-required, filename-bearing,
or unlisted parts are `400 invalid_request`. The `sentry` JSON part requires a
non-null 32-character hexadecimal `event_id` and permits only bounded,
non-null `release`, `dist`, and `platform` strings when present; explicit
`null` for those optional members is invalid. A body-only raw minidump is not
this route and is rejected as `415 unsupported_media_type`.

An Envelope TUS reference attachment has the exact media type
`application/vnd.sentry.attachment-ref+json`, `attachment_type`
`event.minidump`, and a required `attachment_length` equal to both the
completed upload byte count and its declared `Upload-Length`. Its JSON payload
has exactly `{ "url": <Location>, "path": <safe-relative-path> }`; `url` must
match the creation `Location` byte-for-byte and `path` is a non-empty safe
relative path. The reference JSON length is not the attachment byte length.

### Content types, encodings, and transport failures

| Request family | Accepted content type | Accepted encoding |
| --- | --- | --- |
| Envelope | `application/x-sentry-envelope`; browser `text/plain;charset=UTF-8`; pinned binary `application/octet-stream` or absent only for the pinned binary transport | identity, gzip |
| Legacy `store` | `application/json` | identity, gzip |
| Minidump | `multipart/form-data` with a boundary | identity, gzip |
| TUS `PATCH` | `application/offset+octet-stream` | identity only |

Unsupported `Content-Encoding` is `415 unsupported_media_type`; a malformed
gzip stream is `400 invalid_compression`; malformed multipart boundaries are
`400 invalid_multipart`; and a mismatched or unsupported content type is
`415 unsupported_media_type`. These failures occur before payload persistence,
quota reservation, lookup, or environment registration.

Envelope framing is newline-delimited JSON headers followed by item payloads.
The envelope header is required. An item with `length` uses authoritative
length-delimited framing; the decoded payload must have exactly that length,
with only the permitted final newline afterward. Without `length`, the
permitted newline-delimited framing applies. Malformed framing, invalid
lengths, trailing bytes, duplicate JSON members, and invalid JSON headers
reject the entire request.

Recognized item `content_encoding` values are only `identity` and `gzip`.
Nested decoding is incremental and counted against decoded limits. Unknown or
individually excluded item types do not acquire special encoding semantics;
their unknown fields are ignored after global structural limits are checked.

### Exact admission limits

The smaller applicable limit always wins. Limits are checked while streaming,
before durable acceptance, and overage is never partially accepted.

| Resource | Exact v1 limit |
| --- | ---: |
| Decompressed Envelope or legacy event request | 50,000,000 bytes |
| Envelope item count, including unknown and excluded items | 1,024 items |
| Decoded JSON nesting | 16 levels |
| One Envelope item payload | 20,000,000 bytes |
| One JSON error event | 1,000,000 bytes |
| One attachment or native crash item | 20,000,000 bytes |
| Decompressed multipart request, including framing | 100,000,000 bytes |
| Multipart part count | 1,024 parts |
| Recursive object keys | 128 UTF-8 bytes per key |
| `attachment_length` | 0 through 20,000,000 bytes inclusive |
| TUS `Upload-Length` | 0 through 20,000,000 bytes inclusive |
| General non-empty scalar after decoding and applicable NFC normalization | 256 UTF-8 bytes |
| Message, exception values, and stacktrace text | 4,096 UTF-8 bytes |
| Safe diagnostics, discard reasons, categories, and processing details | 1,024 UTF-8 bytes |
| Client-report discarded-event records | 1,024 per item and 1,024 aggregate |
| Client-report quantity | 1 through 2,147,483,647 |
| Crashpad scalar annotation | 256 UTF-8 bytes after NFC normalization |

Every JSON value, including ignored extensible values, is at nesting level 16
or below. Recursive objects have at most 256 members and arrays at most 1,024
elements. Decoded bytes, decompressed nested item bytes, multipart framing,
and rejected or duplicate parts count toward their applicable limits.

### Supported and excluded items

| Item | v1 behavior |
| --- | --- |
| `event` | Supported only with a valid 32-character hexadecimal external event ID and at least one non-empty message, non-empty exception values, non-empty stacktrace frames, or `level` `error`/`fatal`. Exactly one event item is allowed. A second event item rejects the entire Envelope. |
| `attachment` | Supported only when associated with a supported error or native crash. An unassociated but structurally valid attachment is excluded as `unassociated_attachment`; its bytes are not retained. |
| `client_report` | Structurally accepted as bounded client diagnostic metadata, not as an error event. It creates no error quantity charge. |
| `profile`, `profile_chunk`, `transaction`, `span`, `session`, `replay_event`, `replay_recording`, `feedback`, `log`, `metric_buckets`, `check_in`, `user_report`, `security`, `trace`, `unreal_report`, `form_data`, `nel` | Individually excluded. |
| Unknown and future item types | Individually excluded with bounded type, reason, and count diagnostics. |

An individually excluded item's decoded payload is never persisted, placed in
raw storage, or handed to Processor; only the bounded exclusion diagnostic may
survive as acceptance metadata.

An event item with a valid ID but no error signal is individually excluded as
`not_error_event`. An invalid recognized field, invalid event shape, invalid
attachment length, invalid client report, or malformed supported item rejects
the whole request with the route-appropriate #16 error. Empty, unsupported-only,
and attachment-only Envelopes are valid bounded no-ops: they persist no
customer payload bytes, but their bounded acceptance/no-op metadata and
recoverable no-op handoff are recorded.

Exclusion diagnostics contain only bounded item type, exclusion reason, count,
tenant/project scope, request ID, and correlation ID. They never contain item
payloads, attachment bytes, DSNs, credentials, or unrestricted user data.

### Exact external response mappings

Every direct compatibility error with an entity body uses exactly:

```json
{
  "code": "invalid_request",
  "detail": "The request is invalid.",
  "request_id": "canonical-lowercase-uuid-v7"
}
```

`code`, `detail`, and `request_id` are the only members. `request_id` equals
the `X-Watchtower-Request-ID` header. `field_errors` is never emitted.

The documented #16 bodyless `HEAD` cases are excluded from this JSON rule:
failed TUS `HEAD`, an unsupported `HEAD` on a known ingestion route, `HEAD`
on an explicitly unsupported capability, and an unknown-path `HEAD` return
only their status, applicable route/request-ID headers, and
`Content-Length: 0`; they emit no `Content-Type` or JSON body. A failed TUS
`HEAD` retains `Tus-Resumable: 1.0.0`, a known-route method failure retains
its route-specific `Allow`, and unknown paths emit no `Allow` header.

| Code | HTTP | Exact meaning and admission use |
| --- | ---: | --- |
| `invalid_authentication` | 401 | Missing, malformed, expired, or revoked collection DSN. |
| `permission_denied` | 403 | Valid credential but disabled/suspended project or organization, or insufficient scope. |
| `not_found` | 404 | Unknown or inaccessible resource, upload, or route. |
| `method_not_allowed` | 405 | Known route with an unsupported method. |
| `invalid_request` | 400 | Invalid minidump/store request, field, alias, or TUS input. |
| `precondition_failed` | 412 | Missing or unsupported `Tus-Resumable`. |
| `unsupported_media_type` | 415 | Unsupported content type or encoding. |
| `invalid_compression` | 400 | Malformed or undecodable gzip. |
| `invalid_multipart` | 400 | Malformed multipart framing or boundary. |
| `invalid_envelope` | 400 | Invalid Envelope framing, length, header, legacy event, or supported item after transport decoding. |
| `conflict` | 409 | Conflicting event content, conflicting attachment/upload binding, retired environment, deleting project, or other lifecycle conflict. |
| `payload_too_large` | 413 | Byte, decoded-payload, item, part-count, or cardinality limit exceeded. |
| `rate_limited` | 429 | Project/organization collection quota or environment-registration capacity exhausted. |
| `unavailable` | 503 | Stale/unavailable authorization or quota projection, storage dependency, unsafe enforcement evaluation, or exhausted service capacity. |
| `deadline_exceeded` | 504 | A bounded synchronous admission operation exceeded its deadline without a committed outcome. |
| `internal_error` | 500 | Internal, unknown, or data-loss failure; original cause remains internal. |
| `unsupported_capability` | 501 | Explicitly unsupported route or capability outside an Envelope. |

The exact `detail` strings are, respectively: `Authentication is required.`,
`Permission denied.`, `The requested resource was not found.`, `The requested
method is not allowed.`, `The request is invalid.`, `The request precondition
failed.`, `The media type is not supported.`, `The request compression is
invalid.`, `The multipart request is invalid.`, `The Envelope is invalid.`,
`The request conflicts with the current resource state.`, `The request payload
is too large.`, `Rate limit exceeded.`, `The service is temporarily
unavailable.`, `The request deadline was exceeded.`, `Internal server error.`,
and `The requested capability is not supported.`

Durable acceptance, a matching duplicate, a mixed request with at least one
accepted unit, and a valid no-op all return the #16 success response: HTTP
`200`, zero-length body, `X-Request-ID`, and `X-Watchtower-Request-ID`.
Envelope `OPTIONS` returns `204`. TUS creation returns `201`; successful TUS
`HEAD` returns `200`; successful TUS `PATCH` returns `204`; each retains the
exact #16 TUS headers. A failed TUS `HEAD` is bodyless, and a failed TUS
`PATCH` uses the standard JSON error and never appends bytes.

`429`, `503`, and `504` are retryable according to `Retry-After` and bounded
backoff. `429` communicates a quota or registration-window retry; `503`
communicates temporary service, storage, or safe-enforcement unavailability;
`504` communicates a deadline with an unknown synchronous outcome. Invalid,
unsupported, unauthorized, lifecycle-conflicting, and content-conflicting
requests are not retried with changed content.

If #16's general `408`, `500`, or `502` retryable response is surfaced, its
retry rules remain in force; Ingest does not automatically retry a
non-idempotent request after an unknown outcome.

Ingestion also retains the exact #16 rate-limit header rules. When quota is
safely evaluated, `X-Sentry-Rate-Limit-Limit`,
`X-Sentry-Rate-Limit-Remaining`, and `X-Sentry-Rate-Limit-Reset` describe the
one selected bucket even when remaining capacity is nonzero;
`X-Sentry-Rate-Limits` is omitted when no bucket is active. A `429` includes
`Retry-After` and the active-limit entry. A `503` caused by unavailable quota
evaluation includes `Retry-After` but omits quota headers; a `503` caused by
another unavailable dependency emits no quota headers unless quota evaluation
actually supplied them. A known reset or dependency deadline is serialized as
the ceiling of its remaining whole seconds, and the #16 fallback is exactly
`Retry-After: 5` when no deadline can be evaluated.

## Authentication, lifecycle, and environment admission

Collection accepts only a current project-scoped collection DSN in the exact
#16 `X-Sentry-Auth`, DSN query, or DSN URL forms. The forms must agree on the
public key and route project. A DSN grants collection only; it grants no
management, query, artifact, release, issue, or event-read authority.
Management tokens cannot acquire collection authority implicitly.

DSN rotation immediately revokes the old credential by default. Explicit
overlap is at most 24 hours, emergency revocation has no grace period, and
overlapping credentials count toward the project limit. Project deletion
revokes every DSN before deleted-resource access is exposed; a pre-deletion DSN
is invalid authentication and cannot select a deleted project.

Ingest performs the first authorization check and the final acceptance commit
rechecks tenant, project, DSN scope, current authorization revision, project
state, organization suspension, retention/deletion fences, and the local
security projection generation. A security projection must have completed its
initial snapshot and be no older than 60 seconds. An unavailable or stale
projection fails closed as `503 unavailable`; an immediate API-owned
`AuthorizationRevocationFenceV1` is enforced independently and cannot be
masked by the freshness window. A revocation fence that invalidates the DSN
returns `401 invalid_authentication`.

| Current state | Collection result |
| --- | --- |
| Active project and organization | Continue to transport and unit validation. |
| Disabled project or suspended organization | `403 permission_denied`, no payload or quota side effect. |
| Deleting project | `409 conflict` while the current authenticated lifecycle fence applies; deleted/pre-deletion credentials are `401 invalid_authentication` as defined above. |
| Deleted project | `401 invalid_authentication` for its former DSN before project lookup. |
| Missing, stale, or unavailable security authority | `503 unavailable`, no acceptance side effect. |

Environment names are data, not authorization boundaries. The first valid
collection for an unregistered name requests an idempotent API-owned
registration. Concurrent first registration, retirement, reactivation, and
quota state serialize on `(tenant_id, project_id, environment_name,
registration_generation)`. The initial active-environment limit is 1,000,
including hidden entries. Capacity exhaustion is `429 rate_limited` and does
not affect existing environments.

Retirement creates a durable name tombstone and an Ingest admission fence
before releasing the slot. It is idempotent, preserves historical data, and
does not automatically re-register the name. A new event for a retired name
is `409 conflict`. Explicit Owner/Admin reactivation, or an explicitly scoped
authorized personal token, must reserve capacity and advance the generation
before collection resumes. Stale registration changes, backup replay, and
late callbacks cannot reopen a retired name. Final acceptance rechecks the
environment generation; a retirement that wins the race rejects the new unit
and removes any uncommitted staging.

## Acceptance units, identity, and comparison

An acceptance unit is the smallest atomic raw-acceptance transaction:

1. An initial error unit is one supported `event` or legacy error event plus
   its associated initial attachments.
2. A native-crash unit is one supported multipart minidump, or one supported
   error event plus its `event.minidump` attachment.
3. A later-attachment unit is one new attachment associated with an already
   accepted parent.
4. A bounded client report or no-op unit contains diagnostic metadata only and
   never creates an error event or attachment payload.

An invalid unit never accepts one of its constituent items. Across separate
initial-event, native-crash, TUS-binding, later-attachment, and bounded no-op
units, one valid unit's duplicate, conflict, exclusion, or temporary outcome
does not roll back another valid unit. Within one #16 Envelope, the
one-event-per-Envelope and invalid-supported-item rules remain request-atomic:
a second event item or malformed supported item rejects the whole Envelope
before any unit is selected. There is no server-side sampling. Valid traffic
within the stated limits is admitted; excess or unsupported traffic is
explicitly rejected or excluded.

Repository-owned identities are canonical lowercase UUID v7 strings and
PostgreSQL `uuid` values. Ingest generates non-reused IDs for the accepted raw
unit, parent event, attachment, upload, and internal operation as applicable.
An SDK event ID is never a Watchtower primary key. Supported SDK event IDs are
exactly 32 hexadecimal characters, normalized to lowercase, and are external
identifiers scoped to tenant, project, and source protocol. The #16
cross-transport compatibility record remains project/tenant scoped across
Envelope, `store`, minidump, and TUS-bound attachment transports. For #16 v1,
their source-protocol namespace is the single bounded value `sentry`; route,
transport, and format version remain separate metadata. A future protocol gets
a distinct source-protocol namespace and cannot collide with `sentry`. The
source protocol is retained as bounded identity metadata and never creates
global uniqueness.

The raw admission identity is the tuple
`(tenant_id, project_id, source_protocol, external_event_id)` together with
the seven-day admission generation. The first accepted event ID installs a
minimal raw deduplication record for seven days from its first `accepted_at`.
Retries do not extend that period. A matching event ID and matching content
reuses the original acceptance; a different content digest is `409 conflict`.
The public external event ID is also an alias fence: the compatibility record
continues to own that alias while its canonical event remains queryable, for
90 days by default or the shorter effective query-retention cutoff. A matching
retry while that alias is retained resolves to the existing compatibility
record; conflicting content or an attempted new generation returns `409
conflict`. The compatibility projection cannot replace the alias until the
older canonical event leaves query visibility. The seven-day raw fence and
this query-retention alias fence are independent; a new public acceptance
generation may use the external event ID only after both have expired.

When the raw handoff completes, raw objects, acceptance metadata, outbox state,
and payload references may retire according to the storage contract, but an
Ingest-owned non-payload admission tombstone remains through the seven-day raw
fence. It stores the scoped event identity, admission generation, content
digest, original acceptance result, and applicable cutoff. Parent-binding and
attachment identity state remains alongside it until the same parent cutoff.
This state contains no customer payload, credentials, or usable storage
reference; deletion and lifecycle fences supersede it and cannot be reopened
by retry or restore. A supported protocol that permits a missing event ID
creates a new identity for every submission; later attachment association then
requires that protocol's supported correlation identifier. Current #16 v1
supported error and minidump paths require an event ID.

For raw admission comparison, Ingest computes an
`admission_content_digest` after complete structural validation. For Envelope
and legacy `store` event units, it is the lowercase hexadecimal SHA-256 of the
decompressed original supported event bytes; authentication, transport
compression, Envelope framing, and request IDs are excluded, but whitespace,
member ordering, and other byte changes remain different content. For a
multipart minidump, it is exactly the #16 `minidump_digest`: lowercase
hexadecimal SHA-256 over the UTF-8 bytes of the RFC 8785 canonical-JSON
encoding of this object:

```text
{
  "schema": "watchtower.sentry.minidump.v1",
  "minidump_sha256": lowercase_hex_sha256(decompressed_upload_file_minidump_bytes),
  "annotations": sorted_allowed_crashpad_scalar_annotation_map,
  "sentry": {
    "event_id": normalized_lowercase_event_id,
    "release": optional_bounded_string_if_present,
    "dist": optional_bounded_string_if_present,
    "platform": optional_bounded_string_if_present
  }
}
```

The minidump preimage excludes multipart boundaries, part ordering, transport
compression, authentication, DSNs, and request IDs, while changes to the
minidump bytes, normalized annotations, or Sentry metadata produce a different
digest and therefore `409 conflict` under the active fence. Attachment content
is compared through its own identity, not folded into an ordinary event-body
identity. The #16 `payload_digest` remains the semantic RFC 8785 digest for
compatibility and downstream canonical processing; it does not widen the raw
seven-day deduplication fence or turn byte-different event retries into
duplicates.

An attachment identity is `(parent_acceptance_id, filename/name,
content_type, attachment_type, sha256(content_bytes))`, using the decoded
ordinary bytes or completed TUS bytes. Equal identity is an idempotent
duplicate and adds no object or charge. Equal name and type with a different
content hash is a distinct immutable attachment, subject to parent and quota
rules. Attachment length is checked against decoded or dereferenced bytes,
never against compressed bytes or the TUS reference JSON.

Initial attachments are committed atomically with their parent error unit.
The TUS upload is event-unbound until the subsequent Envelope binding. At
binding, the DSN must authorize the same tenant and project, the parent event
must be the eligible current parent, and the upload must be the matching
project-bound upload. An exact retry of an existing binding reuses it; a
different upload or digest for the same binding identity is `409 conflict`.

Later attachments require a current collection DSN and an existing authorized
parent acceptance less than seven days old. They may arrive before the parent
has completed processing, because parent processing order is asynchronous, but
they may not arrive before the parent acceptance exists. A parent that is
deleted, expired, fenced, or outside its seven-day window cannot receive an
attachment. A later attachment never extends the parent or its deduplication
window; its raw cutoff is the earlier of its own applicable raw-retention
cutoff and the parent's remaining raw-retention cutoff. Parent linkage is
resolved by the eligible scoped parent acceptance, never by an unscoped event
ID or stale historical record.

## Durable acceptance and handoff state machine

The request-to-handoff states are:

| State | Required invariant | Public result |
| --- | --- | --- |
| Received/authenticating | Route, method, DSN source, tenant, project, lifecycle, and security authority are bounded and checked. | #16 authentication/lifecycle mapping. |
| Transport decoded | Content type, encoding, framing, decoded bytes, duration, concurrency, and memory bounds hold. | `400`/`413`/`415`/`invalid_compression`/`invalid_multipart`/`504` as applicable. |
| Unit validated | Supported event, crash, attachment, or no-op shape is valid; unsupported items have no allocated payload retention. | `400 invalid_envelope` or `400 invalid_request` for invalid units; valid exclusions remain eligible for bounded no-op success. |
| Identity checked | Deduplication, event content, parent, upload, environment, and lifecycle generations are checked. | `200` duplicate, `409 conflict`, or continued admission. |
| Quota reserved | API-owned policy and Ingest reservation state agree for the unit; reservation is scoped and idempotent. | `429 rate_limited`, `503 unavailable`, or continued admission. |
| Raw staged and verified | For a payload-bearing unit, the immutable S3 object is complete and its SHA-256 and exact byte size match the accepted content. A valid no-op or client-report unit allocates no raw object and instead carries only bounded metadata. | No payload-bearing success is reported before verification. Failed or uncertain attempts are cleaned or reconciled. |
| Acceptance committed | For a payload-bearing unit, PostgreSQL acceptance metadata, final quota charge state, dedup/attachment identity, and transactional outbox commit together. For a no-op or client-report unit, bounded acceptance metadata and a recoverable no-op handoff commit without a raw object. | `200` with empty body and request IDs. |
| Handoff pending/published | Outbox publication to MSK is retryable and carries only bounded protocol-neutral metadata or an owner-issued raw reference. | Public success remains valid; no synchronous Processor visibility is claimed. |
| Processor dispositioned | Processor has durably completed or terminally rejected the handoff and Ingest has durably recorded the disposition. | No later public response is generated; raw retirement follows the disposition/fence contract. |
| Expired/fenced/quarantined | Retention, deletion, or permanent-failure fence prevents stale fetch, disposition, replay, and resurrection. | New requests map to the appropriate #16 `401`, `403`, `409`, or `503`; no payload revival. |

For a payload-bearing unit, public success means only that the immutable raw
object, verified digest and size, acceptance metadata, final reservation/charge
state, and recoverable outbox are committed. For a valid no-op or client-report
unit, public success means that its bounded acceptance metadata, final quota
state where applicable, and recoverable no-op handoff are committed; it has no
raw object, payload digest/size, or payload reference. Neither form of success
means MSK publication, Processor completion, normalization, grouping,
symbolication, canonical storage, or Query visibility.

Payload-bearing raw objects use the canonical storage path:

```text
environment/component/tenant/project/accepted-date/<watchtower-uuid-v7>
```

Acceptance metadata for payload-bearing units records the object key, digest,
size, `accepted_at`, tenant, project, raw-unit `watchtower_id`, parent linkage
where applicable, source protocol/format version, dedup generation, retention
cutoff, quota reservation/charge identity, and outbox state. No-op and
client-report records omit payload object key, digest, size, and reference and
retain only their bounded diagnostics and handoff state. No incomplete object
or unverified digest is a payload-bearing accepted record.

The versioned raw handoff family includes protocol-neutral initial-unit and
later-attachment variants. Payload-bearing variants carry project scope,
tenant UUID, raw-unit UUID, parent UUID when applicable, accepted time, source
protocol and format version, content/attachment digests, retention and policy
generations, correlation/idempotency context, and an opaque owner-issued
`RawPayloadReferenceV1`. A no-op handoff carries bounded disposition metadata
and no payload reference. Messages contain no Sentry DTO, DSN, credential,
private key, unrestricted payload, or usable S3 grant.

MSK uses the canonical storage settings: replication factor `3`,
`min.insync.replicas=2`, producer `acks=all`, and seven-day log retention.
Delivery is at least once; consumers are idempotent and no global ordering is
assumed. Processor retrieves bytes only through authenticated bounded
`RawPayloadFetchV1` requests. Ingest retires raw state only after it durably
records a matching terminal `RawHandoffDispositionV1` or a matching
`RawRetentionExpiryV1` fence. Redelivered identical dispositions are
idempotent. A conflicting disposition, generation, digest, or raw-unit
identity is an integrity failure: raw state is retained, no retirement occurs,
and the condition pages immediately.

## Quotas, capacity, and final fences

API owns configured quota policy and generations. Ingest consumes the
project-scoped policy through the existing authenticated versioned internal
boundary and owns the acceptance-side reservation/charge state. A reservation
is keyed by tenant, project, quota class, raw-unit identity, and content
identity. It is not reusable across projects or units.

In addition to final accepted-unit charges, the project policy includes a
project-scoped TUS staging byte budget and upload-count budget with a policy
generation. Ingest owns an idempotent `tus_staging` reservation keyed by
tenant, project, upload ID, and policy generation. Creation reserves one slot
and the declared upload bytes before any staging write; append uses only that
reservation. Binding converts it to the final attachment reservation, while
expiry, deletion, cancellation, and lifecycle fencing release it exactly once.
Staging exhaustion returns `429 rate_limited`; an unavailable or stale staging
policy returns `503 unavailable`. These reservations are separate from error
quantity and final attachment-byte charges.

The admission sequence is:

1. Resolve a matching durable duplicate before creating a new reservation.
2. Reserve the applicable error quantity and/or attachment bytes with an
   idempotent reservation identity.
3. Before the acceptance transaction, revalidate the reservation generation,
   project/organization state, DSN authorization revision, environment
   generation, retention/deletion fence, and security-projection freshness.
4. In the final Ingest transaction, mark the reservation charged and commit
   acceptance metadata and the processing outbox together.
5. Reconcile any uncertain reservation or acceptance outcome by identity;
   never assume rollback and never charge a retry twice.

Error quantity limits and quantities are owned by #19. Protocol limits are
owned by #16. Ingest owns attachment-byte charge mechanics and the reservation
fence, but it does not invent #19's quantity values. Rejections, exclusions,
conflicts, and duplicates add no charge. Processing failure, quarantine, and
retention expiry do not refund a durable accepted charge.

Accepted work may accumulate only within configured safe backlog count, bytes,
and age. When safe capacity is exhausted, new work returns `503 unavailable`
and already accepted work remains recoverable. A project quota or environment
registration limit returns `429 rate_limited`. An unavailable or unsafe quota,
authorization, lifecycle, or retention evaluation returns `503 unavailable`.
These outcomes remain distinguishable through status and retry policy even
though their public JSON detail is intentionally generic.

Required operating values are implementation gates, not defaults in this
contract. Before implementation, the owning operating contract must record and
load-validate request deadline, maximum concurrent requests, maximum concurrent
decoders/decompressors, bounded decoded-memory budget, project TUS staging
byte/count budgets and reservation reconciliation, retry base/max/jitter,
reconciliation cadence, quarantine count/bytes/age, backlog count/bytes/age,
and `Retry-After` derivation. Missing or invalid values prevent startup.
Load testing must verify that malformed, oversized, compressed, slow, or
concurrent inputs cannot bypass these limits or allocate unbounded memory.

## Retention, deletion, and recovery

Raw accepted data has a seven-day default cutoff from `accepted_at`; the
effective cutoff is the earlier of that class default and the active project
retention policy. The project policy never extends the class default. A
shortened policy installs the existing generation-matched pending and active
fences. Project deletion installs its irreversible lifecycle fence and blocks
new acceptance before the final commit; restore cannot reopen the project or
revive a deleted DSN, event dedup record, parent, attachment, reservation, or
handoff.

At every effective raw cutoff, when no matching terminal disposition has been
durably recorded, Jobs must send the project-scoped `RawRetentionExpiryV1`
sweep. This sweep is mandatory when Processor is unavailable and is an
idempotent safety net for any handoff that remains unresolved at the cutoff.
Ingest verifies the current cutoff, enumerates its own eligible state, records
`default_expired` or `policy_rejected`, publishes
`RawHandoffExpiryFenceV1`, and removes or makes the raw object, acceptance
metadata, outbox entry, and payload reference unavailable. Late fetches and
dispositions are rejected as stale. Processor performs its final current-cutoff
and local-fence check immediately before any canonical or derived commit.

Recovery is deterministic across each durable boundary:

| Failure point | Recovery rule |
| --- | --- |
| Before S3 write | No acceptance, charge, or payload persistence. |
| During/after S3 write before verification | Verify size/digest; delete or quarantine the incomplete orphan without acknowledging it. |
| After S3 verification before PostgreSQL commit | Reconcile the object against the idempotent acceptance identity; either commit the full acceptance or clean the orphan. Never report success from S3 existence alone. |
| After PostgreSQL/outbox commit before response | Treat response loss as unknown; retry resolves the one committed acceptance or conflict and reuses one charge. |
| After local commit before MSK publication | Outbox publication resumes; public success remains durable and recoverable. |
| After duplicate MSK delivery | Processor applies the same handoff identity idempotently. |
| After Processor fetch or processing before disposition | Redelivery resumes the same raw-unit outcome; Ingest retains raw state until a durable disposition or expiry fence, and a completed disposition leaves the minimal admission and parent-binding tombstones through their cutoffs. |
| After disposition send before Ingest recording | Redelivery is idempotent. A conflicting disposition is quarantined as an integrity failure and pages immediately. |
| During shutdown or restore | Readiness is removed, checkpoints/outboxes are persisted, registry and fence snapshots are reconciled, and accepted work is retried only while eligible. |

Orphan cleanup is bounded, tenant-scoped, digest-verified, and cannot delete a
committed object. Permanent handoff failures enter a bounded quarantine with
only safe metadata and remain operator-retryable until the applicable cutoff.
Quarantine never creates an unsupported terminal disposition, extends
retention, or bypasses deletion. Backlog overflow stops new acceptance before
the safe boundary and does not discard already committed work.

## Diagnostics, security, and operations

Structured diagnostics carry only bounded route/method, tenant/project scope,
source protocol/version, request/operation/message IDs, unit outcome, item
counts, exclusion reason, byte counts, latency, quota class, fence generation,
backlog state, and handoff state. They never contain DSNs, tokens, keys,
opaque session material, raw payloads, attachment bytes, or unrestricted user
data. High-cardinality IDs are correlation fields, not metric labels.

Page immediately for accepted-data-loss risk, unverifiable or conflicting raw
integrity, unrecoverable handoff, tenant-isolation risk, failed revocation or
deletion fences, and a disposition conflict. Ordinary retry, quota, backlog,
and projection lag metrics alert through the owning operational boundary.
Operator recovery is authenticated, least-privileged, time-limited, audited,
and cannot bypass authorization, retention, deletion, or project isolation.

All handoffs use the runtime contract's versioned project scope, common
envelope, mTLS/workload ACLs, idempotency, correlation, and W3C trace context.
Consumers must understand every handoff version retained during the replay
horizon. No public client consumes MSK or invokes an internal RPC.

## Implementation prerequisites and verification specification

Implementation is blocked until these separately owned prerequisites are
recorded and testable:

| Prerequisite | Owner | Required decision |
| --- | --- | --- |
| Supported protocol formats, routes, limits, and compatibility responses | #16 | The exact values restated in this contract. |
| Error quantity limits and collection quantity semantics | #19 | Error-unit quantities and their authoritative quota windows. |
| Operating values | #17 operating contract | Deadlines, concurrency, decoder/decompressor limits, memory, TUS staging byte/count budgets, backlog, quarantine, retry, reconciliation, and alert thresholds. |

The verification specification must use synthetic fixtures and prove:

- every #16 route, content type, encoding, limit, framing error, unsupported
  item, response, retry header, and no-payload guarantee;
- valid errors, native crashes, initial attachments, later attachments,
  client reports, no-ops, atomic invalid units, and independent valid-unit
  behavior;
- missing, malformed, rotated, revoked, cross-project, suspended, deleted,
  stale, and concurrently revoked DSNs, including 60-second projection and
  immediate-fence boundaries;
- concurrent identical event IDs, conflicting decompressed bytes, compressed
  retries, whitespace changes, protocol scope, seven-day expiry without retry
  extension, query-retention alias fencing while canonical events remain
  queryable, missing IDs, and deletion/restore fencing;
- equal and different attachment identities, attachment-before-parent,
  pre-processing attachment delivery, expired/deleted parents, TUS binding,
  and parent retention cutoffs;
- reservation races, one-charge duplicate handling, TUS staging byte/count
  exhaustion and release/conversion, quota exhaustion, environment
  registration/retirement/reactivation races, unsafe enforcement, service
  overload, and bounded Retry-After behavior;
- failures before and after S3 verification, PostgreSQL/outbox commit, MSK
  publication, Processor fetch/processing, disposition acknowledgement,
  shutdown, restore, orphan cleanup, quarantine, duplicate delivery, and
  conflicting dispositions;
- bounded decoding, decompression, duration, concurrency, memory, no-op
  acceptance without a raw object, deterministic multipart minidump digests,
  completed-disposition tombstones, backlog, quarantine, mandatory
  Processor-outage expiry sweeps, retention expiry, and deletion behavior; and
- safe logs/traces/metrics, immediate risk paging, mTLS/ACL isolation,
  tenant-scoped references, N/N-1 message compatibility, and absence of raw
  payloads or credentials in diagnostics.

## Non-goals and acceptance

This contract does not define normalization, privacy transformations,
enrichment, grouping, symbolication, canonical/query behavior, signal-specific
metrics/logs/traces, production rollout, UI, CLI, translations, a new SLA,
customer raw downloads, historical imports, or server-side sampling.

The contract is accepted only when every request-to-handoff state has a #16
external response; payload-bearing success requires verified immutable raw
storage while valid no-op success requires bounded metadata and a recoverable
no-op handoff; error units are atomic; concurrent duplicates reuse one
acceptance and one charge; conflicts reject content; public event aliases stay
unique while canonical events are queryable; later attachments obey parent
authorization, identity, deduplication, and retention rules; TUS staging is
bounded and released or converted exactly once; quota, unsafe, and overload
failures have distinguishable retry behavior; accepted work remains recoverable
through its retention cutoff; and all handoffs remain versioned,
protocol-neutral, tenant-scoped, and compatible with the existing fetch,
disposition, and fence interfaces.
