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
| Android (`Android runtime`, `Kotlin/Java Android`, `Compose`) | `POST /api/<project_id>/envelope/`; the pinned Android `8.56.0` native-crash path also uses this Envelope route with a native event item | `sdk.android.{runtime,kotlin-java,compose}.ordinary`; `sdk.android.native-crash` sends the pinned native event Envelope, any emitted attachment items, durable acknowledgement, and later processing state; no minidump-route alternative is selected |
| Apple (`iOS`, `macOS`, `tvOS`, `watchOS`, `visionOS`, Swift, Objective-C) | Envelope; pinned Cocoa native-crash integration uses the Envelope transport | `sdk.apple.{ios,macos,tvos,watchos,visionos,swift,objc}.ordinary`; `sdk.apple.native-crash` records the exact pinned Cocoa Envelope output |
| Dart/Flutter (`Dart VM`, mobile, desktop, web) | Envelope | `sdk.dart.{vm,flutter-mobile,flutter-desktop,flutter-web}.ordinary` |
| Elixir (`Elixir`, Plug/Phoenix) | Envelope | `sdk.elixir.{runtime,plug-phoenix}.ordinary` |
| Go (`net/http`, Echo, fasthttp, Fiber, Fiber v3, Gin, gRPC, Iris, Negroni) | Envelope | `sdk.go.{net-http,echo,fasthttp,fiber,fiber-v3,gin,grpc,iris,negroni}.ordinary` |
| Godot Engine | Envelope for ordinary errors; pinned Godot 2.1.1 native crashes use `POST /api/<project_id>/minidump/` with Crashpad multipart fields | `sdk.godot.ordinary`; `sdk.godot.native-crash` sends `upload_file_minidump`, the emitted `prod`, `ver`, `ptype`, `plat`, and `guid` scalar annotations where present, and the required `sentry` metadata part with an external event ID |
| Java (`Servlet`, Spring, Spring Boot, JUL, Log4j2, Logback) | Envelope | `sdk.java.{servlet,spring,spring-boot,jul,log4j2,logback}.ordinary`; `sdk.java.native-crash` is not applicable to pinned non-Android Java `8.56.0` (Android Java native coverage is in `sdk.android.native-crash`) |
| JavaScript (each literal `@sentry/*` package in the base row above) | Envelope | `sdk.javascript.<normalized-package>.ordinary` for every base-row package; the fixture sends an exception through that integration's default transport |
| Separately distributed JavaScript (`@sentry/capacitor`, `@sentry/electron`) | Envelope | `sdk.javascript.capacitor.ordinary` and `sdk.javascript.electron.ordinary`; each fixture installs its exact pinned package and sends an exception through its default transport |
| JavaScript WebAssembly | Envelope | `sdk.javascript.webassembly.ordinary` runs a deterministic WebAssembly module through the pinned JavaScript SDK family and asserts the default transport's ordinary error admission |
| Kotlin Multiplatform | Envelope | `sdk.kotlin-multiplatform.ordinary` |
| Native (C/C++, Crashpad, Breakpad, minidump, Qt, native WebAssembly) | Envelope for ordinary fixtures; `POST /api/<project_id>/minidump/` multipart for `sdk.native.crash`; the separate `sdk.native.tus-minidump` fixture exercises the TUS attachment route | `sdk.native.{c-cpp,crashpad,breakpad,minidump,qt,wasm}.ordinary`; `sdk.native.crash` sends the exact Crashpad multipart request with its external event ID; `sdk.native.tus-minidump` exercises TUS creation, append, and Envelope binding |
| .NET (each literal ASP.NET Core, Azure Functions Worker, Entity Framework, logging, log4net, MAUI, NLog, Serilog, WinForms, WinUI, WPF, Xamarin integration) | Envelope; the pinned .NET 8+ NativeAOT `Sentry.Native` integration emits its native crash through the Envelope route | `sdk.dotnet.<normalized-integration>.ordinary`; `sdk.dotnet.native-crash` uses `Sentry 6.11.0` NativeAOT and `POST /api/<project_id>/envelope/` |
| PHP (`PHP`, Laravel, Symfony) | Envelope; legacy `store` is covered by the legacy-transport fixture | `sdk.php.{php,laravel,symfony}.ordinary`; `sdk.php.legacy-store` |
| PowerShell | Envelope | `sdk.powershell.ordinary` |
| Python (each literal integration listed above) | Envelope | `sdk.python.<normalized-integration>.ordinary` for every listed integration |
| React Native and Expo | `POST /api/<project_id>/envelope/`; the pinned native-crash path uses the native dependency's Envelope transport | `sdk.react-native.{react-native,expo}.ordinary`; `sdk.react-native.native-crash` sends a native event item and any emitted attachment items through the Envelope route, using `sentry-android 8.56.0` on Android and `sentry-cocoa 9.28.0` on Apple targets; there is no conditional minidump branch |
| Ruby (`Rack`, Rails, Sidekiq, Resque, Delayed Job) | Envelope | `sdk.ruby.{rack,rails,sidekiq,resque,delayed-job}.ordinary` |
| Rust (`Actix Web`, axum, `tracing`) | Envelope | `sdk.rust.{actix-web,axum,tracing}.ordinary` |
| Unity | `POST /api/<project_id>/envelope/` for ordinary and native-crash workflows | `sdk.unity.ordinary`; `sdk.unity.native-crash` runs Unity 4.10.0 on Windows x64 and emits one fatal event item plus an `event.minidump` attachment item; the pinned `sentry-native` submodule is `1c935e87ce24d4697ac4710278269237be17e006`; no `/minidump/` alternative is selected |
| Unreal Engine | `POST /api/<project_id>/envelope/` for ordinary and native-crash workflows | `sdk.unreal.ordinary`; `sdk.unreal.native-crash` runs Unreal 1.23.0 on Win64 and emits one fatal event item plus an `event.minidump` attachment item; the pinned `sentry-native` submodule is `672b86c77c1864e1c0b5e72eefadc078e30ef700`; no multipart minidump alternative is selected |

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
| `/api/<project_id>/envelope/` | `POST` | Collection-only DSN in `X-Sentry-Auth`, DSN query parameters, or the DSN URL used by the pinned SDK | Supported for an active project for error events, attachments, client reports, and native crash items. Every structurally valid, non-conflicting Envelope returns `200` with an empty response body, including accepted, mixed, empty, and unsupported-only Envelopes; durable acceptance is returned before asynchronous processing/query visibility. An idempotency or digest conflict returns the `409 conflict` response defined below instead of the blanket `200`. Disabled, deleting, and deleted projects use the lifecycle admission responses below before payload acceptance. |
| `/api/<project_id>/envelope/` | `OPTIONS` | Collection-only DSN in the DSN query parameters or DSN URL, project alias, and request `Origin` | Supported only for a configured project-origin CORS preflight. The DSN authenticates and tenant-binds the project alias before the allowlist is read. Returns `204` with no persistence side effect; a missing, invalid, or disallowed origin receives `401`/`403` with no CORS allow headers. |
| `/api/<project_id>/store/` | `POST` | Collection-only DSN | Supported legacy JSON error path required by a pinned client. The body is converted to one error event and follows Envelope admission semantics. Successful admission returns `200` with a zero-length body and request-ID headers. |
| `/api/<project_id>/minidump/` | `POST` | Collection-only DSN | Supported for pinned crash workflows whose fixture specifies the non-Envelope minidump path. `multipart/form-data` and the pinned client field names are accepted. Successful admission returns `200` with a zero-length body and request-ID headers. |
| `/api/<project_id>/upload/` | `POST` | Collection-only DSN | Supported pinned Native large-attachment TUS creation route. A valid integer `Upload-Length` from `0` through `20,000,000`, `Tus-Resumable: 1.0.0`, and `Upload-Metadata: sentry <base64({"attachment_type":"event.minidump"})>` request returns `201` with a project-bound `Location`, `Tus-Resumable: 1.0.0`, and `Upload-Offset: 0`; it creates a pending upload but no accepted attachment bytes. |
| `/api/<project_id>/upload/<upload_id>` | `HEAD`, `PATCH` | Collection-only DSN bound to the upload | Supported pinned Native TUS offset and append workflow. `HEAD` requires request `Tus-Resumable: 1.0.0` and, on success, returns `200` with an empty body and `Tus-Resumable: 1.0.0`, `Upload-Offset`, and `Upload-Length` response headers. Missing or unsupported `Tus-Resumable` returns `412 precondition_failed`; a missing, expired, already-bound, or inaccessible upload returns `404 not_found`, and invalid authentication returns `401 invalid_authentication`. `PATCH` requires `Tus-Resumable: 1.0.0`, `Upload-Offset`, and `application/offset+octet-stream`, appends only at the expected offset, and returns `204` with an empty body, `Tus-Resumable: 1.0.0`, and the new `Upload-Offset`. A stale or mismatched offset returns `409 conflict` with the current `Upload-Offset`; bytes that would exceed `Upload-Length` return `413 payload_too_large` with the current `Upload-Offset`. Both failures use the standard JSON error body and atomically append no bytes. Reaching the declared length transitions the upload to `complete-unbound`; it remains subject to attachment and project limits and is not accepted until the subsequent Envelope binds it to an event. |
| `/api/<project_id>/security-report/` | `POST` | Collection-only DSN | Explicitly unsupported in v1; returns `501 unsupported_capability` with no persistence side effect because security reports are not error telemetry. |
| Any other `/api/<project_id>/...` ingestion route | Any | Any | `404` or `405` according to whether the path or method is unknown; no side effect. |

`project_id` is a compatibility alias accepted only at the adapter boundary.
It resolves to one canonical lowercase UUID v7 project identity within the
authenticated tenant. It is never reused after deletion and is never accepted
from an unrelated tenant.

### Project lifecycle admission

Collection admission evaluates the project lifecycle state and environment
retirement fence before parsing or persisting a new request. An `active`
project follows the route-specific behavior above, including `200` with an
empty body for a structurally valid, non-conflicting Envelope. A `disabled`
project returns `403 permission_denied` with detail `Project collection is
disabled.`; a `deleting` project returns `409 conflict` with detail `Project
deletion is in progress.`; and a `deleted` project returns `404 not_found`.
These lifecycle responses apply to collection and upload admission, and every
rejected request persists no payload, acceptance record, attachment bytes, or
operation state.

Before accepting an error event, Ingest applies the API-owned environment
retirement tombstone and generation fence. If the event's `environment` names
an environment that is retired for the project, collection returns `409
conflict` with detail `Environment is retired.` and persists no payload,
acceptance record, attachment bytes, or operation state. The adapter never
silently drops the event or automatically re-registers that name. Data already
accepted before retirement finishes normally; only an authorized reactivation
may advance the generation and admit the name again.

The pinned Native large-attachment flow binds a completed TUS upload through
the subsequent Envelope, not through the TUS upload alone. The Envelope carries
the event's `event_id` and an `attachment` item whose
`content_type` is `application/vnd.sentry.attachment-ref+json`, whose
`attachment_type` is `event.minidump`, whose `attachment_length` equals the
declared upload length, and whose JSON payload contains the returned `Location`
and a relative `path`. For an ordinary attachment, `attachment_length` must
equal the decoded item payload length. For this reference attachment, it must
equal the completed TUS upload's actual byte count and the declared
`Upload-Length`; the small JSON reference payload itself is not measured
against that value. The adapter requires that `Location`, project, DSN tenant,
and event ID match the pending upload and accepted event; it atomically
transitions `complete-unbound` to `bound` and retains the uploaded bytes only
as an attachment of that event. A completed upload never becomes a standalone
event or attachment, and an unreferenced completed upload expires without
durable customer-payload acceptance.

Browser-origin requests to the Envelope route require an exact match against
the project's configured browser-origin allowlist. A request without `Origin`
uses the ordinary non-browser contract. For an allowlisted origin, every
preflight and actual response, including safe errors, contains
`Access-Control-Allow-Origin` set to that exact origin and `Vary: Origin`; it
never uses `*` and never enables credentials. The preflight response also
contains `Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: Content-Type, Content-Encoding, X-Sentry-Auth,
Sentry-Trace, Baggage, X-Request-ID`, and `Access-Control-Max-Age: 600`. Actual responses
expose `X-Request-ID`, `X-Watchtower-Request-ID`, `X-Sentry-Rate-Limits`, and
`Retry-After` when present. An origin absent from
the allowlist, or a project with no configured allowlist, receives
`403 permission_denied` before payload acceptance and no CORS allow headers.

### Management and release routes

| Route family | Methods and behavior |
| --- | --- |
| `/api/0/` | `GET` authentication/capability read required by sentry-cli; it returns the exact safe compatibility response defined in Capability negotiation. Mutations and unlisted methods are rejected. |
| `/api/0/organizations/` | `GET` organization reads for the authenticated principal; pagination and current authorization apply. Organization creation, deletion, membership, team, SSO, and broad settings administration are not exposed through Sentry compatibility. |
| `/api/0/organizations/<organization>/` | `GET` organization read. Unknown or unauthorized organizations return indistinguishable `404`. |
| `/api/0/organizations/<organization>/projects/` | `GET` project list and `POST` project creation using the exact request body below. Creation uses the native lifecycle barrier and returns `202` plus an operation ID until all required owners and Jobs acknowledge enablement. |
| `/api/0/projects/<organization>/<project>/` | `GET` project read, `PUT` supported project settings including the browser-origin allowlist, and `DELETE` project deletion. Project deletion requires a current Owner/Admin user session recently reauthenticated within five minutes under applicable organization SSO/MFA conditions, `X-Confirm-Project-Name` containing the exact current project name, idempotency, lifecycle fences, and never reports success before authoritative completion. |
| `/api/0/projects/<organization>/<project>/keys/` | `GET` DSN metadata/public DSNs and `POST` issuance using the exact closed body and `201` response below. Plaintext management tokens are never returned. |
| `/api/0/projects/<organization>/<project>/keys/<key_id>/` | `PUT` rotation with an empty body and `200` DSN response, and bodyless `DELETE` revocation with `204`; both use the exact idempotency rules below and never return a secret. |
| `/api/0/projects/<organization>/<project>/issues/` | `GET` issue list with the exact bounded filters and cursor pagination defined below, and `PUT` only for the pinned bulk status operation with repeated bounded `id` query parameters and a `resolved`, `unresolved`, `ignored`, `muted`, or `resolvedInNextRelease` status body. The latter two map as defined for the unqualified issue route. `POST`, `DELETE`, and unbounded bulk operations are unsupported. |
| `/api/0/issues/<issue>/` | `GET` issue read and `PUT` status transitions with the exact request body defined below for `resolved`, `unresolved`, `ignored`, `muted`, and `resolvedInNextRelease`. `muted` maps to `ignored`; `resolvedInNextRelease` maps to `resolved` with `statusDetails.inNextRelease: true`. Issue assignment, merge, split, delete, bookmark, alert, and comment operations are unsupported. |
| `/api/0/issues/<issue>/events/` | `GET` issue event list with bounded cursor pagination. |
| `/api/0/projects/<organization>/<project>/events/` | `GET` project event list with bounded cursor pagination for the pinned CLI/query workflow. |
| `/api/0/projects/<organization>/<project>/events/<event>/` | `GET` event read subject to tenant, project, retention, and query authorization. The external event identifier is never a Watchtower primary key. |
| `/api/0/organizations/<organization>/releases/` | `GET` release list and `POST` release creation. Release reads/updates/finalization use the exact sentry-cli request fields and idempotency rules. |
| `/api/0/projects/<organization>/<project>/releases/` | `GET` release list scoped to a project, as used by sentry-cli. Release creation remains organization-scoped. |
| `/api/0/organizations/<organization>/releases/<version>/` | `GET` and `PUT` release metadata. Release deletion is unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/commits/` | `GET` a direct array of commit objects, each containing exactly `{ "id": string }`, required by `sentry-cli info`; commit association writes are unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/previous-with-commits/` | `GET` the fixed Release DTO below for the previous release, or `404 not_found` when no previous release is available, subject to project and tenant scope. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/` | `GET` file listing and `POST` upload using the exact multipart protocol below. Source maps and debug files are handled by the artifact authority. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/<file_id>/` | `GET` the one release file identified by `file_id`, returning its Artifact DTO and current strong `ETag`; `DELETE` performs idempotent failed-upload cleanup using that exact observed ETag. Deletion never bypasses lifecycle rules. |
| `/api/0/organizations/<organization>/chunk-upload/` | `GET` organization-scoped artifact-bundle and DIF chunk capability for the pinned sentry-cli. The response supplies the upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. The returned `url` is itself an admitted organization-scoped multipart `POST` route valid for both workflows; its request carries no project field. |
| `/api/0/projects/<organization>/<project>/chunk-upload/` | `GET` project-scoped DIF chunk capability for the pinned sentry-cli. The response supplies a project-bound upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. |
| `/api/0/projects/<organization>/<project>/files/difs/chunks/` (or the exact project-bound upload URL returned by the DIF capability response) | `POST` multipart chunk upload using `file` or `file_gzip` parts keyed by SHA-1 checksum. A matching checksum is idempotent; conflicting bytes are `409`. |
| `/api/0/projects/<organization>/<project>/files/difs/assemble/` | `POST` DIF assembly with the pinned sentry-cli request map. The response reports each digest's `state`, `missingChunks`, bounded `detail`, and registered DIF when complete. Polling repeats this request with the same body and optional idempotency key. |
| `/api/0/organizations/<organization>/artifactbundle/assemble/` | `POST` source-map/artifact-bundle assembly with `checksum`, ordered `chunks`, `projects`, optional `version`, and optional `dist`; repeated identical POSTs poll the same assembly and return the exact per-project artifact-bundle response defined below. `202` remains pending until artifact processing completes. `checksum` is the lowercase SHA-1 of the ordered decompressed chunk bytes defined below. |
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

### Project mutation request bodies

Project mutation bodies are JSON objects with no unknown members or duplicate
keys. `POST /api/0/organizations/<organization>/projects/` accepts exactly:

```json
{
  "name": "project-name",
  "platform": "javascript"
}
```

`name` is required and is a non-empty bounded string. `platform` is optional
and nullable; omission and explicit `null` mean that no platform is configured.
`browser_origins` is not accepted during creation and is initialized to an
empty array. A missing or empty name, an invalid platform, a duplicate key, or
any other member returns `400 invalid_request` before mutation.

`PUT /api/0/projects/<organization>/<project>/` accepts exactly this body for
the v1 browser-origin setting:

```json
{
  "browser_origins": ["https://app.example.invalid"]
}
```

The array is unique and uses the origin validation rules below. No other
project setting is exposed by this compatibility route. The project-creation
canonical request identity is the lowercase SHA-256 of the RFC 8785
canonical-JSON encoding of the normalized body; the required
`Idempotency-Key` binds to that digest and is excluded from it. Project updates
use the observed strong `If-Match` ETag and existing mutation idempotency rules.

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
returned. On a project route, a current Owner/Admin user session that passes
the control-plane reauthentication requirement receives `403
permission_denied` with exactly this bounded deletion-handoff shape:

```json
{
  "code": "permission_denied",
  "detail": "Organization access is suspended.",
  "suspension": {
    "status": "suspended",
    "reason": "customer-safe bounded reason",
    "support_url": "https://support.example.invalid/organizations/<organization>/suspension"
  },
  "deletion_target": {
    "name": "current project name"
  }
}
```

For non-project routes, `deletion_target` is omitted. `reason` is the
operator-provided customer-safe reason, limited to 1,024
characters, and `support_url` is the configured HTTPS support route. Other
principals and credentials receive the ordinary indistinguishable `404
not_found` or `401 invalid_authentication` result; they cannot use suspension
responses to enumerate organizations. The only compatibility mutation allowed
while suspended is the control-plane restricted project-deletion request for a
current Owner/Admin user session with exact name confirmation, fresh
authentication, the expected version, and idempotency; the project-route
response exposes only `deletion_target.name` for this handoff and includes the
current strong `ETag` header. The caller copies that exact name into
`X-Confirm-Project-Name` and that exact ETag into `If-Match`; the deletion
request returns only the pending deletion operation and never a resource DTO.
Organization deletion, suspension removal, token issuance, and all other
changes remain unavailable.

There is one restricted read exception to the suspension fence. A `GET`
`/api/0/operations/<operation_id>/` request may return the normal operation
status DTO while suspended only when the caller is the current Owner/Admin user
session that satisfies the fresh-authentication requirement and the operation
is the exact project-deletion operation authorized for that tenant and deletion
target. The operation result remains the minimal deletion result (`null`
after success); no project or organization DTO is exposed. An unknown,
cross-tenant, differently scoped, or otherwise unauthorized operation remains
the indistinguishable `404 not_found` response, and every other operation-status
read receives the ordinary suspension response.

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

Collection credential parsing is deterministic. `X-Sentry-Auth` uses the exact
ASCII grammar `Sentry ` followed by comma-separated `name=value` members with
no duplicate names, surrounding whitespace, quoted values, or empty values.
It requires `sentry_version=7` and `sentry_key=<public-key>` and may contain
the bounded diagnostic `sentry_client=<client>`; `sentry_secret` and unknown
members are invalid. Query-string credentials use one `sentry_key` parameter
and, when present, one `sentry_version=7` parameter; query values are
percent-decoded once as UTF-8, and duplicate or malformed parameters are
invalid.

A DSN URL credential is an absolute `http` or `https` URL whose user-info has
one percent-decoded public-key username and no password. Its final path
segment is the project alias and must equal the route's `<project_id>` after
one path decode; the URL host is not an authorization scope. A request may
provide the header, query, and URL forms together only when every supplied
public key and project alias agrees. Missing, malformed, duplicate, or
conflicting sources return `401 invalid_authentication` before project lookup;
an agreed key is then tenant-bound and checked as a current collection-only
DSN. No source can select a different project from the route.

### Request and response fields

Every compatible request may carry `X-Request-ID`; the adapter validates a
canonical UUID v7 value or generates one. The exact mutation precondition wire
fields are:

- `Idempotency-Key` is a single HTTP header containing 1–128 printable ASCII
  bytes (`0x21`–`0x7e`), with no whitespace, controls, quotes, or duplicate
  header values. When supplied, it is bound to the control-plane tuple
  `(principal_id, scope_kind, scope_id, operation, idempotency_key)` and the
  canonical request-body digest. The adapter maps each mutation to its
  canonical organization, project, release, or account scope; the same key on
  different project scopes is independent. Operations
  explicitly marked as requiring a client key reject a missing or malformed key
  with `400 invalid_request` before mutation; reusing a key for different scope,
  operation, or body returns `409 conflict`.
- A versioned resource response includes a strong `ETag` header in the exact
  form `"v<decimal-version>"`, where `<decimal-version>` is a positive base-10
  API resource version with no leading zeroes. `ETag` is never weak and is not
  returned as a JSON field. A mutation supplies the observed version only in a
  single `If-Match` header containing that exact quoted ETag; `If-Match: *`, an
  unquoted value, a weak tag, a list, or a JSON/query-string version is invalid
  and returns `400 invalid_request`. A mismatched tag returns `409 conflict`.
- Project deletion additionally requires one `X-Confirm-Project-Name` header.
  Its value is the exact current project display name, compared case-sensitively
  without trimming or alias normalization; a missing or mismatched value returns
  `400 invalid_request` before idempotency lookup or mutation.

The adapter forwards neither credential material nor unrestricted customer
payloads into internal messages.

| Operation | Required request fields | Successful response fields |
| --- | --- | --- |
| Envelope/event admission | Project DSN, project alias, Envelope headers, item headers/payloads, and a supported event ID for event items | A non-conflicting Envelope `POST` returns `200` with an empty body and request ID headers; digest/idempotency conflicts return `409`; legacy or client-specific body expectations retain the preserved scoped external event ID |
| Organization/project read | Organization/project compatibility alias and current management credential | Upstream-compatible resource DTO containing only currently readable fields, canonical-safe pagination link, and request ID |
| Project create/update/delete | Organization scope, the exact project mutation body defined below, current authorization, observed version for settings, `X-Confirm-Project-Name` for delete, and idempotency key for create/delete | Resource alias and canonical-safe DTO, or `202` operation ID while lifecycle barriers remain pending |
| DSN issue/rotate/revoke | Project scope, the exact closed issuance body or empty/bodyless mutation shape below, current Manage authority, and a required idempotency key | `201` issuance or `200` rotation returns the fixed DSN DTO; `204` revocation has an empty body; management-token plaintext is never returned |
| Issue/event read or status transition | Tenant-unique issue alias or tenant/project-scoped event alias, bounded filters or status, and current credential | The fixed Issue or Event DTO below, request ID, and cursor link when paginated |
| Release mutation | Organization/project scope, release version, bounded metadata, and canonical request identity; an `Idempotency-Key` may additionally bind the request | Release alias/version, operation state, and request ID |
| Release artifact upload | Project/release version scope, logical filename, optional distribution, bounded bytes, artifact type, and management credential | Artifact/file/checksum identity, upload or assembly operation ID, and `202` pending state when asynchronous |
| DIF chunk/assembly upload | Organization or project capability scope for chunks, project scope for assembly, a checksum-keyed request map of one to 256 entries whose lowercase full-file SHA-1 keys each map to `name`, optional `debug_id`, and ordered chunks, bounded bytes, and management credential | DIF checksum/debug identities, assembly operation ID, and `202` pending state when asynchronous |
| Release file deletion | Exact project/release scope, required `file_id`, current Manage authority, required observed resource version, and a required idempotency key | `204` with an empty body after durable deletion; repeating the same target is the same successful no-op |
| Deployment record | Organization scope, release version, environment/name/timestamp, bounded metadata, and canonical request identity; an `Idempotency-Key` may additionally bind the request | Deployment identity, release reference, timestamp, and request ID |

### Organization and project DTOs

Organization and project reads use the following minimal safe schemas. Every
listed field is present; `platform` is the only nullable project field. List routes
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
| Organization | `isEarlyAdopter` | Required boolean, always `false` in the compatibility representation |
| Organization | `require2FA` | Required boolean, always `false` in the compatibility representation |
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
| Release commit | `id` | Required string; each `/commits/` response element contains exactly this field |
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
| DIF | `debugId` | Required lowercase UUID string unless `uuid` is supplied |
| DIF | `uuid` | Nullable lowercase UUID string; at least one of `debugId` or `uuid` is present |
| DIF | `name` | Required logical filename string |
| DIF | `objectName` | Required string |
| DIF | `cpuName` | Required string |
| DIF | `data` | Required bounded object using the pinned sentry-cli `DebugInfoData` shape: nullable `type` using the pinned `ObjectKind` enum and a string array `features` (which may be empty) |
| DIF | `size` | Required non-negative integer assembled byte count |
| DIF | `sha1` | Required lowercase 40-character hexadecimal full-file SHA-1 |
| DIF | `type` | Required enum: `debug`, `proguard`, `breakpad`, or `sourcebundle` |
| DIF | `state` | Required sentry-cli enum: `not_found`, `created`, `assembling`, `ok`, or `error` |
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
| Deployment | `dateFinished` | Required RFC 3339 UTC string; the deployment request `timestamp` is the completion time |
| Deployment | `dateCreated` | Required RFC 3339 UTC string |
| Deployment | `release` | Required object containing exactly the non-empty release version string `version` |

### DSN mutation request and response bodies

DSN mutations require `Idempotency-Key` and the current `Manage` authority.
Their idempotency scope is the canonical project UUID and the operation
discriminator (`dsn.issue`, `dsn.rotate`, or `dsn.revoke`); the key is never
looked up globally across projects. The request digest is the RFC 8785
canonical-JSON digest of the body shape below, excluding the HTTP key.

`POST /api/0/projects/<organization>/<project>/keys/` accepts exactly:

```json
{
  "name": "mobile-production",
  "platform": "javascript"
}
```

`name` is required, non-null, and a bounded non-empty string. `platform` is
optional and nullable; omission and explicit `null` both mean that no platform
is configured. When non-null it is a bounded string. Duplicate or unknown
members, an empty body, a null name, or any other type returns
`400 invalid_request` before mutation. A new key returns `201` with the fixed
DSN DTO and the request-ID headers.

`PUT /api/0/projects/<organization>/<project>/keys/<key_id>/` accepts an empty
JSON object `{}` and no other members. It returns `200` with the fixed DSN DTO
containing the newly durable public DSN. `DELETE` on the same route is
bodyless: a present body, including `{}`, is invalid. Successful revocation
returns `204` with an empty body and no `Content-Type`. Repeating the same
operation with the same scoped key returns the original successful result;
reusing that key for another body, operation, or project returns `409 conflict`.

### Release mutation request bodies

Release mutation bodies are JSON objects with no unknown members or duplicate
keys. The canonical request identity is the RFC 8785 canonical-JSON digest of
the normalized body shown below; omitted optional members remain omitted, while
an explicit `null` is retained and means clear the corresponding nullable
metadata. The `Idempotency-Key`, when supplied, binds to this digest but is not
included in it.

`POST /api/0/organizations/<organization>/releases/` accepts exactly:

```json
{
  "version": "release-version",
  "projects": ["project-slug"],
  "ref": "git-ref",
  "url": "https://example.invalid/releases/release-version",
  "dateStarted": "2026-09-11T12:00:00Z"
}
```

`version` is required and is a non-empty bounded string. `projects` is
optional, but when present is a non-null array of at most 100 unique project
aliases from the organization. `ref`, `url`, and `dateStarted` are optional nullable
strings; a non-null `url` is an HTTP(S) URL and a non-null `dateStarted` is an
RFC 3339 UTC timestamp. `dateReleased` is not accepted during creation;
finalization uses the separate body below. An empty object, a missing or empty
`version`, an invalid nullable value, a duplicate project, or any other member
returns `400 invalid_request` before mutation.

`PUT /api/0/organizations/<organization>/releases/<version>/` accepts one of
these two mutually exclusive shapes:

```json
{ "ref": "git-ref", "url": null, "dateStarted": "2026-09-11T12:00:00Z" }
```

The metadata shape contains one or more of `ref`, `url`, and `dateStarted`,
each with the same nullable type rules as creation; omitted members remain
unchanged. The finalization shape is exactly:

```json
{ "dateReleased": "2026-09-11T12:00:00Z" }
```

`dateReleased` must be a non-null RFC 3339 UTC timestamp and cannot be combined
with metadata members or sent as `null`. The path version is authoritative and
`version`, `projects`, `commits`, and all other body members are rejected.
These exact combinations are the only accepted release update/finalization
bodies; successful retries use the existing release idempotency rules.

DSN responses never contain `secret`, `clientSecret`, management-token
plaintext, or any other credential field, including as a nullable field. A
successful DSN rotation returns the same fixed DSN DTO with the new public DSN.
Artifact and DIF response objects contain identity and processing state only;
they never inline artifact, chunk, minidump, or source-map bytes.

The optional `dif` member in a DIF assembly result uses the pinned sentry-cli
`DebugInfoFile` shape rather than the internal DIF summary above. It contains
the required `debugId` or `uuid` identity (at least one), `objectName`,
`cpuName`, lowercase 40-character `sha1`, and the required bounded `data`
object with nullable `type` and a string-array `features` field. No snake-case
aliases or internal storage fields are emitted.

### Issue and event DTOs

Issue and event list routes return direct arrays of the fixed DTOs below. Detail
routes and single-issue status transitions return one DTO. Bulk issue status
transitions return a direct array of updated Issue DTOs in the request `id`
order. Pagination remains in the
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

The project issue-list route accepts only these query parameters. Each scalar
parameter may occur once; repeated scalar parameters, unknown parameters, empty
values, malformed percent-encoding, and values over the applicable 256-byte
filter limit return `400 invalid_request` before lookup. `cursor` is the
opaque cursor from `Link`; `limit` is one decimal integer from `1` through
`100`, defaulting to `100`.

| Parameter | Grammar and semantics |
| --- | --- |
| `query` | One non-empty UTF-8 literal, with no query-language operators; case-insensitive substring matching is applied to issue title, culprit, and message. |
| `status` | One of `resolved`, `unresolved`, or `ignored`; it filters the current issue status. |
| `environment` | One or more unique non-empty environment strings; repeated values are ORed, while different parameter names are ANDed. |
| `cursor` | One opaque, URL-safe cursor returned by the contract's `Link` header; it cannot be combined with a different route scope or filter set. |
| `limit` | One decimal page size from `1` through `100`; it is not part of the filter predicate but is bound into the cursor. |

Issue results always use `lastSeen DESC` then issue `id ASC`; `sort` and every
other query parameter are unsupported. `query`, `status`, and
`environment` may be combined, and the complete normalized parameter set is
bound into pagination. The bulk `PUT` route's separate repeated `id` and
`current_status` parameters are not accepted by `GET`.

The issue `project` object uses the same field types as the project DTO but
contains no organization or lifecycle metadata. `PUT` status transitions accept
`resolved`, `unresolved`, `ignored`, `muted`, and `resolvedInNextRelease`,
return the updated Issue DTO, map `muted` to `ignored`, and map
`resolvedInNextRelease` to `resolved` with `statusDetails.inNextRelease: true`.
Any other requested status is `400 invalid_request`. Event reads never expose raw storage references,
unbounded request data, credentials, or private user fields omitted above.

Issue status transitions use one exact JSON request body for both supported
routes:

```json
{ "status": "<supported-status>" }
```

The single-issue `PUT /api/0/issues/<issue>/` accepts only that object, with
`status` set to one of the five supported values above. The bulk
`PUT /api/0/projects/<organization>/<project>/issues/` uses the same body and
requires one to 100 repeated `id=<issue>` query parameters; IDs must be unique.
It may also receive one `current_status` query filter, limited to `resolved`,
`unresolved`, or `ignored`, which selects the current status that each target
must have before the transition. A scalar status body, a query-only
transition, duplicate IDs, an empty ID set, more than 100 IDs, and an
unbounded update-all request are invalid and produce no mutation.

Bulk transitions are all-or-nothing. The adapter validates and authorizes every
target before changing any issue. A missing or inaccessible target returns
`404 not_found`; a `current_status` mismatch returns `409 conflict`; and an
owner or dependency outage returns `503 unavailable`; each result produces no
partial update. A successful one- to 100-ID request returns `200` with the
direct array of updated Issue DTOs in the submitted ID order.

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

`status` in a serialized Operation DTO is one of `pending`, `succeeded`, or
`failed`; an expired tombstone is a retained internal state and is never
serialized as an Operation DTO.
`completed_at` is null only for `pending`; `result` is non-null for a succeeded
non-destructive operation but is `null` for a succeeded destructive operation
(currently project deletion); and `error` is non-null only for `failed`. A
non-null result contains only the bounded resource or artifact DTO
for the originating operation. A successful destructive operation is terminal
by `status: "succeeded"` and never returns a deleted resource DTO. An error
contains the standard `code`, `detail`, and `request_id` members plus optional
bounded field errors; it never contains owner diagnostics, secrets, or payload
data.

The status URL returns `202` for `pending` with `Retry-After`, and `200` for
`succeeded` and `failed`. An expired retained tombstone returns `410` with the
top-level compatibility-error object `{ "code": "operation_expired", "detail":
"The operation result has expired.", "request_id": "<request-id>" }`; it does
not return an Operation DTO with `status: "expired"`. This `410` is the explicit
operation-status exception to the rule that successful operation reads use the
Operation DTO. Unknown or inaccessible operation IDs return indistinguishable
`404 not_found`; an unavailable owner returns `503 unavailable` without
reporting a terminal state. A `202` creation response uses the same `pending`
body and never claims lifecycle or artifact completion.

Responses never expose internal component names, database identifiers, raw
storage references, secrets, or unrestricted payloads. A `202` response includes
the operation status DTO with `status=pending` and a status URL when the pinned
client requires polling; it never claims processing completion.

### Compatibility error bodies and mapping

Every direct management or ingestion error other than the documented suspension
response uses this exact JSON object:

```json
{
  "code": "invalid_request",
  "detail": "The request body is invalid.",
  "request_id": "canonical-lowercase-uuid-v7",
  "field_errors": [
    { "field": "version", "reason": "required" }
  ]
}
```

`code`, `detail`, and `request_id` are required and non-null. `request_id` is a
canonical lowercase UUID v7 equal to the `X-Watchtower-Request-ID` response
header. `field_errors` is omitted when there are no field-specific errors and,
when present, is a non-empty array whose entries contain exactly the non-empty
safe strings `field` and `reason`; it is never `null`. No other members are
allowed. The same object, including `request_id`, is used for the nested
operation `error` value. The suspension response above remains the only
route-specific extension and retains only its documented bounded members.

The `internal_error` body is the same shape with the fixed `code` and `detail`
values `internal_error` and `Internal server error`, respectively, and never
contains `field_errors`. Original causes and unrestricted diagnostics never
cross the response boundary. The adapter uses these stable Watchtower-safe
codes while preserving the pinned client's expected HTTP status family.

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `invalid_authentication` | 401 | Missing, malformed, expired, or revoked credential |
| `permission_denied` | 403 | Current principal or credential lacks the action or resource scope |
| `not_found` | 404 | Unknown or inaccessible tenant, project, issue, event, release, or artifact |
| `method_not_allowed` | 405 | Known route with an unsupported method |
| `invalid_request` | 400 | Invalid JSON, field, alias, cursor, checksum, or operation input |
| `operation_expired` | 410 | A retained operation tombstone no longer has a retrievable result |
| `precondition_failed` | 412 | A TUS request is missing or does not support the required protocol version |
| `unsupported_media_type` | 415 | Content type or content encoding is not accepted for the addressed route |
| `invalid_compression` | 400 | The declared gzip content encoding is malformed or cannot be decompressed |
| `invalid_multipart` | 400 | Multipart framing or boundary syntax is malformed |
| `invalid_envelope` | 400 | Invalid framing, length, header, or supported item after transport decoding |
| `internal_error` | 500 | Internal, unknown, or data-loss failure; fixed safe message and request ID, with no original cause |
| `unsupported_capability` | 501 | Explicitly unsupported route, format, workflow, or capability outside an Envelope; individually excluded Envelope items remain bounded exclusions in a `200` Envelope response |
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
| Native TUS upload | `application/offset+octet-stream` for `PATCH`; the exact TUS creation headers for `POST` | identity only |
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
`400 invalid_request`. A JSON management operation with an entity body must
use `application/json`; multipart release, file, and chunk operations use the
content types declared above. Native TUS `Upload-Length` and `Upload-Offset`
are decimal counts of identity attachment bytes; a `Content-Encoding` other
than identity on TUS is rejected with `415 unsupported_media_type` before any
append. A bodyless management read, probe, or poll
may omit `Content-Type`. Every non-empty management response, including
successful DTOs and JSON errors, has exactly `Content-Type: application/json`;
bodyless successes and `204` responses omit it. Response bodies are JSON for
management routes;
Envelope, legacy `store`, and `minidump` ingestion `POST`s return `200` with a
zero-length body and request-ID headers, while `OPTIONS` returns `204` without
a body. Other ingestion failures use the stable JSON error shape.

For a non-Envelope crash path whose fixture specifies minidump upload, the
pinned native uploader sends a bounded `upload_file_minidump` binary multipart
part, the bounded scalar Crashpad annotation fields emitted by that pinned
fixture (`prod`, `ver`, `ptype`, `plat`, and `guid` where present), and a
required `sentry` JSON metadata part containing the scoped external event ID,
release, distribution, and platform context. The annotation allowlist is fixture-
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

The `sentry` member is required for an accepted minidump and its
`event_id` is required to match the external Event DTO identifier; absent
optional fields inside it are omitted. It contains no request ID, DSN, or
transport metadata. Annotation keys and object keys use RFC 8785 ordering, and
the minidump hash is over decompressed bytes rather than multipart framing or
compressed bytes. A missing `sentry` part or missing/malformed `event_id`
returns `400 invalid_request` before acceptance. The retry identity is
`(tenant_id, project_id, external_event_id, minidump_digest)`. A matching
identity returns the original `200` empty-body acceptance, while a matching
external event ID or digest with different bytes, annotations, or metadata
returns `409 conflict`. The Ingest acceptance record retains the digest and
identity for the same acceptance-retention horizon as the raw handoff.

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

For Envelope items, `content_encoding` accepts only `identity` or `gzip`. The
adapter decodes each item incrementally and applies the `20,000,000`-byte
per-item limit and the `50,000,000`-byte aggregate Envelope limit to decoded
bytes, not encoded bytes. Decoded bytes are counted while streaming before
digest calculation, handoff, or persistence; an item or aggregate overage
returns `413 payload_too_large` without accepting any part. A malformed nested
gzip stream returns `400 invalid_compression` and an unsupported item encoding
returns `415 unsupported_media_type`.

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
`content_encoding` (`identity` or `gzip`), `item_count`, and `item_headers` are
accepted only for the item types that define them. An `event` payload may contain the pinned
client's `event_id`, `timestamp`, `platform`, `level`, `message`, `exception`,
`stacktrace`, `release`, `dist`, `environment`, `tags`, `contexts`,
`breadcrumbs`, `sdk`, `user`, `debug_meta`, and bounded event metadata. The
event item's `event_id` is required for a supported event.
`attachment` requires bounded bytes and may carry `filename`, `content_type`,
`attachment_type`, and the integer `attachment_length`. When present,
`attachment_length` is an integer from `0` through `20,000,000` inclusive. For
an ordinary attachment it must equal the decoded attachment byte count. For an
`application/vnd.sentry.attachment-ref+json` attachment it is required and
must equal both the dereferenced completed upload byte count and its declared
TUS `Upload-Length`; the reference JSON payload length is not used for this
comparison. A missing, malformed, or mismatched value is rejected with
`400 invalid_envelope` before binding. The attachment is retained only with
its accepted event.
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
client reports, minidump metadata, and extensible bounded DTO data are ignored
at the adapter boundary and are never persisted, returned, or used for
authorization. Exact management request bodies defined by this contract,
including project mutations, release mutations, issue status transitions, and
artifact or deployment assembly bodies, are closed schemas: an unknown member
returns `400 invalid_request` before mutation. Unknown fields never authorize a
new field, route, scope, or capability. Rejection is deterministic and limited
to malformed JSON or framing, duplicate object member names, a non-object where
an object is required, a wrong type or range for a known required/structural
field, invalid length or encoding, a supported-item validation failure, or an
identity and cross-field mismatch. Thus an otherwise harmless unknown member in
an extensible payload cannot change a successful response into `400`; strict
management schemas remain the explicit exception.

### Acknowledgement, errors, retries, and idempotency

- Every structurally valid, non-conflicting Envelope `POST`, whether it retains
  supported items or is an empty/unsupported-only no-op, returns HTTP `200`
  with a zero-length response body. Request IDs remain response headers, and
  no `202` or `204` success is used for Envelope admission. A validated
  idempotency or digest conflict instead returns the standard `409 conflict`
  body and no new acceptance side effect.
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
- Before constructing `payload_digest`, the adapter builds
  `normalized_event_object` from the accepted event fields using these exact
  rules:

  | Field class | Accepted shape and normalization |
  | --- | --- |
  | `event_id` | Required 32-character hexadecimal string, lowercased. |
  | `timestamp` | Optional finite JSON number of Unix seconds, represented by its RFC 8785 canonical number form; non-finite values and strings are invalid. |
  | `platform`, `level`, `message`, `release`, `dist`, `environment` | Optional bounded UTF-8 strings or `null`; strings are NFC-normalized, and `level` is lowercased. Missing and explicit `null` are omitted from the normalized object. |
  | `tags` | Optional object whose keys and values are bounded UTF-8 strings; both are NFC-normalized, and the object keys are sorted by RFC 8785 canonical order. |
  | `contexts` | Optional bounded JSON object. Object keys are NFC-normalized and sorted; nested arrays preserve order. |
  | `breadcrumbs` | Optional ordered array of bounded objects. Array order is preserved and every nested object/value uses the recursive bounded-value rules below. |
  | `exception`, `stacktrace`, `sdk`, `user`, `debug_meta`, `metadata` | Optional bounded JSON objects using the recursive bounded-value rules below; absent and `null` values are omitted. |

  Recursive bounded values are only `null`, booleans, finite numbers, NFC
  strings, arrays, or objects. Object keys are NFC-normalized and sorted, array
  order is preserved, and explicit `null` members are retained inside a
  present nested object. The normalized top-level object contains only the
  listed accepted fields, uses the normalized values above, and is serialized
  with RFC 8785; transport fields (`dsn`, `sent_at`, `sdk` envelope headers,
  `trace`, request IDs, and excluded items) remain outside the preimage.
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
        "sha256": lowercase_hex_sha256(dereferenced_or_decoded_attachment_bytes),
        "size": dereferenced_or_decoded_attachment_byte_count
      }
    ]),
    "client_report": sort_by_canonical_json([
      {"reason": string, "category": string, "quantity": integer}
    ])
  }
  ```

  For a TUS reference, `dereferenced_or_decoded_attachment_bytes` means the
  completed upload bytes; the JSON reference document is never the attachment
  digest or size preimage.

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
  not merged or durably accepted. These idempotency checks occur after complete
  structural validation but before any new acceptance side effect, so this
  `409 conflict` is the explicit exception to the otherwise universal `200`
  Envelope acknowledgement. If the acceptance record retires while the canonical event
  remains queryable, a payload-free uniqueness tombstone retains the scoped
  event ID, digest, and canonical event reference for at least the full query-
  retention horizon. During that horizon, a matching retry returns the original
  acceptance without creating another event, while a different digest returns
  `409 conflict`; the event-detail route resolves the one retained canonical
  event. Only after the tombstone and query-retention horizon expire does this
  contract make no historical deduplication or conflicting-digest guarantee.
- An accepted Envelope with no `external_event_id` uses a separate retry
  identity only when the caller supplied a valid canonical `X-Request-ID`:
  `(tenant_id, project_id, client_request_id, payload_digest)`. The same client
  request ID and digest returns the original acceptance, while reusing it with
  a different digest returns `409 conflict` with no new acceptance side effect.
  If no client `X-Request-ID` was
  supplied, the generated response request ID is diagnostic only and each
  retry is a new accepted no-op/client-report submission; identical payloads
  are never collapsed by content alone.
- Creation, deletion, rotation, release finalization, chunk assembly, and
  deployment writes use the control-plane idempotency tuple. Project creation,
  project deletion, DSN mutation, and release-file deletion reject a missing
  required client key before mutation; reusing a supplied key with different
  content returns `409`.
- Pinned release create/update/finalize and deployment requests do not require
  `Idempotency-Key`. When absent, the adapter derives a retry identity from
  `(tenant_id, operation, target_scope, canonical_request_body_digest)` and a
  lost response resumes the identical operation. When supplied, the client key
  binds to the same identity and a reuse with different content returns `409`.
  No retry identity includes credentials or unrestricted payloads.
- Duplicate or out-of-order asynchronous messages are handled by the owning
  component's idempotent command/reconciliation contract. The adapter never
  invents a second canonical event or bypasses a lifecycle fence.

### Pagination and rate-limit headers

List endpoints return bounded arrays with the upstream-compatible `Link`
header and opaque cursor parameters when the pinned client expects them. When a
next page exists, the `Link` header contains a next entry whose URL carries the
opaque `cursor` and whose parameters include exactly `rel="next"` and
`results="true"`; a response without another page has no next entry. A cursor
binds to the original tenant, project, principal, filters, sort order,
and authorization revision. The default keyset ordering is fixed per route:

| List route | Ordering, including tie-breaker |
| --- | --- |
| Organization lists | `dateCreated ASC`, then organization `id ASC` |
| Project lists | `dateCreated ASC`, then project `id ASC` |
| Issue lists | `lastSeen DESC`, then issue `id ASC` |
| Issue-event and project-event lists | `dateReceived DESC`, then external event ID `eventID ASC` |
| Organization- and project-scoped release lists | `dateCreated DESC`, then release `version ASC` |

The first page establishes a read snapshot and its immutable high-water mark;
the opaque cursor carries that snapshot, the last complete ordering tuple, and
the original route scope and filters. Every later page uses the same snapshot,
so records inserted or reordered after the first page are deferred to a new
traversal rather than skipped or duplicated. Each page rechecks current
authorization, revocation, lifecycle, retention, and security-projection
freshness; a record that is no longer authorized is omitted without disclosure.
A stale,
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
`X-Watchtower-Sentry-Compatibility: 1`. A successful authenticated
`GET /api/0/` returns `200` with `Content-Type: application/json` and exactly
this body, including this array order:

```json
{
  "compatibility": "1",
  "capabilities": [
    "artifact.bundles",
    "artifact.dif",
    "artifact.files",
    "deployment.records",
    "management.dsns",
    "management.projects",
    "operation.status",
    "query.events",
    "query.issues",
    "release.lifecycle",
    "telemetry.envelope",
    "telemetry.minidump",
    "telemetry.store",
    "telemetry.tus"
  ]
}
```

The `capabilities` array is the only capability location and contains no
excluded item types or routes. The body has no other members. Clients that
probe an unsupported route receive the explicit `404`, `405`, or `501` result
from the route matrix; probing never creates a resource. The absence of an
optional capability is not permission to fall back to a native private route.

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
Crashpad annotations, and required `sentry` metadata with an external event ID. The Godot release commit
is `d288ad983c30bf7a7d924fbceb8ed7cf6e64de9c`, whose `sentry-native`
submodule resolves to `a185ce80ba2416b0a0bb04b4ee8f11f1117ae08f`; Unity and
Unreal use the exact `/envelope/` fatal-event-plus-attachment outputs and
submodule pins defined by their fixture rows; the remaining clients use the
exact supported minidump multipart upload or other non-Envelope crash request
named by their fixture row.
The `sdk.native.tus-minidump` fixture additionally exercises the TUS creation,
offset, append, finalization, and project-bound attachment limits defined above.
Watchtower stores no raw crash payload outside the Ingest-owned accepted record
and handoff; Processor owns normalization and symbolication execution, and
Query visibility is asynchronous.

### Source maps and debug files

The CLI and every listed build plugin use the configured Watchtower URL and
Watchtower management credential. SDK DSNs are not used for artifact writes.
The contract supports JavaScript source maps, native dSYMs and Breakpad/Crashpad
debug files, Android ProGuard/R8 mappings, and the artifact metadata required by
the pinned clients. Artifact-bundle assembly accepts an optional release
`version`; when absent, the artifact has `release: null` and uses the explicit
versionless identity `(project, null release, dist, artifact type, logical
filename)`. Because the pinned artifact-bundle request has no filename field,
the adapter uses the deterministic synthetic name
`artifact-bundle-<checksum>` (the lowercase 40-character bundle SHA-1) for the
Artifact DTO and this identity. Release-associated artifacts are content-addressed and idempotent
within `(project, release-or-null, dist, artifact type, logical filename)`; an
absent `dist` is a distinct identity value from any supplied distribution.
Identical content within the same identity is a successful duplicate, while
conflicting content within that identity is `409`. Different distributions may
therefore reuse a logical filename within one release or versionless bundle.

The direct release-file route
`POST /api/0/projects/<organization>/<project>/releases/<version>/files/` is a
multipart request with exactly one binary `file` part, exactly one UTF-8
`name` text part, exactly one UTF-8 `type` text part, and at most one UTF-8
`dist` text part. The `file` part uses `Content-Disposition: form-data;
name="file"` and `application/octet-stream`; `name`, `type`, and `dist` use
`Content-Disposition: form-data; name="..."` and `text/plain; charset=utf-8`
with no filename. `type` is exactly `source_map` or `debug_file`; `name` is a
non-empty bounded logical filename; omission of `dist` means a null
distribution. Unknown or duplicate parts, a null/empty metadata value, and
any JSON metadata part are rejected before mutation. The outer request accepts
identity or gzip content encoding, and the checksum and size are calculated
from the decompressed `file` bytes, not multipart framing or compressed bytes.

The upload identity is
`(tenant_id, project_id, release_version, dist_or_null, type, name)`. A first
accepted upload returns `202` with the pending Operation DTO, a `Location`
header equal to its `status_url`, and `Retry-After`. Polling that operation
returns `200` with `status: "succeeded"` and the registered Artifact DTO in
`result`, or `status: "failed"` with the standard bounded operation error.
Retries with the same identity and checksum resume the same operation or
return its terminal result; the same identity with different decompressed bytes
returns `409 conflict`. The canonical request digest includes the normalized
metadata and lowercase SHA-1, but never credentials or multipart framing.

Standalone DIF uploads are independent of release and distribution. Their
per-file content identity is `(project, full-file checksum)`; when a
`debug_id` is supplied, `(project, debug_id)` is also unique. A matching
checksum/debug identity with the same name and ordered chunks is a successful
duplicate. Conflicting bytes, debug identity, name, or chunk ordering returns
`409`.

DIF assembly does not require a client idempotency key. For a checksum-keyed
request map containing one or more entries, the adapter derives the operation
identity from `(tenant_id, project_id, canonical_request_body_digest)`. The
digest is the lowercase hexadecimal SHA-256 of the RFC 8785 canonical JSON
encoding of that request map: checksum keys are lowercase and sorted, each
entry preserves its ordered chunk list, and the optional idempotency key is
excluded. A matching retry, including a multi-entry map, resumes the same
operation. When supplied, the client key is bound to that canonical body
digest and a reuse with different content returns `409`; key-conflict
behavior is not applied when no key was supplied.

Artifact upload, symbolication, and event enrichment are asynchronous. A
successful upload means the artifact authority durably accepted the artifact
or an idempotent equivalent; it does not mean a prior event has been
symbolicated. Polling returns pending until terminal success or a safe terminal
failure. Artifact references remain subject to project retention and deletion.

### Chunk upload, assembly, and polling

The organization-scoped sentry-cli capability at
`GET /api/0/organizations/<organization>/chunk-upload/` is authoritative for
both artifact-bundle and DIF uploads and returns JSON with `url`,
`chunksPerRequest`, `maxRequestSize`, `maxFileSize`, `maxWait`,
`hashAlgorithm`, `chunkSize`, `concurrency`, and `compression`. Its required
values are `chunksPerRequest: 4`, `maxRequestSize: 100000000`,
`maxFileSize: 50000000`, `maxWait: 0`, `hashAlgorithm: "sha1"`,
`chunkSize: 20000000`, `concurrency: 8`, and `compression: ["gzip"]`.
`maxWait` is a non-negative integer number of seconds and zero means that the
server imposes no smaller polling cap; `concurrency` is a positive integer and
is fixed at eight workers. The positive batch size and four 20 MB chunks keep
each advertised request below the decompressed request limit including framing.
The project-scoped DIF capability remains available with the same bounded
values and a project-bound `url`. A chunk request is multipart: each `file` or
`file_gzip` part is named by its lowercase SHA-1 checksum. A DIF assembly
request is a JSON map from the full-file SHA-1 checksum to
`{name, debug_id?, chunks}`; its response is the same checksum map with
`{state, missingChunks, detail?, dif?}` and does not require release or
distribution fields. DIF `state` uses only `not_found`, `created`,
`assembling`, `ok`, and `error`; missing chunks produce `not_found`, pending
assembly produces `assembling`, successful creation/completion produces
`created`/`ok`, and terminal owner failure produces `error`. An optional `dif`
uses the exact pinned `DebugInfoFile` fields defined above. An artifact-bundle
assembly request contains `{checksum, chunks, projects, version?, dist?}`;
the pinned client supplies no filename, so the adapter derives the artifact's
logical filename deterministically as `artifact-bundle-<checksum>` using the
lowercase 40-character bundle checksum. Absent `version` selects the
versionless identity above. `projects` is required and must contain one to
100 unique project aliases, all within the authenticated organization. The
adapter validates this cardinality, uniqueness, organization scope, and
authorization before checksum verification, project lookup, operation
creation, assembly, or persistence; an empty, duplicate, over-limit, or
cross-organization list returns `400 invalid_request` or `403
permission_denied` as applicable with no side effect. For an artifact bundle,
`chunks` is a non-empty ordered list of lowercase
40-character SHA-1 chunk names, and `checksum` is the lowercase 40-character
SHA-1 of the byte-for-byte concatenation of those chunks after each
`file_gzip` part has been decompressed, in exactly the listed order. No
separator, JSON wrapper, multipart framing, compressed bytes, or chunk-name
text is included in the preimage. The adapter verifies this checksum before
assembly or persistence; a mismatch returns `400 invalid_request` and does not
create an artifact or operation. The same checksum with the same ordered
content and ordered project list is an idempotent duplicate, while a conflicting
ordered content, version, distribution, or project list is `409 conflict`.

The artifact-bundle assembly response is exactly an object with `state`,
`missingChunks`, `detail`, and `projects` members. `state` is one of `pending`,
`succeeded`, or `failed`; `missingChunks` is always an array of lowercase
40-character SHA-1 chunk names; `detail` is nullable bounded safe text; and
`projects` is an array in the exact input order. Each project result contains
exactly `project`, `state`, `detail`, and `artifact`, where `project` is the
requested alias, the state uses the same three values, detail is nullable safe
text, and artifact is either `null` or the complete Artifact DTO whose
`project` equals that alias.

A pending response is `202` with top-level `state: "pending"`, the currently
missing chunks, `detail: null`, and one pending/null project result per input
project. A successful terminal response is `200` with `state: "succeeded"`, an
empty `missingChunks` array, `detail: null`, and one succeeded project result
with its registered Artifact DTO for every input project. A terminal owner
failure is `200` with `state: "failed"`, an empty or still-relevant
`missingChunks` array, a non-null safe top-level detail, and one failed/null
project result per input project; no project registration is exposed as a
partial success. Registration of all project artifacts is one atomic operation:
if any target cannot complete, no target is committed as a successful result.
Conflicting input remains `409 conflict`, and an unavailable owner remains
`503 unavailable` rather than claiming a terminal result.

Chunks negotiated by the organization capability are organization-scoped
transient records keyed by organization and lowercase chunk checksum; their
upload request intentionally carries no project field. A DIF upload through
the project-scoped capability remains project-bound. At DIF assembly and
artifact-bundle assembly, Watchtower verifies the target project(s) and the
caller's authorization before exposing any result.
The `projects` list is authoritative at assembly, where Watchtower verifies
every target project and the caller's authorization. Same-organization reuse
is allowed after those checks, while cross-organization reuse is rejected.
Watchtower bounds every field and enforces required checksum, order, project,
and applicable artifact identity. These are adapter DTOs only.
The shared capability response advertises `maxFileSize: 50000000` for both
artifact-bundle and DIF workflows, so a pinned client cannot submit a DIF
larger than the 50 MB debug-file limit. The `1,000,000,000` assembled release
artifact value remains the infrastructure upper bound, but the negotiated
capability's smaller 50 MB limit wins for these workflows. The capability also
advertises `maxRequestSize: 100000000`, which is the decompressed
multipart/request limit above. The adapter rejects a chunk request
when the aggregate decompressed request exceeds that value, even when every
individual part and the total part count are within their separate limits.

The pinned sentry-cli chunk workflow is:

1. Probe the organization-scoped capability for either workflow, or the
   project-scoped DIF capability when that route is selected, with a read-only
   request.
2. Upload each content-addressed chunk with its checksum; organization-
   capability uploads carry no project field, while project-capability DIF
   uploads use their project route.
3. Retry a chunk safely by checksum; a matching existing chunk is success.
4. Submit the bounded DIF assembly request as a checksum-keyed map of one or
   more entries, each containing its ordered checksum list, logical filename,
   and optional debug ID, with an optional request idempotency key;
   artifact-bundle assembly additionally carries its project list, optional
   version, and optional distribution.
5. Poll DIF and artifact-bundle assembly by repeating the same assembly POST
   body with bounded backoff and consuming its native `state`, `missingChunks`,
   and `detail` fields. Use the generic operation-status URL only for a
   compatibility workflow that has no upstream assembly polling request.
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

Every `<version>` in a release path is one RFC 3986 URI path segment. Clients
percent-encode the UTF-8 bytes of the version, including reserved bytes such as
`/`, `?`, `#`, and `%`; `+` is a literal plus in a path and is not decoded as a
space. The adapter segments the raw path before decoding exactly once, rejects
malformed escapes, invalid UTF-8, controls, and an empty decoded version with
`400 invalid_request`, and then uses the decoded string for the scoped release
lookup. Query-string bytes and a second decode can never alter the release
alias.

Release-file cleanup uses
`GET` and `DELETE /api/0/projects/<organization>/<project>/releases/<version>/files/<file_id>/`.
`file_id` is the opaque release-file alias returned by file listing or upload
and is resolved only within the authenticated tenant, project, and release
version; the collection route never accepts deletion by filename or an
implicit selector. The item `GET` returns the fixed Artifact DTO and a strong
`ETag` header in the same `"v<decimal-version>"` form used by other versioned
resources. The caller copies that exact observed ETag into `If-Match` for
deletion, needs current `Manage` authority, and must supply
the exact observed `If-Match` ETag and an idempotency key bound to the exact
file target and observed version. A missing `If-Match` or key returns `400
invalid_request` before artifact authority is called.
successful delete returns `204` with an empty body only after durable artifact
authority deletion. Repeating the same target, including with the same key,
returns the same `204` no-op; an unknown or inaccessible target returns
`404 not_found`, a stale observed version or key reused for another target
returns `409 conflict`, and an unavailable artifact owner returns `503`.

Release finalization is idempotent. Deployment records reference a release and
carry the following exact closed JSON body:

```json
{
  "environment": "production",
  "name": "deploy-42",
  "timestamp": "2026-09-11T12:00:00Z",
  "url": "https://example.invalid/deploy-42",
  "metadata": { "build": "2026.09.11.1" }
}
```

`environment` and `timestamp` are required non-empty bounded strings; the
timestamp is an RFC 3339 UTC instant. `name` and `url` are optional nullable
strings, with omission equivalent to `null`; a non-null URL is HTTP(S).
`metadata` is optional but, when present, is a non-null object of bounded
string keys and string values; omission is equivalent to `{}`. Duplicate or
unknown members, null required fields, invalid URLs/timestamps, nested
metadata values, or values over the applicable field limits return
`400 invalid_request` before mutation.

The normalized body replaces omitted nullable values with `null`, omitted
metadata with `{}`, NFC-normalizes strings, and is the RFC 8785 request digest
preimage. Deployment writes do not require a client idempotency key; retries
use `(tenant_id, operation, release_scope, canonical_request_body_digest)`.
The first successful `POST` returns `201` with the fixed Deployment DTO;
`dateFinished` equals `timestamp`, and `dateStarted` is `null` unless native
deployment data supplies it. An identical retry returns `200` with the same
DTO, while a conflicting digest returns `409 conflict`. Deployment records
history only; they do not grant deployment authority, execute deployment work,
or activate unsupported release-health behavior.

## Identity, aliases, and storage ownership

- Organization, project, operation, artifact, release-operation, and internal
  resource identities are canonical lowercase UUID v7 values at Watchtower
  boundaries and PostgreSQL `uuid` when persisted by their owner.
- Sentry project IDs, DSN key IDs, release versions, and event IDs are
  compatibility aliases or scoped external identifiers. Issue IDs and short
  IDs are compatibility aliases unique within the authenticated tenant and are
  never reused across project generations. Organization and project slugs are
  scoped compatibility aliases. All are resolved only after authentication and
  tenant scope are known; slugs may be reused only after deletion completes for
  a new resource generation, while canonical IDs and other scoped external
  identifiers are never reused across generations.
- SDK event IDs are retained as `(tenant_id, project_id, external_event_id)`
  identifiers. Two projects may use the same event ID without collision or
  disclosure. A payload-free uniqueness tombstone prevents reuse while the
  canonical event remains queryable, and the scoped event alias resolves to at
  most that one canonical event. An SDK event ID is never a canonical
  Watchtower primary key.
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
   ignores harmless unknown fields only in extensible payloads; closed
   management request schemas reject unknown members and never persist or
   authorize them.
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
  the `10,000,000`-byte decompressed limit, and `Content-Type: application/json`
  on every non-empty management response;
- minidump uploads with the exact fixture-emitted Crashpad scalar annotations,
  required Sentry metadata and external event ID, rejection of eventless
  minidumps and unlisted file parts, bounded fields, and the successful `200`
  zero-length acknowledgement;
- `sdk.native.crash` using the exact multipart minidump request and
  `sdk.native.tus-minidump` using the separate TUS creation/append and Envelope
  `attachment-ref` binding workflow;
- Unity 4.10.0 Windows x64 and Unreal 1.23.0 Win64 native-crash fixtures,
  each using `/envelope/` with a fatal event and `event.minidump` attachment,
  the pinned `sentry-native` submodule commit, and no non-Envelope alternative;
- legacy `store` uploads with the required JSON event fields and the successful
  `200` zero-length acknowledgement;
- Native TUS large-attachment creation (`201` and `Location`) with the exact
  `Upload-Metadata` value, `HEAD` requests with `Tus-Resumable: 1.0.0`,
  successful `200` empty responses with `Tus-Resumable`, `Upload-Offset`, and
  `Upload-Length`, `412` version-precondition failures, `401` authentication
  failures, and `404` missing/expired/bound/inaccessible uploads, followed by
  expected-offset identity-only `PATCH` appends, gzip `415` responses with no
  append, stale-offset `409` responses and current
  offsets, overflow `413` responses, atomic no-append behavior for both
  failures, incomplete-upload retention, finalization at the declared length,
  ordinary `attachment_length` range/equality checks, reference-length checks
  against dereferenced upload bytes rather than reference JSON bytes, and
  subsequent Envelope `attachment-ref` binding to the event ID;
- empty, unsupported-only, supported-only, and mixed Envelopes, including an
  envelope-level event ID on an excluded-only Envelope, all expecting `200`
  with a zero-length response body, plus eventless empty/client-report retries
  with the same client `X-Request-ID`, different client IDs, and no client ID;
  conflicting event/request digests expect the standard `409 conflict` body
  and no new acceptance side effect;
- nested identity/gzip item payloads at and over the decoded 20,000,000-byte
  item and 50,000,000-byte aggregate limits, with no partial persistence;
- duplicate, case-variant, malformed, and conflicting event IDs, including
  acceptance-record retirement while the canonical event remains queryable and
  uniqueness-tombstone enforcement; equivalent payloads with different
  compression, JSON ordering, or excluded metadata;
  duplicate chunks, interrupted assembly, optional and conflicting DIF
  idempotency keys, retries, polling, and lost responses;
- collection credentials in `X-Sentry-Auth`, DSN query parameters, and DSN
  URLs, including percent-decoding, duplicate parameters, missing/unknown
  members, route-project mismatches, and conflicting sources;
- versioned and versionless artifact-bundle assembly, the deterministic
  `artifact-bundle-<checksum>` name, release-artifact identity across
  release-or-null, distribution, artifact type, and logical filename, plus
  release-independent DIF duplicates and checksum/debug identity conflicts;
- release versions containing percent-encoded reserved path bytes, literal
  plus signs, malformed escapes, invalid UTF-8, query delimiters, and
  double-decoding attempts;
- allowlisted and disallowed browser origins, Envelope CORS preflight and
  actual responses, DSN tenant binding, exact origin reflection, exposed
  request and rate-limit headers including `Content-Encoding`, and no
  persistence for a disallowed origin,
  plus project setting update, version-conflict, lifecycle propagation, and
  read-back cases;
- suspended project deletion with the minimal `deletion_target.name`, the
  current strong `ETag`, exact `X-Confirm-Project-Name`/`If-Match` reuse, and
  no broader project DTO disclosure, plus authorized polling of that exact
  deletion operation while suspended and rejection of unrelated operation
  status reads;
- pagination using the documented per-route order and tie-breaker, snapshot
  consistency under concurrent inserts/updates, cursor binding, malformed and
  expired cursor `400` results, stale cursor `403` results, cross-tenant cursor
  `404` results, rate-limit headers, exact
  `rel="next"`/`results="true"`/`cursor` Link parameters, unknown fields, and
  every safe error class with the exact error-body member rules;
- exact organization/project DTO bodies, including nullable platform,
  organization compatibility booleans, required deployment finish times,
  canonical aliases, origin arrays, omitted unknown fields, and list/detail
  consistency;
- exact issue/event DTO bodies, nullable fields, omitted unknown fields,
  list/detail/status-transition consistency, tenant-unique issue aliases, CLI
  `muted`/`resolvedInNextRelease` mappings, exact single-issue and bulk PUT
  bodies, exact issue-list `query`/`status`/repeated `environment`/`cursor`/
  `limit` filters, duplicate and unknown-filter rejection, repeated unique
  `id` query parameters from 1 through 100, bounded current-status filters,
  direct input-ordered bulk response arrays,
  all-or-nothing precondition failures, and rejection of
  scalar/query-only/unbounded updates;
- release `/commits/` direct arrays containing exactly `{ "id": string }`,
  fixed Release DTO responses or `404 not_found` for
  `/previous-with-commits/`, and the pinned sentry-cli parsing workflow;
- release creation, metadata update, and finalization with the exact request
  bodies, nullable fields, mutually exclusive combinations, canonical digests,
  and rejection of unknown or misplaced fields;
- project creation and browser-origin update with the exact closed request
  bodies, canonical creation digest, required idempotency, nullable platform,
  origin validation, and rejection of unknown members;
- DSN issuance with required name and nullable platform, empty-object rotation,
  bodyless revocation, exact `201`/`200`/`204` responses, scoped idempotency,
  and rejection of unknown members or bodies;
- direct release-file uploads with exact multipart parts and encodings,
  decompressed-byte checksums, duplicate/conflicting identities, `202`
  operation responses, terminal artifact results, and invalid-part rejection;
- project deletion with missing/mismatched confirmation, release-file deletion
  item reads exposing the current strong `ETag`, deletion without `If-Match` or
  idempotency key, by exact `file_id`, repeated deletion, wrong-scope `404`,
  stale-version and idempotency-key conflicts, and owner outage, including a
  terminal successful deletion poll with `result: null`;
- organization-scoped capability probes for both DIF and artifact bundles,
  project-scoped DIF compatibility, exact SHA-1/hash/compression/chunk values,
  the shared `maxFileSize: 50000000` cap,
  exact `maxWait: 0` and `concurrency: 8`, and positive `chunksPerRequest`;
- the authenticated root capability probe with the exact `200` response,
  `Content-Type`, compatibility value, capability array, and array ordering;
- active, disabled, deleting, and deleted project collection admission with
  the exact `200`, `403 permission_denied`, `409 conflict`, and `404
  not_found` results, retired-environment `409 conflict`, and no persistence
  for rejected requests;
- chunk requests at and over the advertised `maxRequestSize`, including
  duplicate and rejected parts, with `413` and no partial persistence for an
  over-limit request, plus DIF/artifact-bundle assembly cardinality at and
  over each explicit digest, chunk, and project limit before lookup, including
  zero, one, 100, duplicate, cross-organization, and 101-project artifact
  lists, and repeated identical assembly POST polling without a generic status
  URL;
- valid, expired, revoked, insufficient-scope, cross-tenant, stale-projection,
  suspended, disabled, deleting, and deleted resources;
- organization/project reads, creation, update, deletion, DSN issuance,
  rotation/revocation, issue/event reads, resolve/reopen/ignore/mute/next-release,
  release requests without client idempotency keys, and deployment workflows;
- operation polling with `202 pending`, `200 succeeded`, `200 failed`, the
  top-level `410 operation_expired` error, unknown-operation `404`, and
  owner-outage `503` responses;
- malformed management JSON versus malformed Envelope JSON, with
  `invalid_request` and `invalid_envelope` respectively;
- single- and multi-entry DIF assembly retries using the canonical sorted
  checksum-keyed request-map digest, excluding the idempotency key and
  preserving chunk order;
- artifact-bundle polling with exact pending `202`, ordered per-project
  results for one and 100 projects, all-or-nothing successful/failed terminal
  states, missing-chunk arrays, safe details, and nullability;
- deployment writes with the closed JSON body, omitted/null normalization,
  metadata bounds, canonical digest, exact `201` initial and `200` duplicate
  responses, and conflicting retry rejection;
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
