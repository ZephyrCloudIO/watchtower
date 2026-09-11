# Watchtower Sentry Compatibility Contract

## Scope and authority

This contract is the authoritative v1 compatibility boundary for issue #16.
It defines the Sentry-compatible public routes, wire formats, supported client
matrix, external DTOs, compatibility aliases, and conformance obligations. It
is documentation only and does not create adapters, servers, persistence,
runtime configuration, deployments, SDK forks, or a historical-data migration.

The component and runtime boundaries remain authoritative for routing,
failure isolation, internal transport, diagnostics, and release coordination:

- [`Watchtower component and deployment boundary`](servers-watchtower-components-contract.md)
  routes telemetry writes to Ingest and Sentry management routes to API.
- [`Watchtower server runtime`](servers-watchtower-runtime-contract.md) owns
  public/internal transport, workload authentication, common errors, and
  correlation.
- [`Watchtower control plane`](servers-watchtower-control-plane-contract.md)
  owns resource authority, authorization, credentials, quotas, revocation,
  lifecycle, audit, and security projections.
- [`Watchtower canonical telemetry and storage`](servers-watchtower-canonical-telemetry-storage-contract.md)
  owns canonical records, retention, deletion, replay, and durable handoff
  semantics.

This contract does not redefine #17 ingestion admission and raw handoff, #18
processing and privacy, #19 error grouping and issue lifecycle, #20 releases,
artifacts and symbolication, or #21 query semantics. It defines the external
translation and the observable compatibility behavior at their boundaries.

## Compatibility vocabulary

`Guaranteed` means the exact pinned client and workflow has an executable
conformance scenario and is release-blocking. `Accepted and asynchronous` means
the request has reached durable raw acceptance and recoverable processing
handoff; it does not mean that processing, symbolication, grouping, or query
visibility has completed. `Rejected` means the request or operation is outside
the v1 contract and has no persistence side effect. `Individually excluded`
means a structurally valid Envelope may still durably accept other supported
items while dropping that item and recording only bounded exclusion metadata.

Sentry DTOs exist only in the public API or Ingest adapter. The adapter maps
them to native Watchtower commands and queries. No adapter reads another
component's database, object store, cache, projection, or durable log.

## Pinned upstream baseline

The baseline is immutable for this contract. A tag is resolved to the commit
shown here; a floating branch or package `latest` label is not evidence.

| Upstream | Version | Resolved commit or release evidence | Associated versions |
| --- | --- | --- | --- |
| `getsentry/self-hosted` | `26.8.0` | [`73fe2f2747800873f0896aec283c45b6dcf34432`](https://github.com/getsentry/self-hosted/commit/73fe2f2747800873f0896aec283c45b6dcf34432) | `.env` pins Sentry, Relay, Snuba, Symbolicator, Taskbroker, Vroom, Uptime Checker, and Launchpad images to `26.8.0` |
| `getsentry/sentry` | `26.8.0` | [`9f26ea80281e2b0b250a2d9678a2c5cbd22b705c`](https://github.com/getsentry/sentry/commit/9f26ea80281e2b0b250a2d9678a2c5cbd22b705c) | Sentry `26.8.0` |
| `getsentry/relay` | `26.8.0` | [`d19a93863d4c766321ced3900f7215e0a7299834`](https://github.com/getsentry/relay/commit/d19a93863d4c766321ced3900f7215e0a7299834) | Relay `26.8.0` |
| `getsentry/sentry-cli` | `3.7.0` | [`8a16b06662ce98b3d030c3a80c3ab24305968ec6`](https://github.com/getsentry/sentry-cli/commit/8a16b06662ce98b3d030c3a80c3ab24305968ec6) | CLI release `3.7.0` |

The protocol baseline is additionally evidenced by the [official Envelope
format](https://develop.sentry.dev/sdk/foundations/envelopes/), [Envelope item
catalog](https://develop.sentry.dev/sdk/foundations/envelopes/envelope-items/),
[official platform catalog](https://docs.sentry.io/platforms/), the pinned
Sentry and Relay source trees, the pinned sentry-cli source, and the official
package registries listed in the client matrix below.

## Official client and plugin matrix

The inventory is the official platform catalog as observed on 2026-09-11,
excluding the three console platforms explicitly listed as unsupported. A
stable version is the highest non-prerelease release published by the cutoff
date. Every row identifies the package or repository that must be pinned in a
conformance fixture; a framework guide that shares a family package uses the
family pin and is still tested as a separate integration path.

### SDK families

| Family | Stable pin on 2026-09-11 | Official integrations covered | Authoritative release source |
| --- | --- | --- | --- |
| Android | `io.sentry:sentry-android:8.56.0` | Android runtime, Kotlin/Java Android, Compose | [Maven Central 8.56.0](https://repo1.maven.org/maven2/io/sentry/sentry-android/8.56.0/), [sentry-java](https://github.com/getsentry/sentry-java/releases/tag/8.56.0) |
| Apple | `sentry-cocoa 9.28.0` | iOS, macOS, tvOS, watchOS, visionOS, Swift and Objective-C | [sentry-cocoa 9.28.0](https://github.com/getsentry/sentry-cocoa/releases/tag/9.28.0) |
| Dart and Flutter | `sentry`/`sentry_flutter 9.30.0` | Dart VM, Flutter mobile, desktop and web | [sentry-dart 9.30.0](https://github.com/getsentry/sentry-dart/releases/tag/9.30.0), [pub.dev](https://pub.dev/packages/sentry_flutter/versions/9.30.0) |
| Elixir | `sentry 13.5.1` | Elixir and Plug/Phoenix-style integrations | [sentry-elixir 13.5.1](https://github.com/getsentry/sentry-elixir/releases/tag/13.5.1), [Hex](https://hex.pm/packages/sentry/13.5.1) |
| Go | `github.com/getsentry/sentry-go v0.49.0` | net/http, Echo, fasthttp, Fiber, Fiber v3, Gin, gRPC, Iris, Negroni | [sentry-go v0.49.0](https://github.com/getsentry/sentry-go/releases/tag/v0.49.0), [Go module](https://pkg.go.dev/github.com/getsentry/sentry-go@v0.49.0) |
| Godot Engine | `2.1.1` | Official Godot integration | [sentry-godot 2.1.1](https://github.com/getsentry/sentry-godot/releases/tag/2.1.1) |
| Java | `io.sentry:sentry:8.56.0` | Servlet, Spring, Spring Boot, JUL, Log4j2, Logback and Android Java | [Maven Central 8.56.0](https://repo1.maven.org/maven2/io/sentry/sentry/8.56.0/), [sentry-java 8.56.0](https://github.com/getsentry/sentry-java/releases/tag/8.56.0) |
| JavaScript | Base `@sentry/* 10.74.0` | Browser, Node, Angular, Astro, AWS Serverless, Bun, Cloudflare, Deno, Effect, Elysia, Ember, Gatsby, Google Cloud Serverless, Hono, NestJS, Next.js, Nitro, Nuxt, React, React Router, Remix, Solid, SolidStart, Svelte, SvelteKit, TanStack Start React, Vue, and WebAssembly | [sentry-javascript 10.74.0](https://github.com/getsentry/sentry-javascript/releases/tag/10.74.0), [npm](https://www.npmjs.com/org/sentry) |
| Kotlin Multiplatform | `io.sentry:sentry-kotlin-multiplatform:0.27.0` | Kotlin Multiplatform targets | [sentry-kotlin-multiplatform 0.27.0](https://github.com/getsentry/sentry-kotlin-multiplatform/releases/tag/0.27.0), [Maven Central 0.27.0](https://repo1.maven.org/maven2/io/sentry/sentry-kotlin-multiplatform/0.27.0/) |
| Native | `0.16.6` | C/C++, Crashpad, Breakpad, minidumps, Qt and native WebAssembly | [sentry-native 0.16.6](https://github.com/getsentry/sentry-native/releases/tag/0.16.6) |
| .NET | Base `Sentry 6.11.0` | ASP.NET Core, Azure Functions Worker, Entity Framework, Microsoft.Extensions.Logging, log4net, MAUI, NLog, Serilog, WinForms, WinUI, WPF and Xamarin; .NET 8+ NativeAOT through the bundled `Sentry.Native` integration | [sentry-dotnet 6.11.0](https://github.com/getsentry/sentry-dotnet/releases/tag/6.11.0), [NuGet](https://www.nuget.org/packages/Sentry/6.11.0) |
| PHP | `sentry/sentry 4.31.0` | PHP, Laravel and Symfony | [sentry-php 4.31.0](https://github.com/getsentry/sentry-php/releases/tag/4.31.0), [Packagist metadata](https://repo.packagist.org/p2/sentry/sentry.json) |
| PowerShell | `Sentry 6.11.0` | Official .NET PowerShell integration | [Sentry NuGet 6.11.0](https://www.nuget.org/packages/Sentry/6.11.0), [PowerShell platform docs](https://docs.sentry.io/platforms/powershell/) |
| Python | `sentry-sdk 2.69.1` | AIOHTTP, aiomysql, Airflow, Apache Beam, Apache Spark, Ariadne, arq, ASGI, asyncio, asyncpg, AWS Lambda, Boto3, Bottle, Celery, Chalice, ClickHouse driver, Cloud Resource Context, Django, Dramatiq, Falcon, FastAPI, Flask, GNU Backtrace, Google Cloud Functions, GQL, Graphene, gRPC, HTTPX, HTTPX2, Huey, LaunchDarkly, Litestar, logging, Loguru, MCP, OpenFeature, OTLP, pure_eval, PyMongo, Pyramid, pyreqwest, Quart, Ray, Redis, RQ, Sanic, Serverless, Socket, SQLAlchemy, Starlette, Starlite, Statsig, Strawberry, `sys.exit`, Tornado, Tryton, Typer, Unleash and WSGI | [sentry-python 2.69.1](https://github.com/getsentry/sentry-python/releases/tag/2.69.1), [PyPI](https://pypi.org/project/sentry-sdk/2.69.1/) |
| React Native | `@sentry/react-native 8.26.0` | React Native and Expo | [sentry-react-native 8.26.0](https://github.com/getsentry/sentry-react-native/releases/tag/8.26.0), [npm](https://www.npmjs.com/package/@sentry/react-native/v/8.26.0) |
| Ruby | `sentry-ruby 7.0.0` | Rack, Rails, Sidekiq, Resque and Delayed Job | [sentry-ruby 7.0.0](https://github.com/getsentry/sentry-ruby/releases/tag/7.0.0), [RubyGems](https://rubygems.org/gems/sentry-ruby/versions/7.0.0) |
| Rust | `sentry 0.49.2` | Actix Web, axum and `tracing` | [sentry-rust 0.49.2](https://github.com/getsentry/sentry-rust/releases/tag/0.49.2), [docs.rs](https://docs.rs/crate/sentry/0.49.2) |
| Unity | `4.10.0` | Official Unity integration and symbol upload | [sentry-unity 4.10.0](https://github.com/getsentry/sentry-unity/releases/tag/4.10.0) |
| Unreal Engine | `1.23.0` | Official Unreal Engine integration and crash upload | [sentry-unreal 1.23.0](https://github.com/getsentry/sentry-unreal/releases/tag/1.23.0) |

The Java, Kotlin, Android, Apple, .NET, Unity, Unreal, Native, and React
Native rows are separate execution rows even where they share a transport or
CLI. The family pin does not waive the required framework fixture.

The following separately distributed integrations have their own exact pins;
all other integrations in the family rows use the family release shown above.

| Package | Pin | Source |
| --- | --- | --- |
| `@sentry/capacitor` | `4.3.0` | [npm](https://www.npmjs.com/package/@sentry/capacitor/v/4.3.0) |
| `@sentry/electron` | `7.18.0` | [npm](https://www.npmjs.com/package/@sentry/electron/v/7.18.0) |
| `@sentry/react-native` | `8.26.0` | [npm](https://www.npmjs.com/package/@sentry/react-native/v/8.26.0) |
| `@sentry/expo-upload-sourcemaps` | `8.26.0` | [npm](https://www.npmjs.com/package/@sentry/expo-upload-sourcemaps/v/8.26.0) |
| `sentry/sentry-laravel` | `4.27.0` | [Packagist metadata](https://repo.packagist.org/p2/sentry/sentry-laravel.json) |
| `sentry/sentry-symfony` | `5.13.0` | [Packagist metadata](https://repo.packagist.org/p2/sentry/sentry-symfony.json) |
| `Sentry.Xamarin` | `2.1.0` | [NuGet](https://www.nuget.org/packages/Sentry.Xamarin/2.1.0) |

The official JavaScript package names in the base row are `@sentry/angular`,
`@sentry/astro`, `@sentry/aws-serverless`, `@sentry/browser`, `@sentry/bun`,
`@sentry/cloudflare`, `@sentry/deno`, `@sentry/effect`, `@sentry/elysia`,
`@sentry/ember`, `@sentry/gatsby`, `@sentry/google-cloud-serverless`,
`@sentry/hono`, `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/nitro`,
`@sentry/node`, `@sentry/nuxt`, `@sentry/react`, `@sentry/react-router`,
`@sentry/remix`, `@sentry/solid`, `@sentry/solidstart`, `@sentry/svelte`,
`@sentry/sveltekit`, `@sentry/tanstackstart-react`, and `@sentry/vue`, all at
`10.74.0`. The official Go, Java, Python, Ruby, Rust, and .NET integrations
listed in the family row are modules of the pinned family release unless a
separate package pin is shown.

### Official build and artifact plugins

| Plugin or upload integration | Stable pin | Required workflow | Source |
| --- | --- | --- | --- |
| `sentry-cli` | `3.7.0` | Releases, source maps, debug files, chunks, deployments | [sentry-cli 3.7.0](https://github.com/getsentry/sentry-cli/releases/tag/3.7.0) |
| `@sentry/cli` | `3.7.0` | Releases, source maps, debug files, chunks, deployments | [sentry-cli 3.7.0](https://github.com/getsentry/sentry-cli/releases/tag/3.7.0) |
| `@sentry/webpack-plugin` | `5.4.0` | JavaScript source maps and release metadata | [npm](https://www.npmjs.com/package/@sentry/webpack-plugin/v/5.4.0) |
| `@sentry/vite-plugin` | `5.4.0` | Vite source maps and release metadata | [npm](https://www.npmjs.com/package/@sentry/vite-plugin/v/5.4.0) |
| `@sentry/rollup-plugin` | `5.4.0` | Rollup source maps and release metadata | [npm](https://www.npmjs.com/package/@sentry/rollup-plugin/v/5.4.0) |
| `@sentry/esbuild-plugin` | `5.4.0` | esbuild source maps and release metadata | [npm](https://www.npmjs.com/package/@sentry/esbuild-plugin/v/5.4.0) |
| `@sentry/bundler-plugins` | `10.74.0` | Shared official bundler integration path | [npm](https://www.npmjs.com/package/@sentry/bundler-plugins/v/10.74.0) |
| `@sentry/nextjs`, `@sentry/nuxt`, `@sentry/gatsby`, `@sentry/astro`, `@sentry/sveltekit` | `10.74.0` | Framework build hooks and source maps | [sentry-javascript 10.74.0](https://github.com/getsentry/sentry-javascript/releases/tag/10.74.0) |
| `@sentry/netlify-build-plugin` | `1.1.1` | Netlify source-map upload | [npm](https://www.npmjs.com/package/@sentry/netlify-build-plugin/v/1.1.1) |
| `@sentry/expo-upload-sourcemaps` | `8.26.0` | Expo/React Native source maps | [npm](https://www.npmjs.com/package/@sentry/expo-upload-sourcemaps/v/8.26.0) |
| `io.sentry:sentry-android-gradle-plugin` | `6.22.0` | Android ProGuard/R8 mapping and native symbol upload | [Maven Central 6.22.0](https://repo1.maven.org/maven2/io/sentry/sentry-android-gradle-plugin/6.22.0/) |
| `sentry_dart_plugin` | `3.4.0` | Flutter symbol/source-map upload | [pub.dev](https://pub.dev/packages/sentry_dart_plugin/versions/3.4.0) |
| `fastlane-plugin-sentry` | `2.6.3` | Apple dSYM through standalone DIF upload and source maps through release-artifact upload | [RubyGems](https://rubygems.org/gems/fastlane-plugin-sentry/versions/2.6.3), [source](https://github.com/getsentry/sentry-fastlane-plugin) |
| `@sentry/babel-plugin-component-annotate` | `5.3.0` | Component annotation only; the resulting SDK request remains covered by its SDK/plugin fixture | [npm](https://www.npmjs.com/package/@sentry/babel-plugin-component-annotate/v/5.3.0) |

Each plugin row has its own release-blocking fixture. `plugin.<name>` uses the
normalized package name and is expanded once per package or distribution, not
once per shared implementation:

| Plugin class | Required protocol path | Fixture and assertion |
| --- | --- | --- |
| `sentry-cli` | `GET /api/0/`; release routes; source-map/debug-file file or chunk routes; deployment route | `plugin.sentry-cli.release-artifact-deploy` creates/reads/updates/finalizes a release, uploads one source map and one debug file, exercises chunk negotiation/assembly/polling, and records a deployment |
| `@sentry/cli` | `GET /api/0/`; release routes; source-map/debug-file file or chunk routes; deployment route | `plugin.sentry-cli-npm.release-artifact-deploy` independently exercises the package distribution through the same release, artifact, chunk, assembly, polling, and deployment assertions |
| Webpack, Vite, Rollup, esbuild, bundler, Next.js, Nuxt, Gatsby, Astro, SvelteKit, Netlify | Artifact bundle or release-file upload route selected by the pinned plugin | `plugin.<normalized-name>.source-map` verifies release association, checksum idempotency, bounded upload, asynchronous symbolication, and safe polling |
| Expo upload | Artifact bundle/release-file route with React Native release and dist fields | `plugin.expo-upload-sourcemaps.source-map` verifies the Expo bundle, source map, release, dist, and processing state |
| Android Gradle | DIF chunk capability, chunk upload, and DIF assembly routes | `plugin.android-gradle.debug-file` verifies ProGuard/R8 mapping and native symbol registration, duplicate chunks, assembly, and polling |
| `sentry_dart_plugin` | Artifact bundle/release-file route | `plugin.dart.source-map` verifies Flutter symbol/source-map upload and asynchronous completion |
| Fastlane Sentry | DIF chunk capability, project-scoped DIF chunk upload, and DIF assembly for dSYMs; release artifact/bundle route for source maps | `plugin.fastlane.debug-file` verifies release-independent dSYM upload through DIF assembly and `plugin.fastlane.source-map` verifies source-map upload through the release-artifact path |
| Component annotation and SDK-bundled upload scripts | No standalone server route; the resulting SDK or artifact request uses the row's ordinary or artifact path | `plugin.bundled-script.<normalized-name>` verifies the generated request only; annotation is not granted a separate capability |

The official catalog also lists `@sentry/babel-plugin-component-annotate` and
the platform-specific upload scripts bundled with the SDKs. They are included
in the fixture inventory when used by a supported build, but component
annotation itself has no Sentry server route and is not treated as a separate
ingestion capability. Community SDKs and plugins have protocol compatibility
only and no execution guarantee.

### Required SDK and framework fixture registry

Every integration named in an SDK-family row or the separately distributed
integration table is a separate release-gate fixture, even when it shares the
family package and transport. The following registry makes the required route
and scenario explicit; a brace list expands to one fixture per literal
integration name in the corresponding matrix row.
Fixture IDs are stable identifiers for the executable conformance harness, not
examples or optional coverage.

| Matrix entry | Required protocol path | Normative fixture IDs and scenario |
| --- | --- | --- |
| Android (`Android runtime`, `Kotlin/Java Android`, `Compose`) | `POST /api/<project_id>/envelope/`; native crash variant uses `POST /api/<project_id>/minidump/` when emitted by the pinned client | `sdk.android.{runtime,kotlin-java,compose}.ordinary`; `sdk.android.native-crash` captures the minidump or Envelope event, attachment, durable acknowledgement, and later processing state |
| Apple (`iOS`, `macOS`, `tvOS`, `watchOS`, `visionOS`, Swift, Objective-C) | Envelope; pinned Cocoa native-crash integration uses the Envelope transport | `sdk.apple.{ios,macos,tvos,watchos,visionos,swift,objc}.ordinary`; `sdk.apple.native-crash` records the exact pinned Cocoa Envelope output |
| Dart/Flutter (`Dart VM`, mobile, desktop, web) | Envelope | `sdk.dart.{vm,flutter-mobile,flutter-desktop,flutter-web}.ordinary` |
| Elixir (`Elixir`, Plug/Phoenix) | Envelope | `sdk.elixir.{runtime,plug-phoenix}.ordinary` |
| Go (`net/http`, Echo, fasthttp, Fiber, Fiber v3, Gin, gRPC, Iris, Negroni) | Envelope | `sdk.go.{net-http,echo,fasthttp,fiber,fiber-v3,gin,grpc,iris,negroni}.ordinary` |
| Godot Engine | Envelope for ordinary errors; pinned Godot 2.1.1 native crashes use `POST /api/<project_id>/minidump/` with Crashpad multipart fields | `sdk.godot.ordinary`; `sdk.godot.native-crash` sends `upload_file_minidump`, the emitted `prod`, `ver`, `ptype`, `plat`, and `guid` scalar annotations where present, and the optional `sentry` metadata part |
| Java (`Servlet`, Spring, Spring Boot, JUL, Log4j2, Logback) | Envelope | `sdk.java.{servlet,spring,spring-boot,jul,log4j2,logback}.ordinary`; `sdk.java.native-crash` is not applicable to pinned non-Android Java `8.56.0` (Android Java native coverage is in `sdk.android.native-crash`) |
| JavaScript (each literal `@sentry/*` package in the base row above) | Envelope | `sdk.javascript.<normalized-package>.ordinary` for every base-row package; the fixture sends an exception through that integration's default transport |
| Separately distributed JavaScript (`@sentry/capacitor`, `@sentry/electron`) | Envelope | `sdk.javascript.capacitor.ordinary` and `sdk.javascript.electron.ordinary`; each fixture installs its exact pinned package and sends an exception through its default transport |
| JavaScript WebAssembly | Envelope | `sdk.javascript.webassembly.ordinary` runs a deterministic WebAssembly module through the pinned JavaScript SDK family and asserts the default transport's ordinary error admission |
| Kotlin Multiplatform | Envelope | `sdk.kotlin-multiplatform.ordinary` |
| Native (C/C++, Crashpad, Breakpad, minidump, Qt, native WebAssembly) | Envelope and pinned non-Envelope minidump upload | `sdk.native.{c-cpp,crashpad,breakpad,minidump,qt,wasm}.ordinary`; `sdk.native.crash` |
| .NET (each literal ASP.NET Core, Azure Functions Worker, Entity Framework, logging, log4net, MAUI, NLog, Serilog, WinForms, WinUI, WPF, Xamarin integration) | Envelope; the pinned .NET 8+ NativeAOT `Sentry.Native` integration emits its native crash through the Envelope route | `sdk.dotnet.<normalized-integration>.ordinary`; `sdk.dotnet.native-crash` uses `Sentry 6.11.0` NativeAOT and `POST /api/<project_id>/envelope/` |
| PHP (`PHP`, Laravel, Symfony) | Envelope; legacy `store` is covered by the legacy-transport fixture | `sdk.php.{php,laravel,symfony}.ordinary`; `sdk.php.legacy-store` |
| PowerShell | Envelope | `sdk.powershell.ordinary` |
| Python (each literal integration listed above) | Envelope | `sdk.python.<normalized-integration>.ordinary` for every listed integration |
| React Native and Expo | Envelope; native crash variant uses the minidump route when emitted | `sdk.react-native.{react-native,expo}.ordinary`; `sdk.react-native.native-crash` |
| Ruby (`Rack`, Rails, Sidekiq, Resque, Delayed Job) | Envelope | `sdk.ruby.{rack,rails,sidekiq,resque,delayed-job}.ordinary` |
| Rust (`Actix Web`, axum, `tracing`) | Envelope | `sdk.rust.{actix-web,axum,tracing}.ordinary` |
| Unity | Envelope and pinned native crash/minidump upload | `sdk.unity.ordinary`; `sdk.unity.native-crash` |
| Unreal Engine | Envelope and pinned native crash/minidump upload | `sdk.unreal.ordinary`; `sdk.unreal.native-crash` |

An ordinary fixture must use the pinned SDK's default transport, a fixed DSN,
one deterministic error, one event ID, bounded tags/context, and an
attachment where that integration supports attachments. A native fixture must
record the exact non-Envelope request or Envelope item the SDK emits. Each
fixture asserts the expected status, request/correlation ID shape, durable
acceptance state, and asynchronous owner outcome; it fails if an excluded
payload is persisted or if acceptance is reported as processing completion.
Browser-facing JavaScript fixtures additionally send the Envelope from an
origin different from the Watchtower DSN host, exercise the allowlisted CORS
response and preflight behavior, and verify that a disallowed origin is
rejected before acceptance.

### Explicit v1 exclusions

Nintendo Switch, PlayStation, and Xbox SDKs are excluded. Their required
non-public packages and processing paths cannot be verified from the public
baseline. Sessions and release health, feedback, tracing, logs, metrics,
profiling, replay, monitors, performance products, user feedback, alert rules,
and other non-error product capabilities are excluded even when a client can
emit their wire formats. Issue merging/splitting/deletion/assignment,
bookmarks, repository integrations, automatic commit association, release
deletion, and broad organization administration are also excluded.

## Public route and method contract

The following matrix is exhaustive for v1. A route not listed as supported is
rejected with the stated unsupported behavior; it is never silently translated
to a native route.

### Telemetry admission

| Route | Methods | Authentication | v1 behavior |
| --- | --- | --- | --- |
| `/api/<project_id>/envelope/` | `POST` | Collection-only DSN in `X-Sentry-Auth`, DSN query parameters, or the DSN URL used by the pinned SDK | Supported for error events, attachments, client reports, and native crash items. Every structurally valid Envelope returns `200` with an empty response body, including accepted, mixed, empty, and unsupported-only Envelopes; durable acceptance is returned before asynchronous processing/query visibility. |
| `/api/<project_id>/envelope/` | `OPTIONS` | Project alias and request `Origin` | Supported only for a configured project-origin CORS preflight. Returns `204` with no persistence side effect; a disallowed origin receives `403` with no CORS allow headers. |
| `/api/<project_id>/store/` | `POST` | Collection-only DSN | Supported legacy JSON error path required by a pinned client. The body is converted to one error event and follows Envelope admission semantics. Successful admission returns `200` with a zero-length body and request-ID headers. |
| `/api/<project_id>/minidump/` | `POST` | Collection-only DSN | Supported for pinned crash workflows whose fixture specifies the non-Envelope minidump path. `multipart/form-data` and the pinned client field names are accepted. Successful admission returns `200` with a zero-length body and request-ID headers. |
| `/api/<project_id>/security-report/` | `POST` | Collection-only DSN | Explicitly unsupported in v1; returns `501 unsupported_capability` with no persistence side effect because security reports are not error telemetry. |
| Any other `/api/<project_id>/...` ingestion route | Any | Any | `404` or `405` according to whether the path or method is unknown; no side effect. |

`project_id` is a compatibility alias accepted only at the adapter boundary.
It resolves to one canonical lowercase UUID v7 project identity within the
authenticated tenant. It is never reused after deletion and is never accepted
from an unrelated tenant.

Browser-origin requests to the Envelope route require an exact match against
the project's configured browser-origin allowlist. A request without `Origin`
uses the ordinary non-browser contract. For an allowlisted origin, every
preflight and actual response, including safe errors, contains
`Access-Control-Allow-Origin` set to that exact origin and `Vary: Origin`; it
never uses `*` and never enables credentials. The preflight response also
contains `Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: Content-Type, X-Sentry-Auth, Sentry-Trace,
Baggage, X-Request-ID`, and `Access-Control-Max-Age: 600`. Actual responses
expose only `X-Request-ID` and `X-Watchtower-Request-ID`. An origin absent from
the allowlist, or a project with no configured allowlist, receives
`403 permission_denied` before payload acceptance and no CORS allow headers.

### Management and release routes

| Route family | Methods and behavior |
| --- | --- |
| `/api/0/` | `GET` authentication/capability read required by sentry-cli; it returns only safe server and compatibility metadata. Mutations and unlisted methods are rejected. |
| `/api/0/organizations/` | `GET` organization reads for the authenticated principal; pagination and current authorization apply. Organization creation, deletion, membership, team, SSO, and broad settings administration are not exposed through Sentry compatibility. |
| `/api/0/organizations/<organization>/` | `GET` organization read. Unknown or unauthorized organizations return indistinguishable `404`. |
| `/api/0/organizations/<organization>/projects/` | `GET` project list and `POST` project creation. Creation uses the native lifecycle barrier and returns `202` plus an operation ID until all required owners and Jobs acknowledge enablement. |
| `/api/0/projects/<organization>/<project>/` | `GET` project read, `PUT` supported project settings including the browser-origin allowlist, and `DELETE` project deletion. Project deletion requires a current Owner/Admin user session recently reauthenticated within five minutes under applicable organization SSO/MFA conditions, exact confirmation, idempotency, lifecycle fences, and never reports success before authoritative completion. |
| `/api/0/projects/<organization>/<project>/keys/` | `GET` DSN metadata/public DSNs and `POST` issuance. The request may contain only bounded DSN name/platform metadata; plaintext management tokens are never returned. |
| `/api/0/projects/<organization>/<project>/keys/<key_id>/` | `PUT` rotation and `DELETE` revocation for the scoped DSN key. Rotation returns the new public DSN only after the native credential fence is durable; revocation never returns a secret. |
| `/api/0/projects/<organization>/<project>/issues/` | `GET` issue list with bounded filters and cursor pagination, and `PUT` only for the pinned bulk status operation with a bounded filter and supported status change. `POST`, `DELETE`, and unbounded bulk operations are unsupported. |
| `/api/0/issues/<issue>/` | `GET` issue read and `PUT` status transitions for `resolved`, `unresolved`, and `ignored`. Issue assignment, merge, split, delete, bookmark, alert, and comment operations are unsupported. |
| `/api/0/issues/<issue>/events/` | `GET` issue event list with bounded cursor pagination. |
| `/api/0/projects/<organization>/<project>/events/` | `GET` project event list with bounded cursor pagination for the pinned CLI/query workflow. |
| `/api/0/projects/<organization>/<project>/events/<event>/` | `GET` event read subject to tenant, project, retention, and query authorization. The external event identifier is never a Watchtower primary key. |
| `/api/0/organizations/<organization>/releases/` | `GET` release list and `POST` release creation. Release reads/updates/finalization use the exact sentry-cli request fields and idempotency rules. |
| `/api/0/projects/<organization>/<project>/releases/` | `GET` release list scoped to a project, as used by sentry-cli. Release creation remains organization-scoped. |
| `/api/0/organizations/<organization>/releases/<version>/` | `GET` and `PUT` release metadata. Release deletion is unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/commits/` | `GET` bounded release commit metadata required by `sentry-cli info`; commit association writes are unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/previous-with-commits/` | `GET` previous release summary required by `sentry-cli info`, subject to project and tenant scope. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/` | `GET` file listing and `POST` upload. Source maps and debug files are handled by the artifact authority. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/<file_id>/` | `DELETE` the one release file identified by `file_id` for an idempotent failed-upload cleanup; deletion never bypasses lifecycle rules. |
| `/api/0/organizations/<organization>/chunk-upload/` | `GET` organization-scoped artifact-bundle chunk capability for the pinned sentry-cli. The response supplies the upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. The returned `url` is itself an admitted organization-scoped multipart `POST` route; its request carries no project field. |
| `/api/0/projects/<organization>/<project>/chunk-upload/` | `GET` project-scoped DIF chunk capability for the pinned sentry-cli. The response supplies a project-bound upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. |
| `/api/0/projects/<organization>/<project>/files/difs/chunks/` (or the exact project-bound upload URL returned by the DIF capability response) | `POST` multipart chunk upload using `file` or `file_gzip` parts keyed by SHA-1 checksum. A matching checksum is idempotent; conflicting bytes are `409`. |
| `/api/0/projects/<organization>/<project>/files/difs/assemble/` | `POST` DIF assembly with the pinned sentry-cli request map. The response reports each digest's `state`, `missingChunks`, bounded `detail`, and registered DIF when complete. Polling repeats this request with the same body and optional idempotency key. |
| `/api/0/organizations/<organization>/artifactbundle/assemble/` | `POST` source-map/artifact-bundle assembly with `checksum`, ordered `chunks`, `projects`, `version`, and optional `dist`; `202` remains pending until artifact processing completes. `checksum` is the lowercase SHA-1 of the ordered decompressed chunk bytes defined below. |
| `/api/0/operations/<operation_id>/` | `GET` Watchtower compatibility polling extension for project/lifecycle/artifact operations that return an operation ID and do not have an upstream polling request. The operation ID is canonical UUID v7, tenant-scoped, non-reusable, and returns the defined operation status DTO and state machine below. |
| `/api/0/organizations/<organization>/releases/<version>/deploys/` | `GET` and `POST` deployment records. Deployment records are release metadata and do not schedule deployment work. |
| Any other `/api/0/...` route | Any | An unknown path returns safe `404` with no persistence side effect; an unsupported method on a known supported path returns `405`; explicitly unsupported capabilities are listed below and return `501`. |

The following commonly probed upstream-shaped routes are explicitly
unsupported and return `501 unsupported_capability` with no persistence side
effect: `POST /api/0/organizations/<organization>/releases/<version>/finalize/`
(the pinned CLI finalizes with `PUT` on the release resource) and
`GET /api/0/events/<event>/` (the project-scoped event route is required). Any
method addressed to one of these explicitly unsupported paths has the same
`501` result. Unknown paths return `404`, while an unsupported method on a
known supported path returns `405`.

Organization and project path slugs are compatibility aliases only. The
adapter resolves them under the canonical tenant UUID and expected resource
generation; a slug cannot select a resource in another tenant. A deleted
resource's slug may be reused only after deletion completes and only by a new
resource generation. A replacement receives a new canonical UUID, generation,
and credentials.

### Browser-origin project setting

API owns the project setting `browser_origins`. A project `PUT` may replace it
with a JSON array of unique serialized origins using the existing `Manage`
authority, observed resource version, and idempotency rules. Each value has an
`http` or `https` scheme, an ASCII host, and an optional port, with no path,
query, fragment, wildcard, or credentials. The stored form uses lowercase
scheme/host and canonical origin serialization; the empty array disables
browser-origin admission.

Project creation persists an empty `browser_origins` array as part of its
initial settings. API propagates each versioned change to Ingest through the
existing settings-application handoff and exposes the new value as applied
only after the generation-matched acknowledgement. A pending or unverifiable
application does not broaden admission. Disablement and deletion fence further
browser-origin requests and clear the setting with normal project lifecycle
cleanup. The project DTO below is the read-back interface, so a customer can
configure and verify the exact allowlist without undocumented state. A project
has at most 100 origins, and each canonical serialized origin is at most 2,048
ASCII bytes; either limit returns `400 invalid_request` before persistence.

### Suspended organization behavior

The control-plane suspension fence is evaluated before every compatibility
route. While an organization is suspended, collection, ordinary organization
and project reads, issue/event reads, DSN reads or mutations, release and
artifact operations, deployment records, and ordinary project changes are
blocked; no full Organization or Project DTO, including `browser_origins`, is
returned. A current Owner/Admin user session that passes the control-plane
reauthentication requirement receives `403 permission_denied` with exactly this
bounded response shape:

```json
{
  "code": "permission_denied",
  "detail": "Organization access is suspended.",
  "suspension": {
    "status": "suspended",
    "reason": "customer-safe bounded reason",
    "support_url": "https://support.example.invalid/organizations/<organization>/suspension"
  }
}
```

`reason` is the operator-provided customer-safe reason, limited to 1,024
characters, and `support_url` is the configured HTTPS support route. Other
principals and credentials receive the ordinary indistinguishable `404
not_found` or `401 invalid_authentication` result; they cannot use suspension
responses to enumerate organizations. The only compatibility mutation allowed
while suspended is the control-plane restricted project-deletion request for a
current Owner/Admin user session with exact name confirmation, fresh
authentication, the expected version, and idempotency; it returns only the
pending deletion operation and never a resource DTO. Organization deletion,
suspension removal, token issuance, and all other changes remain unavailable.

## Wire contract

### Authentication and authorization

- Collection routes accept only a current project-scoped collection DSN. A DSN
  does not grant management, query, artifact, release, issue, or event-read
  authority. Environment names are data, not authorization boundaries.
- Management routes accept a current Watchtower personal token or explicitly
  scoped organization service token except where the native control-plane
  action requires a user session. Project deletion accepts only a current
  Owner/Admin user session recently reauthenticated within five minutes under
  applicable organization SSO/MFA conditions; personal and service tokens
  cannot delete projects. Sentry token strings are not Watchtower credentials
  and are not imported or persisted.
- The adapter accepts the pinned clients' `X-Sentry-Auth`, DSN query parameters,
  `Authorization: Bearer`, and `X-Sentry-Token` spellings, plus the native
  authenticated user session required for project deletion, only when they
  carry a valid Watchtower credential of the correct kind. Credentials are
  never logged, returned, copied into internal messages, or used to bypass
  current authorization.
- Authentication failure is `401`; an inaccessible resource is `404`; an
  authenticated but unauthorized visible action is `403`; stale observed
  versions and lifecycle conflicts are `409`; exhausted quota is `429`; an
  unavailable authorization or owner dependency is `503`.
- API and Ingest perform the first authorization check. The final authority
  owner independently validates tenant, actor, action, credential scope,
  resource state, revocation revision, retention fence, and security-projection
  freshness. A stale or unavailable security projection fails closed.

### Request and response fields

Every compatible request may carry `X-Request-ID`; the adapter validates a
canonical UUID v7 value or generates one. The exact mutation precondition wire
fields are:

- `Idempotency-Key` is a single HTTP header containing 1–128 printable ASCII
  bytes (`0x21`–`0x7e`), with no whitespace, controls, quotes, or duplicate
  header values. It is bound to the authenticated principal, operation, target
  scope, and canonical request-body digest. Required operations reject a
  missing or malformed key with `400 invalid_request` before mutation; reusing
  a key for different scope, operation, or body returns `409 conflict`.
- A versioned resource response includes a strong `ETag` header in the exact
  form `"v<decimal-version>"`, where `<decimal-version>` is a positive base-10
  API resource version with no leading zeroes. `ETag` is never weak and is not
  returned as a JSON field. A mutation supplies the observed version only in a
  single `If-Match` header containing that exact quoted ETag; `If-Match: *`, an
  unquoted value, a weak tag, a list, or a JSON/query-string version is invalid
  and returns `400 invalid_request`. A mismatched tag returns `409 conflict`.

The adapter forwards neither credential material nor unrestricted customer
payloads into internal messages.

| Operation | Required request fields | Successful response fields |
| --- | --- | --- |
| Envelope/event admission | Project DSN, project alias, Envelope headers, item headers/payloads, and a supported event ID for event items | Envelope `POST` returns `200` with an empty body and request ID headers; legacy or client-specific body expectations retain the preserved scoped external event ID |
| Organization/project read | Organization/project compatibility alias and current management credential | Upstream-compatible resource DTO containing only currently readable fields, canonical-safe pagination link, and request ID |
| Project create/update/delete | Organization scope, project name/platform or changed settings, current authorization, observed version for settings, and idempotency key for create/delete | Resource alias and canonical-safe DTO, or `202` operation ID while lifecycle barriers remain pending |
| DSN issue/rotate/revoke | Project scope, requested DSN name/platform where supplied, current Manage authority, and idempotency for mutation | Public DSN and non-secret metadata; management-token plaintext is never returned by a compatibility route |
| Issue/event read or status transition | Tenant/project-scoped issue or event alias, bounded filters or status, and current credential | The fixed Issue or Event DTO below, request ID, and cursor link when paginated |
| Release mutation | Organization/project scope, release version, bounded metadata, and idempotency for create/finalize | Release alias/version, operation state, and request ID |
| Release artifact upload | Project/release version scope, logical filename, optional distribution, bounded bytes, artifact type, and management credential | Artifact/file/checksum identity, upload or assembly operation ID, and `202` pending state when asynchronous |
| DIF chunk/assembly upload | Project scope, full-file checksum, name, optional `debug_id`, ordered chunks, bounded bytes, and management credential | DIF checksum/debug identity, assembly operation ID, and `202` pending state when asynchronous |
| Release file deletion | Exact project/release scope, required `file_id`, current Manage authority, observed resource version when supplied, and a required idempotency key | `204` with an empty body after durable deletion; repeating the same target is the same successful no-op |
| Deployment record | Organization scope, release version, environment/name/timestamp, bounded metadata, and idempotency key | Deployment identity, release reference, timestamp, and request ID |

### Organization and project DTOs

Organization and project reads use the following minimal safe schemas. Every
listed field is present; `platform` is the only nullable field. List routes
return arrays of the same objects, and pagination remains in the `Link` header
and request ID rather than an additional JSON envelope. Unknown upstream fields
are omitted, never emitted as `null`, and never become an extension surface.

| DTO | Field | Type and rule |
| --- | --- | --- |
| Organization | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Organization | `slug` | Required string compatibility alias |
| Organization | `name` | Required string |
| Organization | `status` | Required enum: `active`, `suspended`, or `deleting` |
| Organization | `dateCreated` | Required RFC 3339 UTC string |
| Project | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Project | `slug` | Required string compatibility alias |
| Project | `name` | Required string |
| Project | `platform` | Nullable string; `null` means no platform is configured |
| Project | `status` | Required enum: `active`, `disabled`, or `deleting` |
| Project | `dateCreated` | Required RFC 3339 UTC string |
| Project | `organization` | Required object containing exactly `id`, `slug`, and `name` using the Organization field types above |
| Project | `browser_origins` | Required array of canonical serialized origin strings; an empty array means no browser origin is allowed |

The organization object nested in a project DTO intentionally omits status and
creation metadata. The exact response body is therefore stable across detail
and list reads, and it exposes no secrets, internal IDs, or raw storage data.

### Release workflow DTOs

Release, artifact, DIF, DSN, and deployment responses use the fixed objects
below. List routes return direct arrays of the same objects. Every listed field
is present unless it is explicitly nullable; unknown upstream fields are
omitted rather than emitted as `null`, and nested objects contain no fields
beyond those listed.

| DTO | Field | Type and rule |
| --- | --- | --- |
| Release | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Release | `version` | Required non-empty release version string |
| Release | `shortVersion` | Nullable string |
| Release | `ref` | Nullable string |
| Release | `url` | Nullable HTTP(S) URL |
| Release | `dateCreated` | Required RFC 3339 UTC string |
| Release | `dateStarted` | Nullable RFC 3339 UTC string |
| Release | `dateReleased` | Nullable RFC 3339 UTC string |
| Release | `firstEvent` | Nullable RFC 3339 UTC string |
| Release | `lastEvent` | Nullable RFC 3339 UTC string |
| Release | `newGroups` | Required non-negative integer |
| Release | `commitCount` | Required non-negative integer |
| Release | `deployCount` | Required non-negative integer |
| Release | `projects` | Required array of objects containing exactly string `id`, `slug`, and `name` |
| Release | `environments` | Required array of unique strings |
| Release | `lastCommit` | Nullable object containing exactly string `id`, `message`, `authorName`, `authorEmail`, and RFC 3339 UTC `dateCreated` |
| Artifact | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Artifact | `name` | Required logical filename string |
| Artifact | `size` | Required non-negative integer decompressed byte count |
| Artifact | `sha1` | Required lowercase 40-character hexadecimal SHA-1 of the artifact bytes |
| Artifact | `type` | Required enum: `source_map`, `debug_file`, or `artifact_bundle` |
| Artifact | `release` | Nullable release version string |
| Artifact | `dist` | Nullable distribution string |
| Artifact | `project` | Nullable project compatibility alias string |
| Artifact | `dateCreated` | Required RFC 3339 UTC string |
| Artifact | `state` | Required enum: `accepted`, `processing`, `processed`, or `failed` |
| DIF | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| DIF | `debug_id` | Nullable lowercase UUID string |
| DIF | `name` | Required logical filename string |
| DIF | `object_name` | Nullable string |
| DIF | `code_id` | Nullable string |
| DIF | `size` | Required non-negative integer assembled byte count |
| DIF | `sha1` | Required lowercase 40-character hexadecimal full-file SHA-1 |
| DIF | `type` | Required enum: `debug`, `proguard`, `breakpad`, or `sourcebundle` |
| DIF | `state` | Required enum: `accepted`, `processing`, `processed`, or `failed` |
| DIF | `missingChunks` | Required array of lowercase 40-character hexadecimal SHA-1 values; empty when complete |
| DIF | `detail` | Nullable bounded safe processing detail |
| DIF | `dateCreated` | Required RFC 3339 UTC string |
| DSN | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| DSN | `name` | Required string |
| DSN | `public` | Required public DSN key string |
| DSN | `projectId` | Required project compatibility alias string |
| DSN | `projectSlug` | Required project slug string |
| DSN | `isActive` | Required boolean |
| DSN | `dateCreated` | Required RFC 3339 UTC string |
| DSN | `dsn` | Required public DSN URL; it contains no management credential |
| DSN | `browserOrigins` | Required array of canonical serialized origin strings |
| Deployment | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Deployment | `environment` | Required string |
| Deployment | `name` | Nullable string |
| Deployment | `url` | Nullable HTTP(S) URL |
| Deployment | `dateStarted` | Nullable RFC 3339 UTC string |
| Deployment | `dateFinished` | Nullable RFC 3339 UTC string |
| Deployment | `dateCreated` | Required RFC 3339 UTC string |
| Deployment | `release` | Required object containing exactly the non-empty release version string `version` |

DSN responses never contain `secret`, `clientSecret`, management-token
plaintext, or any other credential field, including as a nullable field. A
successful DSN rotation returns the same fixed DSN DTO with the new public DSN.
Artifact and DIF response objects contain identity and processing state only;
they never inline artifact, chunk, minidump, or source-map bytes.

### Issue and event DTOs

Issue and event list routes return direct arrays of the fixed DTOs below. Detail
routes and issue status transitions return one DTO. Pagination remains in the
`Link` header and request ID headers; it is never wrapped in an additional JSON
object. Every field listed below is present unless it is explicitly nullable.
Unknown upstream fields are omitted, not emitted as `null`, and do not become
an extension surface.

| DTO | Field | Type and rule |
| --- | --- | --- |
| Issue | `id` | Required non-empty string compatibility alias; never a Watchtower canonical ID |
| Issue | `shortId` | Required string compatibility alias |
| Issue | `title` | Required string |
| Issue | `culprit` | Nullable string |
| Issue | `permalink` | Required string URL |
| Issue | `level` | Required enum: `sample`, `debug`, `info`, `warning`, `error`, `fatal`, or `unknown` |
| Issue | `status` | Required enum: `resolved`, `ignored`, `pending_deletion`, `pending_merge`, `reprocessing`, or `unresolved` |
| Issue | `statusDetails` | Required object whose only allowed keys are optional `ignoreCount`, `ignoreUntil`, `ignoreUserCount`, `ignoreUserWindow`, `ignoreWindow`, `actor`, `inNextRelease`, `inRelease`, `inCommit`, `pendingEvents`, and `info`; counts are non-negative integers, dates are RFC 3339 UTC strings, release flags/values use their pinned scalar types, and non-applicable keys are omitted |
| Issue | `substatus` | Nullable enum: `archived_until_escalating`, `archived_until_condition_met`, `archived_forever`, `escalating`, `ongoing`, `regressed`, or `new` |
| Issue | `isPublic` | Required boolean |
| Issue | `platform` | Nullable string |
| Issue | `project` | Required object containing exactly `id`, `slug`, `name`, and nullable `platform` |
| Issue | `type` | Required enum: `error` or `default` |
| Issue | `metadata` | Required object containing exactly nullable string fields `type`, `value`, `filename`, and `function` |
| Issue | `numComments` | Required non-negative integer |
| Issue | `assignedTo` | Nullable object containing required `type`, `id`, and `name` strings plus optional `email` |
| Issue | `firstSeen` | Required RFC 3339 UTC string |
| Issue | `lastSeen` | Required RFC 3339 UTC string |
| Issue | `count` | Required non-negative decimal string, preserving the pinned Sentry representation |
| Issue | `userCount` | Required non-negative integer |
| Event | `id` | Required lowercase 32-character external event ID |
| Event | `eventID` | Required lowercase 32-character external event ID equal to `id` |
| Event | `groupID` | Nullable issue compatibility alias |
| Event | `message` | Nullable string |
| Event | `title` | Required string |
| Event | `culprit` | Nullable string |
| Event | `dateCreated` | Required RFC 3339 UTC string |
| Event | `dateReceived` | Required RFC 3339 UTC string |
| Event | `platform` | Nullable string |
| Event | `tags` | Required array of objects containing required string fields `key` and `value`, plus optional string `query` |
| Event | `contexts` | Required bounded JSON object; values are JSON scalars, arrays, or objects subject to the event limits above |
| Event | `user` | Nullable object containing only the safe readable string fields `id`, `username`, and `name` |
| Event | `sdk` | Nullable object containing exactly nullable string fields `name` and `version` |
| Event | `release` | Nullable string |
| Event | `dist` | Nullable string |
| Event | `entries` | Required array of objects containing exactly string `type` and bounded JSON `data` |
| Event | `metadata` | Required object containing exactly nullable string fields `type`, `value`, `filename`, and `function` |

The issue `project` object uses the same field types as the project DTO but
contains no organization or lifecycle metadata. `PUT` status transitions return
the updated Issue DTO; a requested status outside the listed enum is
`400 invalid_request`. Event reads never expose raw storage references,
unbounded request data, credentials, or private user fields omitted above.

### Operation status DTO and state machine

Every operation response body has exactly these fields:

```json
{
  "operation_id": "canonical-lowercase-uuid-v7",
  "status": "pending",
  "status_url": "/api/0/operations/<operation_id>/",
  "created_at": "RFC-3339-UTC",
  "completed_at": null,
  "result": null,
  "error": null
}
```

`status` is one of `pending`, `succeeded`, `failed`, or `expired`.
`completed_at` is null only for `pending`; `result` is non-null only for
`succeeded`; and `error` is non-null only for `failed` or `expired`. A result
contains only the bounded resource or artifact DTO for the originating
operation. An error contains only a stable code, safe message, and bounded
field errors; it never contains owner diagnostics, secrets, or payload data.

The status URL returns `202` for `pending` with `Retry-After`, `200` for
`succeeded` and `failed`, and `410 operation_expired` for `expired` while the
minimal operation tombstone is retained. Unknown or inaccessible operation IDs
return indistinguishable `404 not_found`; an unavailable owner returns
`503 unavailable` without reporting a terminal state. A `202` creation response
uses the same `pending` body and never claims lifecycle or artifact completion.

Responses never expose internal component names, database identifiers, raw
storage references, secrets, or unrestricted payloads. A `202` response includes
the operation status DTO with `status=pending` and a status URL when the pinned
client requires polling; it never claims processing completion.

### Error mapping

The adapter preserves the pinned client's expected HTTP family and JSON shape
while using these stable Watchtower-safe codes. Field errors identify field
names and safe validation reasons only.

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `invalid_authentication` | 401 | Missing, malformed, expired, or revoked credential |
| `permission_denied` | 403 | Current principal or credential lacks the action or resource scope |
| `not_found` | 404 | Unknown or inaccessible tenant, project, issue, event, release, or artifact |
| `method_not_allowed` | 405 | Known route with an unsupported method |
| `invalid_request` | 400 | Invalid JSON, field, alias, cursor, checksum, or operation input |
| `operation_expired` | 410 | A retained operation tombstone no longer has a retrievable result |
| `unsupported_media_type` | 415 | Content type or content encoding is not accepted for the addressed route |
| `invalid_compression` | 400 | The declared gzip content encoding is malformed or cannot be decompressed |
| `invalid_multipart` | 400 | Multipart framing or boundary syntax is malformed |
| `invalid_envelope` | 400 | Invalid framing, length, header, or supported item after transport decoding |
| `internal_error` | 500 | Internal, unknown, or data-loss failure; fixed safe message and request ID, with no original cause |
| `unsupported_capability` | 501 | Explicitly unsupported route, format, item, workflow, or capability |
| `conflict` | 409 | Stale version, conflicting alias/digest, reused idempotency key, or lifecycle state |
| `payload_too_large` | 413 | A protocol or owner limit was exceeded |
| `rate_limited` | 429 | A principal, organization, project, collection, or artifact quota was exhausted |
| `unavailable` | 503 | Authorization, quota, owner, lifecycle, or processing dependency cannot be evaluated safely |
| `deadline_exceeded` | 504 | A bounded synchronous operation exceeded its deadline without being reported complete |

Runtime boundary codes `unknown`, `internal`, and `data_loss` map to the
deterministic `500 internal_error` response. Its pinned-client error shape
contains only the stable code, the fixed message `Internal server error`, the
request ID, and applicable retry metadata; the original cause and unrestricted
diagnostics remain outside the response.

An accepted request is never converted into a synchronous `500` merely because
processing is delayed. The response identifies durable acceptance or pending
operation state; the owner-specific failure is recovered asynchronously.

### Content types and compression

| Request | Accepted content type | Accepted content encoding |
| --- | --- | --- |
| Envelope | `application/x-sentry-envelope`; `text/plain;charset=UTF-8` for browser SDK string Envelopes; `application/octet-stream` or an absent `Content-Type` only for a pinned binary Envelope transport | identity and gzip |
| Legacy store | `application/json` | identity and gzip |
| Minidump | `multipart/form-data` with a boundary, or `application/octet-stream` for a pinned raw-minidump path | identity and gzip |
| Release/file/chunk upload | `multipart/form-data` or the exact sentry-cli JSON/multipart form for that operation | identity and gzip |
| Management API with a JSON entity body | `application/json` | identity and gzip |
| Bodyless management API | an absent `Content-Type` or `application/json` | identity and gzip |

Transport-level content failures have deterministic results and never persist a
payload:

| Condition | Result |
| --- | --- |
| Unsupported `Content-Encoding` | `415 unsupported_media_type` |
| Invalid gzip stream | `400 invalid_compression` |
| Invalid multipart boundary | `400 invalid_multipart` |
| Mismatched or unsupported `Content-Type` | `415 unsupported_media_type` |

After successful decompression, Envelope framing, Envelope headers, and
Envelope item JSON use `400 invalid_envelope`. Malformed JSON in a project,
release, deployment, or artifact assembly management request uses
`400 invalid_request`. A management request with an entity body must use
`application/json`; a bodyless management read, probe, or poll may omit
`Content-Type`. Response bodies are JSON for management routes;
Envelope, legacy `store`, and `minidump` ingestion `POST`s return `200` with a
zero-length body and request-ID headers, while `OPTIONS` returns `204` without
a body. Other ingestion failures use the stable JSON error shape.

For a non-Envelope crash path whose fixture specifies minidump upload, the
pinned native uploader sends a bounded `upload_file_minidump` binary multipart
part, the bounded scalar Crashpad annotation fields emitted by that pinned
fixture (`prod`, `ver`, `ptype`, `plat`, and `guid` where present), and may
send a `sentry` JSON metadata part containing the scoped event ID, release,
distribution, and platform context. The annotation allowlist is fixture-
specific and does not accept arbitrary scalar keys; annotations are metadata,
not event or attachment parts. A raw-minidump request uses the same crash
payload with the project DSN authentication. Unlisted multipart file parts are
rejected before acceptance. The legacy `store` body is JSON and must contain
the pinned error-event fields needed to construct one event; it cannot carry
an arbitrary batch.

Every permitted minidump has a deterministic `minidump_digest`: lowercase
hexadecimal SHA-256 over the UTF-8 bytes of the RFC 8785 canonical-JSON
encoding of this exact object:

```text
{
  "schema": "watchtower.sentry.minidump.v1",
  "minidump_sha256": lowercase_hex_sha256(decompressed_upload_file_minidump_bytes),
  "annotations": sorted_allowed_crashpad_scalar_annotation_map,
  "sentry": {
    "event_id": normalized_lowercase_event_id,
    "release": string,
    "dist": string,
    "platform": string
  }
}
```

The `sentry` member is omitted when that multipart part is absent, and absent
optional fields inside it are omitted; it contains no request ID, DSN, or
transport metadata. Annotation keys and object keys use RFC 8785 ordering, and
the minidump hash is over decompressed bytes rather than multipart framing or
compressed bytes. When `sentry.event_id` is present, the retry identity is
`(tenant_id, project_id, external_event_id, minidump_digest)`; otherwise it is
`(tenant_id, project_id, minidump_digest)`. A matching identity returns the
original `200` empty-body acceptance, while a matching external event ID or
digest with different bytes, annotations, or metadata returns `409 conflict`.
The Ingest acceptance record retains the digest and identity for the same
acceptance-retention horizon as the raw handoff.

### Explicit limits

The limits below are Watchtower admission limits for this contract. They are
checked before durable acceptance and are independent of organization quotas.
They are deliberately bounded below infrastructure limits so an accepted
request can be recovered safely.

| Resource | Limit |
| --- | ---: |
| Decompressed Envelope or legacy event request | 50,000,000 bytes |
| Envelope item count | 1,024 items |
| One Envelope item payload | 20,000,000 bytes |
| One JSON error event | 1,000,000 bytes |
| One attachment or native crash item | 20,000,000 bytes |
| One source-map or debug-file artifact | 50,000,000 bytes |
| One chunk | 20,000,000 bytes |
| Decompressed multipart/request | 100,000,000 bytes |
| Decompressed management JSON request | 10,000,000 bytes |
| One assembled release artifact | 1,000,000,000 bytes |
| Multipart part count | 1,024 |
| DIF assembly map entries | 256 digests |
| DIF chunks per assembled file | 256 checksums |
| DIF assembly project scope | 1 project, selected by the route |
| Artifact-bundle assembly chunks | 1,024 checksums |
| Artifact-bundle assembly project IDs | 100 project IDs |
| Browser origins per project | 100 origins |
| Serialized browser origin | 2,048 ASCII bytes |
| Management response page | 100 records |
| Management request filter values | 256 bytes each |

The smaller applicable limit wins. A request over a limit returns `413` with a
safe code and request ID; it is not partially accepted. Existing organization,
project, collection, artifact, and API quotas remain authoritative in addition
to these protocol limits. Rate-limit exhaustion returns `429` and
`Retry-After`; inability to evaluate the relevant quota returns `503`.

For every multipart request, the decompressed byte total across all parts and
multipart framing must remain at or below `100,000,000` bytes. The adapter
enforces this aggregate limit while streaming, before persisting any part, and
counts duplicate, conflicting, unknown, and otherwise rejected parts toward
the total. The part-count and per-part limits do not permit a request to exceed
the aggregate limit.

For every management request with a JSON entity body, including mutation and
assembly routes, the adapter counts decompressed bytes while streaming identity
or gzip content and stops at `10,000,000` bytes before JSON parsing, field
validation, lookup, or persistence. Exceeding that limit returns
`413 payload_too_large` without a side effect; bodyless management requests are not
subject to this limit.

Assembly cardinality is checked before checksum or project lookup. Every
submitted digest, checksum reference, and project ID counts toward its
applicable limit, including repeated, missing, or zero-byte chunk references.
An over-limit DIF or artifact-bundle assembly returns `413 payload_too_large`
without persisting or looking up any entry.

### Envelope framing and item behavior

An Envelope is newline-delimited JSON headers followed by items. The envelope
header is required, and each item uses either length-delimited or
newline-delimited framing. When `length` is present it is authoritative,
payload bytes must match the declared length, and trailing bytes other than the
permitted final newline are invalid. When `length` is omitted, the item payload
uses the permitted newline-delimited framing. When a supported error event item
is present, the envelope's `event_id`, when present, must match that item. If no
supported error event item is present, a present envelope `event_id` is still
syntax- and DSN-validated but is not required to match an excluded item and is
retained only as bounded request/no-op metadata. Empty Envelopes are
structurally valid but have no accepted item.

Every external SDK event ID uses the grammar `[0-9a-fA-F]{32}`: exactly 32
ASCII hexadecimal characters, with no hyphens, braces, `0x` prefix, whitespace,
or other UUID punctuation. The adapter accepts either casing and normalizes the
value to lowercase before matching, storing, exposing, or using it for
deduplication. A supported event item requires an event ID. If both the
envelope and event item provide one, their normalized values must match;
otherwise the request is rejected with `400 invalid_envelope`. A malformed
provided ID is also `400 invalid_envelope` for ingestion and `400
invalid_request` for management routes.

The adapter counts every item header, including unknown and individually
excluded items, against the Envelope item-count limit. An Envelope with more
than 1,024 items is rejected with `413` before any item payload is allocated or
processed.

The adapter recognizes these bounded request fields. For the envelope header,
`event_id`, `dsn`, `sent_at`, `sdk`, and `trace` are optional upstream fields;
the DSN and event ID are checked against the authenticated project and the
event ID is retained only as a scoped external identifier. Every item header
requires `type`; `length` is optional and selects length-delimited framing when
present. `content_type`, `filename`, `attachment_type`,
`content_encoding`, `item_count`, and `item_headers` are accepted only for the
item types that define them. An `event` payload may contain the pinned
client's `event_id`, `timestamp`, `platform`, `level`, `message`, `exception`,
`stacktrace`, `release`, `dist`, `environment`, `tags`, `contexts`,
`breadcrumbs`, `sdk`, `user`, `debug_meta`, and bounded event metadata. The
event item's `event_id` is required for a supported event.
`attachment` requires bounded bytes and may carry `filename`, `content_type`,
and `attachment_type`; it is retained only with its accepted event.
`client_report` accepts only bounded discarded-event reason, category, and
quantity records. Required fields and cross-field checks are enforced, while
unknown non-structural fields follow the unknown-field rule below.

| Item type | v1 behavior |
| --- | --- |
| `event` | Supported when it is an error event. One event item is allowed. |
| `attachment` | Supported when associated with a supported error or native crash. It is retained only with the accepted event. |
| `client_report` | Structurally accepted and recorded as bounded client diagnostic metadata; it is not an error event. |
| `profile`, `profile_chunk` | Individually excluded. |
| `transaction`, `span` | Individually excluded; tracing semantics belong to #25. |
| `session` | Individually excluded; sessions and release health are out of scope. |
| `replay_event`, `replay_recording` | Individually excluded. |
| `feedback` | Individually excluded. |
| `log` | Individually excluded; log semantics belong to #24. |
| `metric_buckets` | Individually excluded; metric semantics belong to #23. |
| `check_in` | Individually excluded. |
| `user_report`, `security`, `trace`, `unreal_report`, `form_data`, and `nel` | Individually excluded. Native crash support uses the explicitly listed crash route or a supported `event`/`attachment` combination. |
| Unknown item types and future upstream types | Individually excluded with bounded type/reason/count diagnostics. |

Malformed framing, invalid JSON headers, invalid lengths, invalid compression,
or an invalid supported item rejects the entire request. A structurally valid
Envelope retains supported error/attachment items and individually excludes
unsupported non-error items. An unsupported-only Envelope is durably accepted
only as a bounded no-op when its framing is valid; it records bounded
acceptance and handoff metadata, persists no payload bytes, and returns `200`
with an empty response body. An empty Envelope follows the same no-op behavior.
Exclusion diagnostics contain only item type, reason, count, project,
request ID, and correlation ID.

Unknown object members in Envelope headers, item headers, event payloads,
client reports, minidump metadata, management requests, and bounded DTO data
are ignored at the adapter boundary and are never persisted, returned, or used
for authorization. Unknown fields never authorize a new field, route, scope,
or capability. Rejection is deterministic and limited to malformed JSON or
framing, duplicate object member names, a non-object where an object is
required, a wrong type or range for a known required/structural field, invalid
length or encoding, a supported-item validation failure, or an identity and
cross-field mismatch. Thus adding an otherwise harmless unknown member cannot
change a successful response into `400`; only the enumerated structural and
semantic failures can reject the request.

### Acknowledgement, errors, retries, and idempotency

- Every structurally valid Envelope `POST`, whether it retains supported items
  or is an empty/unsupported-only no-op, returns HTTP `200` with a zero-length
  response body. Request IDs remain response headers, and no `202` or `204`
  success is used for Envelope admission.
- Successful legacy `store` and `minidump` `POST`s use the same `200`-
  empty-body acknowledgement and request-ID headers, including an idempotent
  retry of an already accepted submission.
- A successful ingestion response for one or more accepted items means raw
  bytes, acceptance metadata, and a recoverable processing handoff/outbox are
  durable. It does not mean canonical storage, issue grouping, symbolication,
  or Query visibility.
- A successful no-op acknowledgement for an empty or unsupported-only Envelope
  means only that bounded acceptance metadata and the no-op handoff are durable;
  it does not imply that raw payload bytes were retained or accepted.
- Management `202` means an operation is durably accepted and pending. A
  response is not rendered as completed until the owning lifecycle or artifact
  authority reports terminal success.
- Successful responses include a safe request ID and, where the upstream
  client expects it, the preserved external event ID. `X-Request-ID` is echoed
  or generated as a canonical lowercase UUID v7 and `X-Watchtower-Request-ID`
  is provided for diagnostics.
- Safe errors use the upstream-compatible status and shape required by the
  pinned client while including a stable Watchtower code and request ID.
  Original causes are represented only by bounded, redacted structured
  diagnostics; raw and unrestricted customer payloads remain in owner-
  controlled storage and are never logged.
- Clients may retry `408`, `429`, `500`, `502`, `503`, and `504` according to
  `Retry-After` and bounded exponential backoff. The adapter does not retry a
  non-idempotent operation automatically after an unknown outcome.
- `payload_digest` is lowercase hexadecimal SHA-256 over the UTF-8 bytes of
  the RFC 8785 canonical-JSON encoding of this exact semantic object:

  ```text
  {
    "schema": "watchtower.sentry.payload.v1",
    "event": normalized_event_object_or_null,
    "attachments": sort_by_canonical_json([
      {
        "content_type": string_or_null,
        "filename": string_or_null,
        "attachment_type": string_or_null,
        "sha256": lowercase_hex_sha256(decompressed_attachment_bytes),
        "size": decompressed_attachment_byte_count
      }
    ]),
    "client_report": sort_by_canonical_json([
      {"reason": string, "category": string, "quantity": integer}
    ])
  }
  ```

  `normalized_event_object` contains the normalized lowercase event ID and the
  accepted event fields listed above; object keys use RFC 8785 ordering.
  Attachment descriptors and client-report records are sorted by their
  canonical-JSON byte representation, with duplicate members retained. The
  preimage excludes transport compression, Envelope framing and lengths,
  request IDs, DSN, `sent_at`, `sdk`, `trace`, and individually excluded items;
  attachment bytes contribute through their SHA-256 and size. Empty and
  unsupported-only Envelopes use `event: null`, an empty attachment array, and
  an empty client-report array.
- Envelope and event submissions are idempotent by the tuple
  `(tenant_id, project_id, external_event_id, payload_digest)` while the
  Ingest-owned acceptance record containing the payload digest and original
  acceptance remains retained. The same tuple returns the original
  acceptance; the same event ID with a different digest returns `409` and is
  not merged. After the acceptance record is retired following handoff or
  expiry, this compatibility contract makes no historical deduplication or
  conflicting-digest guarantee for a retry.
- Creation, deletion, rotation, release finalization, chunk assembly, and
  deployment writes use the control-plane idempotency tuple. Operations that
  require a client idempotency key reject a missing key before mutation;
  reusing a key with different content returns `409`, and a lost response
  resumes the original operation without returning a secret a second time.
- Duplicate or out-of-order asynchronous messages are handled by the owning
  component's idempotent command/reconciliation contract. The adapter never
  invents a second canonical event or bypasses a lifecycle fence.

### Pagination and rate-limit headers

List endpoints return bounded arrays with the upstream-compatible `Link`
header and opaque cursor parameters when the pinned client expects them. A
cursor binds to the original tenant, project, principal, filters, sort order,
and authorization revision. Each page rechecks current authorization,
revocation, lifecycle, retention, and security-projection freshness. A stale,
cross-tenant, malformed, or expired cursor is rejected without disclosing data:
malformed and expired cursors return `400` with `invalid_request`, while stale
cursors whose bound authorization or security revision is no longer valid
return `403` with `permission_denied`. A valid cursor replayed outside its
tenant or otherwise inaccessible scope returns the same indistinguishable
`404 not_found` used for an inaccessible resource.

Management responses include `Retry-After` for `429` and `503`, serialized as
the ceiling of the remaining duration in whole seconds. When a quota is safely
evaluated, the adapter emits these concrete headers (HTTP header-name casing
is insignificant):

- `X-Sentry-Rate-Limit-Limit` is the decimal capacity of the most restrictive
  applicable bucket.
- `X-Sentry-Rate-Limit-Remaining` is its non-negative decimal remaining count.
- `X-Sentry-Rate-Limit-Reset` is its reset time as whole Unix epoch seconds
  UTC.
- `X-Sentry-Rate-Limits` is omitted when no bucket is active; otherwise it is a
  comma-separated list with no whitespace. Each entry has the grammar
  `<seconds>:<category;category>:<scope>[:<reason>[:<namespace;namespace>]]`.
  `seconds` is a non-negative decimal duration, categories are lowercase
  `error`, `attachment`, `default`, `artifact`, or `all`, scope is lowercase
  `principal`, `organization`, `project`, or `key`, reason is a lowercase
  token using `[a-z0-9_-]`, and each namespace is a lowercase token using
  `[a-z0-9_-]`. Categories and namespaces are unique and lexicographically
  sorted; entries are sorted by scope, category text, and seconds. The reason
  and namespace components are omitted when they do not apply.

`X-Sentry-Rate-Limit-Limit`, `X-Sentry-Rate-Limit-Remaining`, and
`X-Sentry-Rate-Limit-Reset` are emitted on quota-evaluated responses even when
remaining is nonzero. A `429` includes `Retry-After` and the active-limit
entry; a `503` caused by unavailable quota evaluation includes `Retry-After`
but omits all rate-limit headers. No wildcard header name or empty
`X-Sentry-Rate-Limits` value is emitted. The values describe the applicable
Watchtower principal/organization/project quota, not a Sentry billing quota.
The native control-plane limits remain 600 requests per principal and 6,000
per organization per 60 seconds for ordinary organization management, with the
independent 30/300 security budget for revocation, recovery, and deletion.

### Capability negotiation

Capability negotiation is non-mutating. The adapter advertises
`X-Watchtower-Sentry-Compatibility: 1` and the supported protocol capability
set in the safe response metadata where a pinned client reads it. It does not
advertise excluded item types or routes. Clients that probe an unsupported
route receive the explicit `404`, `405`, or `501` result from the route matrix;
probing never creates a resource. The absence of an optional capability is
not permission to fall back to a native private route.

## Crash, artifact, and release workflows

### Ordinary errors and native crashes

Every guaranteed SDK must complete an ordinary exception/error scenario using
its default transport and DSN without a custom transport. The scenario
captures a minimal error event, an event ID, tags/context, and one bounded
attachment where that SDK supports attachments.

Native scenarios cover the pinned Cocoa, Android, Native, React Native, Unity,
Unreal, Godot, and the .NET 6.11.0 NativeAOT `Sentry.Native` integration. Each
uses the exact transport named in its fixture row: the Cocoa native-crash
fixture exercises the pinned Envelope output, the .NET native-crash fixture
exercises its pinned Envelope output, and the Godot 2.1.1 fixture exercises
`POST /api/<project_id>/minidump/` with `upload_file_minidump`, the bounded
Crashpad annotations, and optional `sentry` metadata. The Godot release commit
is `d288ad983c30bf7a7d924fbceb8ed7cf6e64de9c`, whose `sentry-native`
submodule resolves to `a185ce80ba2416b0a0bb04b4ee8f11f1117ae08f`; the other
clients use the exact supported minidump multipart upload or other non-Envelope
crash request named by their fixture row.
Watchtower stores no raw crash payload outside the Ingest-owned accepted record
and handoff; Processor owns normalization and symbolication execution, and
Query visibility is asynchronous.

### Source maps and debug files

The CLI and every listed build plugin use the configured Watchtower URL and
Watchtower management credential. SDK DSNs are not used for artifact writes.
The contract supports JavaScript source maps, native dSYMs and Breakpad/Crashpad
debug files, Android ProGuard/R8 mappings, and the artifact metadata required by
the pinned clients. Every artifact-bundle assembly requires a non-empty release
`version`; a missing version returns `400 invalid_request` before an assembled
artifact is admitted. Release-associated artifacts are content-addressed and
idempotent within the identity `(project, release, dist, artifact type, logical
filename)`; an absent `dist` is a distinct identity value from any supplied
distribution. There is no versionless artifact identity. Identical content
within the same release-artifact identity is a successful duplicate, while
conflicting content within that identity is `409`. Different distributions may
therefore reuse a logical filename within one release.

Standalone DIF uploads are independent of release and distribution. Their
primary idempotency identity is `(project, full-file checksum)`; when a
`debug_id` is supplied, `(project, debug_id)` is also unique. A matching
checksum/debug identity with the same name and ordered chunks is a successful
duplicate. Conflicting bytes, debug identity, name, or chunk ordering returns
`409`.

DIF assembly does not require a client idempotency key. When absent, the
adapter derives the operation identity from `(tenant_id, project_id,
full_file_checksum, canonical_request_body_digest)` where the digest excludes
the optional key; a matching retry resumes the same operation. When supplied,
the client key is bound to that canonical
body digest and a reuse with different content returns `409`; key-conflict
behavior is not applied when no key was supplied.

Artifact upload, symbolication, and event enrichment are asynchronous. A
successful upload means the artifact authority durably accepted the artifact
or an idempotent equivalent; it does not mean a prior event has been
symbolicated. Polling returns pending until terminal success or a safe terminal
failure. Artifact references remain subject to project retention and deletion.

### Chunk upload, assembly, and polling

The organization-scoped sentry-cli capability at
`GET /api/0/organizations/<organization>/chunk-upload/` returns JSON with
`url`, `chunksPerRequest`, `maxRequestSize`, `maxFileSize`, `maxWait`,
`hashAlgorithm`, `chunkSize`, `concurrency`, and `compression` for
artifact-bundle uploads. The project-scoped DIF capability returns the same
bounded capability shape with a project-bound `url`. A chunk request is
multipart: each `file` or `file_gzip` part is named by its lowercase SHA-1
checksum. A DIF assembly request is a JSON map from the full-file SHA-1
checksum to `{name, debug_id?, chunks}`; its response is the same checksum map
with `{state, missingChunks, detail?, dif?}` and does not require release or
distribution fields. An artifact-bundle assembly request contains `{checksum,
chunks, projects, version, dist?}` and requires release identity. For an
artifact bundle, `chunks` is a non-empty ordered list of lowercase
40-character SHA-1 chunk names, and `checksum` is the lowercase 40-character
SHA-1 of the byte-for-byte concatenation of those chunks after each
`file_gzip` part has been decompressed, in exactly the listed order. No
separator, JSON wrapper, multipart framing, compressed bytes, or chunk-name
text is included in the preimage. The adapter verifies this checksum before
assembly or persistence; a mismatch returns `400 invalid_request` and does not
create an artifact or operation. The same checksum with the same ordered
content is an idempotent duplicate, while a conflicting ordered content is
`409 conflict`.
Artifact-bundle chunks negotiated by the organization capability are
organization-scoped transient records keyed by organization and lowercase
chunk checksum; their upload request intentionally carries no project field.
The `projects` list is authoritative at assembly, where Watchtower verifies
every target project and the caller's authorization. Same-organization reuse
is allowed after those checks, while cross-organization reuse is rejected.
DIF chunks remain scoped by their project route. Watchtower bounds every field
and enforces required checksum, order, project, and applicable artifact
identity. These are adapter DTOs only.
The capability response advertises `maxRequestSize: 100000000`, which is the
decompressed multipart/request limit above. The adapter rejects a chunk request
when the aggregate decompressed request exceeds that value, even when every
individual part and the total part count are within their separate limits.

The pinned sentry-cli chunk workflow is:

1. Probe the project-scoped DIF capability or organization-scoped
   artifact-bundle capability with a read-only request.
2. Upload each content-addressed chunk with its checksum; artifact-bundle
   uploads are organization-scoped and carry no project field, while DIF
   uploads use their project route.
3. Retry a chunk safely by checksum; a matching existing chunk is success.
4. Submit the bounded DIF assembly request containing the ordered checksum
   list, logical filename, optional debug ID, and optional idempotency key;
   artifact-bundle assembly additionally carries its project list, version, and
   optional distribution.
5. Poll the returned operation/status identity with bounded backoff.
6. Expose terminal artifact registration only after API and artifact authority
   have completed their durable lifecycle checks.

An interrupted upload leaves recoverable chunk state until its retention fence;
it does not create a release file. Missing chunks, checksum mismatch, ordering
conflicts, expired upload state, quota exhaustion, unauthorized project lists,
and cross-organization reuse are explicit errors. Same-organization reuse of an
organization-scoped artifact-bundle chunk is allowed when assembly
authorization passes. Assembly returns `202` while pending and `409` for
conflicting content or an already terminal operation with incompatible input. A
dependency outage returns `503` and does not report completed success.

### Releases and deployments

Release creation, read, update, finalization, file registration, and deployment
record creation are guaranteed only through the pinned CLI/plugin matrix. A
release version remains the external release identifier scoped to one tenant;
it is not a canonical UUID. The adapter maps it to the native release command
and preserves the upstream version string as a bounded external field.

Release-file cleanup uses only
`DELETE /api/0/projects/<organization>/<project>/releases/<version>/files/<file_id>/`.
`file_id` is the opaque release-file alias returned by file listing or upload
and is resolved only within the authenticated tenant, project, and release
version; the collection route never accepts deletion by filename or an
implicit selector. The caller needs current `Manage` authority and must supply
an idempotency key bound to the exact file target and observed version. A
missing key returns `400 invalid_request` before artifact authority is called.
successful delete returns `204` with an empty body only after durable artifact
authority deletion. Repeating the same target, including with the same key,
returns the same `204` no-op; an unknown or inaccessible target returns
`404 not_found`, a stale observed version or key reused for another target
returns `409 conflict`, and an unavailable artifact owner returns `503`.

Release finalization is idempotent. Deployment records reference a release and
carry environment, name, timestamp, and bounded metadata required by the
pinned CLI. They record history only; they do not grant deployment authority,
execute deployment work, or activate unsupported release-health behavior.

## Identity, aliases, and storage ownership

- Organization, project, operation, artifact, release-operation, and internal
  resource identities are canonical lowercase UUID v7 values at Watchtower
  boundaries and PostgreSQL `uuid` when persisted by their owner.
- Sentry project IDs, DSN key IDs, release versions, issue IDs, and event IDs
  are compatibility aliases or scoped external identifiers. Organization and
  project slugs are scoped compatibility aliases. All are resolved only after
  authentication and tenant scope are known; slugs may be reused only after
  deletion completes for a new resource generation, while canonical IDs and
  other scoped external identifiers are never reused across generations.
- SDK event IDs are retained as `(tenant_id, project_id, external_event_id)`
  identifiers. Two projects may use the same event ID without collision or
  disclosure. An SDK event ID is never a canonical Watchtower primary key.
- API owns control-plane, project, DSN, release, artifact, operation, and audit
  authority. Ingest owns raw accepted records and recoverable handoff. Processor
  owns processing, canonical telemetry, symbolication, and derived issue data.
  Query owns projections and reads. Jobs owns scheduling and retry state.
- API-mediated internal calls use authenticated unary Protobuf-over-HTTP under
  `/internal/v1` and versioned messages. No public client consumes an internal
  queue or calls an internal RPC directly.

## Watchtower deviations from Sentry

The following differences are intentional and are part of v1 compatibility:

1. Watchtower credentials, roles, project grants, revocation, quotas, SSO/MFA,
   recent reauthentication, audit, and lifecycle fences override any Sentry
   token or permission interpretation.
2. Watchtower canonical UUID v7 identities and tenant predicates override
   Sentry's integer/string resource IDs. Canonical IDs and non-slug
   compatibility aliases are scoped and non-reusable; organization and project
   slugs may be reused only after deletion completes.
3. Durable acceptance is earlier than processing completion and query
   visibility. Clients must not interpret a successful `POST` as symbolication,
   grouping, issue creation, or read availability.
4. Structurally valid mixed Envelopes can retain supported error items while
   excluding unsupported non-error items. Malformed framing, compression,
   lengths, or supported item validation rejects the whole request.
5. Unknown fields are not an extension-storage escape hatch. The adapter
   ignores harmless unknown fields but never persists or authorizes them.
6. Watchtower applies explicit protocol limits and existing management quotas;
   Sentry's billing, organization, event-retention, and rate-limit semantics do
   not replace Watchtower's limits.
7. Query and management reads fail closed when an owner or security projection
   is unavailable or stale. There is no direct-storage or stale-cache fallback.
8. Project deletion, retention shortening, revocation, and resource creation
   remain pending until their generation-matched owner acknowledgements and
   Jobs lifecycle fences complete.
9. Sentry UI behavior, historical Sentry data, sessions, release health,
   tracing, logs, metrics, profiling, replay, feedback, monitors, alerting,
   broad administration, and excluded console SDKs are not v1 guarantees.

## Diagnostics and troubleshooting

Every public request receives or echoes a canonical lowercase UUID v7 request
ID. Internal calls and asynchronous messages preserve causation, correlation,
idempotency, and W3C trace context. Safe structured diagnostics include route,
method, tenant/project scope, client family/version, protocol outcome,
accepted/excluded item counts, exclusion reason, status, latency, and owner
handoff state. They never include DSNs, tokens, private keys, full event
payloads, attachment bytes, or unrestricted user data.

Customer-facing troubleshooting is English Markdown and must explain:

- configure the SDK DSN for collection and the Watchtower URL plus management
  credential separately for CLI/plugins;
- distinguish `401`, `403`, `404`, `409`, `413`, `429`, `500`, and `503`;
- use the returned request ID when reporting a failure;
- wait for asynchronous symbolication, grouping, and Query projection after a
  durable acceptance;
- honor `Retry-After` and avoid retrying a non-idempotent request with changed
  content;
- verify release/version, artifact checksum, project scope, and credential
  permissions for source maps/debug files; and
- recognize excluded Envelope items, unsupported routes, console SDKs, and
  non-error Sentry products.

## Conformance fixtures and release gate

Fixtures are deterministic, sanitized, and stored with:

- upstream repository/package, exact version/tag, resolved commit where
  available, and source URL;
- client family, framework/plugin, runtime/build command, required route,
  headers, content type, compression, and authentication class;
- canonical request bytes with secrets and customer payloads replaced by
  fixed placeholders;
- expected status, response headers/body, request ID shape, acceptance state,
  exclusion diagnostics, and eventual owner outcome; and
- an explicit expected result for every supported and unsupported route,
  method, item type, content format, capability probe, and failure case.

The release-blocking execution matrix must run at least one ordinary-error
scenario for every SDK/framework row, native-crash scenarios for every
applicable native row, source-map/debug-file scenarios for every build plugin,
and complete CLI release/chunk/assembly/deployment workflows. It must also
exercise:

- malformed Envelope framing, length, JSON, content type, compression, and
  oversized requests;
- bodyless management reads, capability probes, release reads, and polling
  without `Content-Type`, plus body-bearing management requests with accepted
  and mismatched content types, including identity/gzip JSON bodies at and over
  the `10,000,000`-byte decompressed limit;
- minidump uploads with the exact fixture-emitted Crashpad scalar annotations,
  optional Sentry metadata, rejected unlisted file parts, bounded fields, and
  the successful `200` zero-length acknowledgement;
- legacy `store` uploads with the required JSON event fields and the successful
  `200` zero-length acknowledgement;
- empty, unsupported-only, supported-only, and mixed Envelopes, including an
  envelope-level event ID on an excluded-only Envelope, all expecting `200`
  with a zero-length response body;
- duplicate, case-variant, malformed, and conflicting event IDs; equivalent
  payloads with different compression, JSON ordering, or excluded metadata;
  duplicate chunks, interrupted assembly, optional and conflicting DIF
  idempotency keys, retries, polling, and lost responses;
- required release-version rejection and release-artifact identity across
  release, distribution, artifact type, and logical filename, plus
  release-independent DIF duplicates and checksum/debug identity conflicts;
- allowlisted and disallowed browser origins, Envelope CORS preflight and
  actual responses, exact origin reflection, exposed request IDs, and no
  persistence for a disallowed origin, plus project setting update,
  version-conflict, lifecycle propagation, and read-back cases;
- pagination, cursor binding, malformed and expired cursor `400` results, stale
  cursor `403` results, cross-tenant cursor `404` results, rate-limit headers,
  unknown fields, and every safe error class;
- exact organization/project DTO bodies, including nullable platform,
  canonical aliases, origin arrays, omitted unknown fields, and list/detail
  consistency;
- exact issue/event DTO bodies, nullable fields, omitted unknown fields,
  list/detail/status-transition consistency, and bounded nested values;
- release-file deletion without an idempotency key, by exact `file_id`, repeated
  deletion, wrong-scope `404`, stale-version and idempotency-key conflicts, and
  owner outage;
- project-scoped DIF and organization-scoped artifact-bundle capability probes;
- chunk requests at and over the advertised `maxRequestSize`, including
  duplicate and rejected parts, with `413` and no partial persistence for an
  over-limit request, plus DIF/artifact-bundle assembly cardinality at and
  over each explicit digest, chunk, and project limit before lookup;
- valid, expired, revoked, insufficient-scope, cross-tenant, stale-projection,
  suspended, disabled, deleting, and deleted resources;
- organization/project reads, creation, update, deletion, DSN issuance,
  rotation/revocation, issue/event reads, resolve/reopen/ignore, release and
  deployment workflows; and
- operation polling with `202 pending`, `200 succeeded`, `200 failed`,
  `410 expired`, unknown-operation `404`, and owner-outage `503` responses;
- malformed management JSON versus malformed Envelope JSON, with
  `invalid_request` and `invalid_envelope` respectively;
- owner outages, quota exhaustion, processing lag, symbolication lag, no
  excluded-payload persistence, and durable acceptance versus visibility.

Each Watchtower release revalidates the official platform catalog and package
registries at the release cutoff, records any changed stable pin and release
evidence, and reruns all previously guaranteed fixtures. Removing a guarantee,
changing a route/item result, changing a limit, or changing a deviation
requires an explicit compatibility-contract change and a new release-blocking
matrix result. A client regression cannot be hidden by changing the fixture.

## Non-goals

- Implementing Sentry adapters, public servers, native commands, Query
  handlers, storage, jobs, runtime configuration, deployments, or feature flags.
- Forking, patching, or requiring custom transports in official SDKs.
- Migrating historical Sentry events, settings, users, credentials, or aliases.
- Guaranteeing unsupported console SDKs, community clients, historical client
  versions, or excluded Sentry products.
- Redefining the native semantics owned by #17–#21 or granting compatibility
  routes broader authority than their native Watchtower commands and queries.

## Acceptance checklist

- Every in-scope official client and plugin has an exact stable pin, authoritative
  source, required route, and executable fixture.
- Every supported and unsupported route, method, format, Envelope item, and
  relevant non-Envelope path has explicit behavior.
- Authentication, content type, compression, limits, fields, errors,
  pagination, rate headers, unknown fields, retries, idempotency, capability
  negotiation, chunking, polling, and asynchronous semantics are explicit.
- All deviations, exclusions, aliases, identity rules, tenant fences, and
  storage ownership boundaries are explicit.
- The contract contains no placeholder product decisions and remains aligned
  with the project, component, control-plane, canonical-storage, and runtime
  contracts.
