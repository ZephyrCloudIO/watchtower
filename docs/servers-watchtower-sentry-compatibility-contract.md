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
| `/api/<project_id>/upload/` | `POST` | Collection-only DSN | Supported pinned Native large-attachment TUS creation route. A valid integer `Upload-Length` from `0` through `20,000,000`, `Tus-Resumable: 1.0.0`, and `Upload-Metadata: sentry <base64({"attachment_type":"event.minidump"})>` request returns `201` with a project-bound `Location` containing a canonical lowercase UUID v7 `upload_id`, `Tus-Resumable: 1.0.0`, and `Upload-Offset: 0`; a zero-length upload is created directly as `complete-unbound`, while a positive-length upload is pending. Neither creation path accepts attachment bytes. A pending upload has a fixed 24-hour lifetime beginning at creation. |
| `/api/<project_id>/upload/<upload_id>` | `HEAD`, `PATCH` | Collection-only DSN bound to the upload | Supported pinned Native TUS offset and append workflow. `HEAD` requires request `Tus-Resumable: 1.0.0` and, on success, returns `200` with an empty body and `Tus-Resumable: 1.0.0`, `Upload-Offset`, and `Upload-Length` response headers. Missing or unsupported `Tus-Resumable` returns `412 precondition_failed`; a missing, expired, already-bound, or inaccessible upload returns `404 not_found`, and invalid authentication returns `401 invalid_authentication`. A failed `HEAD` has no response body or `Content-Type`; it returns only its status, `Tus-Resumable: 1.0.0`, request-ID headers, and `Content-Length: 0`, with no `Upload-Offset` or `Upload-Length`. `PATCH` requires `Tus-Resumable: 1.0.0`, `Upload-Offset`, and `application/offset+octet-stream`, appends only at the expected offset, and returns `204` with an empty body, `Tus-Resumable: 1.0.0`, and the new `Upload-Offset`. A stale or mismatched offset returns `409 conflict` with the current `Upload-Offset`; bytes that would exceed `Upload-Length` return `413 payload_too_large` with the current `Upload-Offset`. `PATCH` failures use the standard JSON error body and atomically append no bytes. Reaching the declared length transitions the upload to `complete-unbound`; it remains subject to attachment and project limits and is not accepted until the subsequent Envelope binds it to an event. |
| `/api/<project_id>/security-report/` | `POST` | Collection-only DSN | Explicitly unsupported in v1; returns `501 unsupported_capability` with no persistence side effect because security reports are not error telemetry. |
| Any other `/api/<project_id>/...` ingestion route | Any | Any | `404` or `405` according to whether the path or method is unknown; no side effect. |

`project_id` is a compatibility alias accepted only at the adapter boundary.
It resolves to one canonical lowercase UUID v7 project identity within the
authenticated tenant. It is never reused after deletion and is never accepted
from an unrelated tenant.

`upload_id` is a repository-owned persistent upload identity and is always a
canonical lowercase UUID v7 at the public boundary. It is tenant- and
project-scoped, is never reused, and is not an exception to the repository's
canonical UUID rule.

### Project lifecycle admission

Collection admission evaluates the project lifecycle state before parsing a new
request. After bounded transport decoding and event parsing, Ingest evaluates
the environment retirement fence before persisting or durably accepting it. An `active`
project follows the route-specific behavior above, including `200` with an
empty body for a structurally valid, non-conflicting Envelope. A `disabled`
project returns `403 permission_denied` with detail `Permission denied.`; a
`deleting` project returns `409 conflict` with detail `The request conflicts
with the current resource state.`; and a `deleted` project returns `404
not_found`.
These lifecycle responses apply to collection admission and every
project-bound upload or assembly request, and every rejected request persists
no payload, acceptance record, attachment bytes, or operation state.
Organization-scoped chunk staging is project-neutral because its request carries
no project identity, but it is not available to every organization member. Both
the organization capability `GET` and the multipart `POST` at its returned URL
require the current principal and credential to have effective `Write` or
`Manage` authority on at least one project in that organization. Owner/Admin
membership qualifies through the effective Manage rule; a project-scoped
personal or service credential qualifies only when its current scope and
membership together grant Write or Manage on at least one project. Read-only
members, Viewer credentials, and credentials with no qualifying project scope
receive the normal authorization failure and consume no staging quota. This
authority check is the same for the capability read and staging POST; project
authorization and lifecycle are rechecked when staged data is supplied to a
project-bound upload or assembly. Staging is therefore not rejected merely
because a later target project is disabled, while the project fence still
applies at project-bound assembly.

Disablement also applies to management mutations. Authorized `GET` project,
DSN, issue, event, release, commit, release-file, chunk-capability, and
operation-status reads remain available, while a disabled project's project
settings `PUT`, DSN issue/rotation/revocation, issue status `PUT`, release
create/update/finalize, release-file upload/deletion, project-scoped chunk
upload, DIF or artifact assembly, and deployment creation return `403
permission_denied`
with detail `Permission denied.` and create no side effect. The compatibility
project `DELETE` remains available as the authorized lifecycle deletion flow;
internal retention and purge continue normally. A capability read may return
its normal metadata, but every project-bound upload or assembly request for a
disabled project still applies these write rules. Organization-scoped chunk
staging remains reusable organization state and is fenced at project-bound
assembly.

After bounded transport decoding, event parsing, and complete structural
validation, Ingest normalizes the event identity and performs the idempotency
lookup before applying the API-owned environment retirement tombstone and
generation fence. A matching acceptance record or payload-free uniqueness
tombstone returns the original acceptance, and the same event ID with a
different digest returns `409 conflict`, even when the environment has since
been retired. If no prior identity exists, the retirement fence is then
applied before persistence or durable acceptance. A new event whose
`environment` names an environment that is retired for the project returns
`409 conflict` with detail `The request conflicts with the current resource
state.` and persists no payload, acceptance record, attachment bytes, or
operation state. The adapter never silently drops the event, requires a
duplicate environment header, or automatically re-registers that name. Data
already accepted before retirement finishes normally; only an authorized
reactivation may advance the generation and admit the name again.

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
against that value. The upload is deliberately event-unbound: TUS creation
stores no event ID and the pinned creation metadata remains only
`attachment_type`. At binding, the adapter authorizes the collection DSN for
the same tenant and project, requires the `Location` to resolve to that
project-bound upload, and requires the Envelope/event ID to identify the
accepted event in that same tenant and project. It evaluates the existing
Envelope idempotency identity
`(tenant_id, project_id, external_event_id, payload_digest)` before rejecting
the upload state. An exact retry whose retained acceptance record already
bound the same upload and attachment digest to the same event returns the
original acceptance, even when the upload is now `bound`; it does not create a
second attachment or transition. The retained binding record includes the
upload ID, event ID, payload digest, attachment digest and length, and original
acceptance. A retry with the same event ID and a different digest remains the
documented `409 conflict`; an otherwise unmatched `bound` upload remains
inaccessible. Only a first acceptance requires `complete-unbound` with the
declared length, and it atomically transitions that state to `bound` while
retaining the uploaded bytes only as an attachment of that event. A completed
upload never becomes a standalone event or attachment. A positive-length
upload's pending lifetime is not extended by `PATCH`; once the declared length
is reached, the adapter starts a fixed 24-hour `complete-unbound` lifetime at
that completion time. A zero-length upload starts that same 24-hour lifetime
at creation. Expiration is the exclusive boundary `now >= expires_at`:
`HEAD`, `PATCH`, and a non-idempotent Envelope binding return `404 not_found`
at or after the boundary, even if physical garbage collection has not yet
run. An unreferenced completed upload therefore expires without durable
customer-payload acceptance.

The reference attachment payload is a closed JSON object with exactly these
two members:

```json
{
  "url": "https://example.invalid/api/project/upload/upload-id",
  "path": "event.minidump"
}
```

Both `url` and `path` are required strings; duplicate or unknown members are
invalid. `url` is an absolute HTTP(S) URL whose value must equal the TUS
creation response's `Location` header byte-for-byte. `path` is a non-empty
relative UTF-8 logical path beneath that upload, with no leading slash,
backslash, query, fragment, control character, empty segment, `.` segment, or
`..` segment. It is metadata for the bytes addressed by `url`, not an
independent URL and never a selector for another upload. A missing, malformed,
mismatched, or otherwise invalid reference object returns `400
invalid_envelope` before binding.

Browser-origin requests to the Envelope route require an exact match against
the project's configured browser-origin allowlist. A request without `Origin`
uses the ordinary non-browser contract. For an allowlisted origin, every
preflight and actual response, including safe errors, contains
`Access-Control-Allow-Origin` set to that exact origin and `Vary: Origin`; it
never uses `*` and never enables credentials. The preflight response also
contains `Access-Control-Allow-Methods: POST, OPTIONS`,
`Access-Control-Allow-Headers: Content-Type, Content-Encoding, X-Sentry-Auth,
Sentry-Trace, Baggage, X-Request-ID`, and `Access-Control-Max-Age: 600`. Actual responses
expose `Content-Encoding` when present, plus `X-Request-ID`,
`X-Watchtower-Request-ID`, `X-Sentry-Rate-Limits`, and `Retry-After` when
present. An origin absent from
the allowlist, or a project with no configured allowlist, receives
`403 permission_denied` before payload acceptance and no CORS allow headers.

### Management and release routes

| Route family | Methods and behavior |
| --- | --- |
| `/api/0/` | `GET` authentication/capability read required by sentry-cli; it returns the exact safe compatibility response defined in Capability negotiation. Mutations and unlisted methods are rejected. |
| `/api/0/organizations/` | `GET` organization reads for the authenticated management credential, limited to that credential's owning organization; pagination and current authorization apply. Organization creation, deletion, membership, team, SSO, and broad settings administration are not exposed through Sentry compatibility. |
| `/api/0/organizations/<organization>/` | `GET` organization read. Unknown or unauthorized organizations return indistinguishable `404`. |
| `/api/0/organizations/<organization>/projects/` | `GET` project list and `POST` project creation using the exact request body below. Creation returns the pending Operation DTO defined in Project mutation responses until all required owners and Jobs acknowledge enablement. |
| `/api/0/projects/<organization>/<project>/` | `GET` project read, `PUT` supported project settings including the browser-origin allowlist, and bodyless `DELETE` project deletion. Project settings and deletion require the current strong `If-Match` plus `X-Watchtower-Project-Generation`; deletion additionally requires a current Owner/Admin user session recently reauthenticated within five minutes under applicable organization SSO/MFA conditions, `X-Confirm-Project-Name` containing the exact current project name, idempotency, lifecycle fences, and never reports success before authoritative completion. |
| `/api/0/projects/<organization>/<project>/keys/` | `GET` DSN metadata/public DSNs and `POST` issuance using the exact closed body and `201` response below. Plaintext management tokens are never returned. |
| `/api/0/projects/<organization>/<project>/keys/<key_id>/` | `PUT` rotation with the empty JSON object `{}` and `200` DSN response, and bodyless `DELETE` revocation with `204`; both use the exact idempotency rules below and never return a secret. |
| `/api/0/projects/<organization>/<project>/issues/` | `GET` issue list with the exact bounded filters and cursor pagination defined below, and `PUT` only for the pinned bulk status operation with repeated bounded `id` query parameters and a `resolved`, `unresolved`, `ignored`, `muted`, or `resolvedInNextRelease` status body. The latter two map as defined for the unqualified issue route. `POST`, `DELETE`, and unbounded bulk operations are unsupported. |
| `/api/0/issues/<issue>/` | `GET` issue read and `PUT` status transitions with the exact request body defined below for `resolved`, `unresolved`, `ignored`, `muted`, and `resolvedInNextRelease`. `muted` maps to `ignored`; `resolvedInNextRelease` maps to `resolved` with `statusDetails.inNextRelease: true`. The issue alias is globally unique across tenants; the adapter resolves it before checking authorization for its owning tenant, and an inaccessible issue is indistinguishable from an unknown issue. Issue assignment, merge, split, delete, bookmark, alert, and comment operations are unsupported. |
| `/api/0/issues/<issue>/events/` | `GET` issue event list with bounded cursor pagination. The `<issue>` alias uses the same global resolution and owning-tenant authorization rule as the single-issue route. |
| `/api/0/projects/<organization>/<project>/events/` | `GET` project event list with bounded cursor pagination for the pinned CLI/query workflow. |
| `/api/0/projects/<organization>/<project>/events/<event>/` | `GET` event read subject to tenant, project, retention, and query authorization. The external event identifier is never a Watchtower primary key. |
| `/api/0/organizations/<organization>/releases/` | `GET` release list and `POST` release creation. Release reads/updates/finalization use the exact sentry-cli request fields and idempotency rules. |
| `/api/0/projects/<organization>/<project>/releases/` | `GET` release list scoped to a project, as used by sentry-cli. Release creation remains organization-scoped. |
| `/api/0/organizations/<organization>/releases/<version>/` | `GET` and `PUT` release metadata. Release deletion is unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/commits/` | `GET` a direct array of commit objects, each containing exactly `{ "id": string }`, required by `sentry-cli info`; the organization-scoped release visibility predicate applies before any commit ID is returned, and commit association writes are unsupported. |
| `/api/0/organizations/<organization>/releases/<version>/previous-with-commits/` | `GET` the fixed Release DTO below for the deterministic previous release selected by the project-filter rules below, or `404 not_found` when no previous release is available, subject to project and tenant scope. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/` | `GET` file listing and `POST` upload using the exact multipart protocol below. Source maps and debug files are handled by the artifact authority. |
| `/api/0/projects/<organization>/<project>/releases/<version>/files/<file_id>/` | `GET` the one release file identified by `file_id`, returning its Artifact DTO and current strong `ETag`; `DELETE` performs idempotent failed-upload cleanup using that exact observed ETag. Deletion never bypasses lifecycle rules. |
| `/api/0/organizations/<organization>/chunk-upload/` | `GET` organization-scoped artifact-bundle and DIF chunk capability for the pinned sentry-cli, available only with effective `Write` or `Manage` authority on at least one project in the organization. The response supplies the upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. The returned `url` is itself an admitted organization-scoped multipart `POST` route valid for both workflows; its request carries no project field and uses the same authority rule. |
| `/api/0/projects/<organization>/<project>/chunk-upload/` | `GET` project-scoped DIF chunk capability for the pinned sentry-cli. The response supplies a project-bound upload URL, chunk size, request limits, concurrency, hash algorithm, and accepted compression. |
| `/api/0/projects/<organization>/<project>/files/difs/chunks/` (or the exact project-bound upload URL returned by the DIF capability response) | `POST` multipart chunk upload using `file` or `file_gzip` parts keyed by SHA-1 checksum. A valid new or matching checksum returns `200` with an empty body and the standard request-ID headers; a matching checksum is idempotent, while conflicting bytes are `409`. |
| `/api/0/projects/<organization>/<project>/files/difs/assemble/` | `POST` DIF assembly with the pinned sentry-cli request map. The response reports each digest's `state`, `missingChunks`, bounded `detail`, and registered DIF when complete. Polling repeats this request with the same body and optional idempotency key. |
| `/api/0/organizations/<organization>/artifactbundle/assemble/` | `POST` source-map/artifact-bundle assembly with `checksum`, ordered `chunks`, `projects`, optional `version`, and optional `dist`; repeated identical POSTs poll the same assembly and return the exact per-project artifact-bundle response defined below. `202` remains pending until artifact processing completes. `checksum` is the lowercase SHA-1 of the ordered decompressed chunk bytes defined below. |
| `/api/0/operations/<operation_id>/` | `GET` Watchtower compatibility polling extension for project/lifecycle/artifact operations that return an operation ID and do not have an upstream polling request. The operation ID is canonical UUID v7, tenant-scoped, non-reusable, and returns the defined operation status DTO and state machine below. |
| `/api/0/organizations/<organization>/releases/<version>/deploys/` | `GET` and `POST` deployment records. The organization-scoped release visibility predicate applies before any Deployment DTO is returned; deployment records are release metadata and do not schedule deployment work. |
| Any other `/api/0/...` route | Any | An unknown path returns safe `404` with no persistence side effect; an unsupported method on a known supported path returns `405`; explicitly unsupported capabilities are listed below and return `501`. |

Both organization-scoped and project-scoped chunk upload URLs accept the
negotiated multipart request. A valid new or matching chunk upload returns
`200` with an empty body and the standard request-ID headers; conflicting
bytes return `409`.

The following commonly probed upstream-shaped routes are explicitly
unsupported and return `501 unsupported_capability` with no persistence side
effect: `POST /api/0/organizations/<organization>/releases/<version>/finalize/`
(the pinned CLI finalizes with `PUT` on the release resource) and
`GET /api/0/events/<event>/` (the project-scoped event route is required). Any
method addressed to one of these explicitly unsupported paths has the same
`501` result. Unknown paths return `404`, while an unsupported method on a
known supported path returns `405`.

Organization path slugs are globally unique compatibility aliases and are
resolved before tenant selection. Project path slugs are compatibility aliases
unique within their organization and are resolved only after the canonical
tenant is selected. Ordinary organization and project reads use these path
aliases and current authorization without supplying an expected resource
generation; project generation matching is a mutation precondition only for
the project settings and deletion requests that carry
`X-Watchtower-Project-Generation`. A project slug cannot select a resource in
another tenant. A deleted resource's slug may be reused only after deletion
completes and only by a new resource generation. A replacement receives a new
canonical UUID, generation, and credentials.

### Project mutation request bodies

Project mutation bodies are JSON objects with no unknown members or duplicate
keys. `POST /api/0/organizations/<organization>/projects/` accepts exactly:

```json
{
  "name": "project-name",
  "slug": "project-slug",
  "platform": "javascript"
}
```

`name` and `slug` are required. `name` is a non-empty printable ASCII string
of 1 through 256 bytes, with every byte in `0x20` through `0x7e`, so the exact
value can be carried by `X-Confirm-Project-Name`. `slug` is a canonical
lowercase ASCII compatibility alias
matching `[a-z0-9][a-z0-9._-]{0,255}`. The adapter does not derive, rewrite,
or suffix a slug. A slug already used by another project in the organization,
including a project whose deletion has not completed, returns `409 conflict`
without creating an operation; concurrent claims are resolved by the same
atomic uniqueness rule. After deletion completes, a new project may reuse the
slug only with a new canonical UUID, generation, and credentials. `platform`
is optional and nullable; omission and explicit `null` mean that no platform
is configured. When present it uses the lowercase ASCII platform-token grammar
defined in Scalar and recursive field limits.
`browser_origins` is not accepted during creation and is initialized to an
empty array. A missing or empty name, an invalid platform, a duplicate key, or
an invalid slug, or any other member returns `400 invalid_request` before
mutation. The required `Idempotency-Key` and normalized canonical body digest
make a retry with the same principal, organization, operation, key, and body
return the original pending or terminal Operation DTO before a new slug claim;
changing the body or scope returns `409 conflict`.

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

`DELETE /api/0/projects/<organization>/<project>/` has a bodyless request
shape: the entity body must be zero bytes. A present body, including `{}`, is
`400 invalid_request` before idempotency lookup or mutation. Deletion requires
the current strong `If-Match`, the exact `X-Confirm-Project-Name` value, and a
required `Idempotency-Key`.

### Browser-origin project setting

API owns the project setting `browser_origins`. A project `PUT` may replace it
with a JSON array of unique serialized origins using the existing `Manage`
authority, observed resource version, and idempotency rules. Each value has an
`http` or `https` scheme, an ASCII host, and an optional port, with no path,
query, fragment, wildcard, or credentials. Canonicalization uses the WHATWG
URL Standard origin serializer for HTTP(S): the scheme and host are lowercase,
default ports (`80` for `http`, `443` for `https`) are omitted, non-default
ports are retained in decimal form, and the serialized origin contains no
trailing slash. IPv6 hosts use the serializer's bracketed canonical form. The
stored form uses this canonical serialization; if two input values serialize to
the same origin, the request returns `400 invalid_request` rather than silently
deduplicating them. The empty array disables browser-origin admission.

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

### Project mutation responses

Project mutation responses are deterministic. Every JSON response has
`Content-Type: application/json`, `X-Request-ID`, and
`X-Watchtower-Request-ID`. A pending response is `202` with the exact pending
Operation DTO, `Location` equal to its `status_url`, and `Retry-After: 5`; a
terminal operation response is `200` with the exact succeeded Operation DTO
and no `Retry-After`. The operation result for a successful non-destructive
mutation is the complete Project DTO; the result for deletion is `null`.

| Mutation | Initial request | Pending poll or duplicate | Terminal or completed duplicate |
| --- | --- | --- | --- |
| Project creation | `POST` returns `202` pending Operation DTO and requires `Idempotency-Key`. | The same key and canonical body return the same pending operation with `202`; changed body within the same principal/organization/operation tuple returns `409 conflict`, while another scope is independent. | The operation URL returns `200` with `status: "succeeded"` and the Project DTO in `result`; repeating the same key returns that same terminal Operation DTO with `200`. |
| Browser-origin update | When the generation-matched Ingest acknowledgement is already available, `PUT` returns `200` with the Project DTO, the new strong `ETag`, and no `Location` or `Retry-After`; otherwise it returns `202` with a pending Operation DTO. | A retry with the same project, observed `If-Match`, normalized body, and supplied key, if any, returns the same current `200` or `202` result before the current-version check; otherwise a stale `If-Match` returns `409 conflict`. | A pending update polls to `200` with a succeeded Operation DTO whose `result` is the updated Project DTO; a completed duplicate returns the same terminal result. |
| Project deletion | A bodyless authorized request with the required confirmation, observed `If-Match`, and `Idempotency-Key` returns `202` pending Operation DTO; it never returns a Project DTO. | The same target and key return the same pending operation with `202`; changed content within the same principal/project/operation tuple returns `409 conflict`, while another scope is independent. | The operation URL and a terminal retry return `200` with a succeeded Operation DTO and `result: null`; no deleted Project DTO is exposed. |

Direct Project DTO responses include the resource `ETag` and the
`X-Watchtower-Project-Generation` response header. Operation DTO responses do
not claim resource completion until their `status` is terminal. All duplicate
lookups occur within the existing principal, scope, operation, key,
observed-version, and canonical-body identity rules. A project generation is a
non-reusable canonical lowercase UUID v7 assigned when the project is created;
settings updates retain it, while a replacement after deletion receives a new
one.

### Suspended organization behavior

The control-plane suspension fence is evaluated before every compatibility
route. While an organization is suspended, collection, ordinary organization
and project reads, issue/event reads, DSN reads or mutations, release and
artifact operations, deployment records, and ordinary project changes are
blocked; no full Organization or Project DTO, including `browser_origins`, is
returned. For `GET /api/0/organizations/`, the fence is applied per authorized
organization before the existing snapshot ordering and pagination: suspended
organizations are omitted, they never make the whole list fail, and an empty
visible set returns the normal empty direct array. No suspended organization
DTO, status, or suspension metadata is exposed by this list route. On a project route, a current Owner/Admin user session that passes
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
current strong `ETag` and `X-Watchtower-Project-Generation` headers. The caller
copies that exact name into `X-Confirm-Project-Name`, that exact ETag into
`If-Match`, and that exact generation into `X-Watchtower-Project-Generation`;
the deletion request returns only the pending deletion operation and never a
resource DTO.
Organization deletion, suspension removal, token issuance, and all other
changes remain unavailable.

The pending deletion operation is held at `awaiting_support_release` while the
organization remains suspended. No destructive lifecycle command or purge may
start until Support releases that exact customer-authorized project scope
through the restricted internal support flow. At release, API rechecks the
requester's current Owner/Admin role, five-minute authentication freshness and
policy, exact project target, expected resource version, confirmations,
idempotency binding, and pending request state. A stale or changed check keeps
the operation pending and requires the customer to reauthenticate and
reconfirm the same request; Support cannot widen the scope or originate a
deletion.

The same bodyless `DELETE` with the same project target, `If-Match`,
`X-Watchtower-Project-Generation`, `X-Confirm-Project-Name`, and
`Idempotency-Key` is the customer reconfirmation action for that pending
operation. After Support releases the scope, a current Owner/Admin session
recently reauthenticated within five minutes may repeat that exact request;
API atomically replaces the pending operation's stored authentication proof and
confirmation timestamp and returns the same `202` pending Operation DTO. This
refresh never changes the project, observed version, generation, confirmation,
or idempotency identity and never creates a second operation. A missing, stale,
or mismatched proof leaves the operation unchanged and returns its normal
authentication or precondition error; a changed target or key remains a
`409 conflict`.

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
- Personal and service management tokens belong to exactly one organization.
  `GET /api/0/organizations/` returns only that credential's owning
  organization when it is currently readable, or the normal empty/suspended
  result; it never enumerates another organization. The compatibility adapter
  does not add a general user-session flow for multi-organization listing.
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
- A project detail response includes one `X-Watchtower-Project-Generation`
  header containing the project's non-reusable canonical lowercase UUID v7
  generation. Project settings `PUT` and `DELETE` requests require that exact
  single header in addition to `If-Match`; a missing, malformed, or duplicate
  header returns `400 invalid_request`, and a generation that does not match
  the slug-resolved project returns `409 conflict` before mutation. The only
  earlier lookup is a retry whose stored canonical project generation matches;
  otherwise both the slug and generation must match the same project before
  idempotency is evaluated.
- Project deletion additionally requires one `X-Confirm-Project-Name` header.
  Its value is the exact current project display name, which therefore uses the
  printable ASCII project-name grammar above, compared case-sensitively without
  trimming or alias normalization; a missing or mismatched value returns
  `400 invalid_request` before idempotency lookup or mutation.

The adapter forwards neither credential material nor unrestricted customer
payloads into internal messages.

| Operation | Required request fields | Successful response fields |
| --- | --- | --- |
| Envelope/event admission | Project DSN, project alias, Envelope headers, item headers/payloads, and a supported event ID for event items | A non-conflicting Envelope `POST` returns `200` with an empty body and request ID headers; digest/idempotency conflicts return `409`; legacy or client-specific body expectations retain the preserved scoped external event ID |
| Organization/project read | Organization/project compatibility alias and current management credential | Upstream-compatible resource DTO containing only currently readable fields, canonical-safe pagination link, and request ID |
| Project create/update/delete | Organization scope, the exact project mutation body defined below, current authorization, observed version and `X-Watchtower-Project-Generation` for settings update and delete, a bodyless delete, `X-Confirm-Project-Name` for delete, and idempotency key for create/delete | Exact `200` Project DTO or `202`/`200` Operation DTO responses defined in Project mutation responses; direct Project DTOs include the strong `ETag` and project-generation header |
| DSN issue/rotate/revoke | Project scope, the exact closed issuance body, `{}` rotation body, or bodyless revocation shape below, current Manage authority, and a required idempotency key | `201` issuance or `200` rotation returns the fixed DSN DTO; `204` revocation has an empty body; management-token plaintext is never returned |
| Issue/event read or status transition | Globally unique issue alias resolved before owning-tenant authorization, or tenant/project-scoped event alias, bounded filters or status, and current credential | The fixed Issue or Event DTO below, request ID, and cursor link when paginated |
| Release mutation | Organization/project scope, release version, bounded metadata, and canonical request identity; an `Idempotency-Key` may additionally bind the request | `201` for a new release or `200` for duplicate/update/finalization, with the direct Release DTO and request-ID headers; no operation state |
| Release artifact upload | Project/release version scope, logical filename, optional distribution, bounded bytes, artifact type, and management credential | Artifact/file/checksum identity, upload or assembly operation ID, and `202` pending state when asynchronous |
| DIF chunk/assembly upload | Organization or project capability scope for chunks, project scope for assembly, a checksum-keyed request map of one to 256 entries whose lowercase full-file SHA-1 keys each map to `name`, optional `debug_id`, and ordered chunks, bounded bytes, and management credential | DIF checksum/debug identities and native repeat-POST `202` pending state when asynchronous; no assembly operation ID or status URL is returned |
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
| Release | `shortVersion` | Nullable string; always `null` in v1, with no derivation from `version` |
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
| Release | `projects` | Required array of objects containing exactly string `id`, `slug`, and `name`, sorted by NFC-normalized ordinal `(id, slug, name)` ascending |
| Release | `environments` | Required array of unique strings, sorted by NFC-normalized ordinal Unicode-scalar order ascending |
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
| DIF | `debugId` | Nullable lowercase UUID string; `null` when no upstream `debug_id` is supplied |
| DIF | `uuid` | Nullable lowercase UUID string; `null` when no upstream `uuid` is supplied; at least one of `debugId` or `uuid` is non-null |
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
| Deployment | `dateCreated` | Required RFC 3339 UTC string; equal to the deployment request `timestamp` and `dateFinished` |
| Deployment | `release` | Required object containing exactly the non-empty release version string `version` |

### DSN mutation request and response bodies

DSN mutations require `Idempotency-Key` and the current `Manage` authority.
Their full idempotency tuple is `(principal_id, canonical_project_uuid,
operation_discriminator, idempotency_key)`, where the discriminator is one of
`dsn.issue`, `dsn.rotate`, or `dsn.revoke`; the key is never looked up globally
across projects or operation discriminators. The request digest is the RFC 8785
canonical-JSON digest of the body shape below, excluding the HTTP key.

`POST /api/0/projects/<organization>/<project>/keys/` accepts exactly:

```json
{
  "name": "mobile-production",
  "platform": "javascript"
}
```

`name` is required, non-null, and a bounded non-empty string under the scalar
limits below. `platform` is optional and nullable; omission and explicit `null`
both mean that no platform is configured. When non-null it uses the platform
token grammar below. Duplicate or unknown
members, an empty body, a null name, or any other type returns
`400 invalid_request` before mutation. A new key returns `201` with the fixed
DSN DTO and the request-ID headers.

`PUT /api/0/projects/<organization>/<project>/keys/<key_id>/` accepts an empty
JSON object `{}` and no other members. It returns `200` with the fixed DSN DTO
containing the newly durable public DSN. `DELETE` on the same route is
bodyless: a present body, including `{}`, is invalid. Successful revocation
returns `204` with an empty body and no `Content-Type`. Repeating the same
operation with the same principal, canonical project scope, operation
discriminator, key, and body returns the original successful result. Reusing
that key with different content within that same tuple returns `409 conflict`;
the same key on another project or operation is an independent idempotency
identity and is evaluated against that scope's body.

### Release mutation request bodies

Release mutation bodies are JSON objects with no unknown members or duplicate
keys. The canonical request identity is the RFC 8785 canonical-JSON digest of
the normalized body shown below; omitted optional members remain omitted, while
an explicit `null` is retained and means clear the corresponding nullable
metadata. The `Idempotency-Key`, when supplied, binds to this digest but is not
included in it. Only the single-release detail response (`GET
/api/0/organizations/<organization>/releases/<version>/`) includes the strong
resource `ETag`; organization- and project-scoped release list
responses omit `ETag`, and a collection response ETag is never accepted as the
observed version for `If-Match`.
Release metadata and finalization `PUT` requests require that exact observed
ETag in `If-Match`; creation has no prior version and does not require it.

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

When `projects` is non-empty, the adapter resolves every alias within the
authenticated organization and requires `Write` or `Manage` authority on
every resolved project before creating or associating the release. An unknown,
cross-organization, inaccessible, or unauthorized project returns the same
indistinguishable `404 not_found` result; no release, association, or
idempotency operation is partially created. Existing release metadata and
finalization mutations recheck the same authority for every project already
attached to the release. When `projects` is omitted or an empty array, the
release has no project association and requires the authenticated principal to
hold the organization-level `Owner` or `Admin` role. A project-scoped
credential cannot use omission to broaden its release scope.

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
bodies; a missing, malformed, or stale `If-Match` returns the standard `400`
or `409` response before mutation. Successful retries use the observed
generation carried by that ETag and the existing release idempotency rules.

Release mutations are synchronous and return the direct Release DTO, never an
Operation DTO. A new `POST` release returns `201` with the Release DTO,
`Content-Type: application/json`, `X-Request-ID`,
`X-Watchtower-Request-ID`, a strong `ETag`, and a `Location` header naming the canonical
release resource. An idempotent duplicate or lost-response retry of that
`POST` returns `200` with the same Release DTO, request-ID headers, and strong
`ETag`, but no `Location` header. A successful metadata `PUT` or finalization
`PUT`, whether initial or repeated, returns `200` with the Release DTO, the
new strong `ETag`, and the two request-ID headers. These successful responses
have no `Retry-After` and no operation status; `202` is never used for release
create, update, or finalization. A retry is looked up by its original
`(target_scope, observed_generation, canonical_request_body_digest)` before
the current-version check: an already-completed identical request returns its
original result, while a request not previously committed with a stale
generation returns `409` and cannot overwrite a later mutation. Conflicting
content, stale lifecycle state, or unavailable owners use the standard error
statuses and bodies without creating a second release result.

DSN responses never contain `secret`, `clientSecret`, management-token
plaintext, or any other credential field, including as a nullable field. A
successful DSN rotation returns the same fixed DSN DTO with the new public DSN.
Artifact and DIF response objects contain identity and processing state only;
they never inline artifact, chunk, minidump, or source-map bytes.

The optional `dif` member in a DIF assembly result uses the pinned sentry-cli
`DebugInfoFile` shape rather than the internal DIF summary above. It contains
the always-present nullable `debugId` and `uuid` identity members, with at
least one non-null, plus `objectName`, `cpuName`, lowercase 40-character
`sha1`, and the required bounded `data` object with nullable `type` and a
string-array `features` field. An absent upstream identity member is emitted
as `null`, never omitted. No snake-case aliases or internal storage fields are
emitted. The standalone DIF DTO uses the same identity presence and
nullability rule.

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
| Issue | `level` | Required enum: `sample`, `debug`, `info`, `warning`, `error`, `fatal`, or `unknown` |
| Issue | `status` | Required enum: `resolved`, `ignored`, `pending_deletion`, `pending_merge`, `reprocessing`, or `unresolved` |
| Issue | `statusDetails` | Required object whose exact member types, nullability, and presence conditions are defined immediately below; non-applicable members are omitted |
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
| Event | `title` | Required string derived from the normalized event by the deterministic rule below |
| Event | `culprit` | Nullable string |
| Event | `dateCreated` | Required RFC 3339 UTC string derived from the accepted event `timestamp`; when `timestamp` is omitted, this equals `dateReceived` |
| Event | `dateReceived` | Required RFC 3339 UTC string derived from the canonical `accepted_at` instant; this field is authoritative for event-list ordering |
| Event | `platform` | Nullable string |
| Event | `level` | Nullable enum: `fatal`, `error`, `warning`, `info`, or `debug`; emitted as `null` when the normalized event omitted `level` |
| Event | `tags` | Required array of objects containing required string fields `key` and `value`, plus optional string `query`; one object is emitted per normalized tag in RFC 8785 canonical key order, `key` and `value` use the normalized tag member, `query` is always omitted because normalized tags have no query metadata, and the array is empty when no tags are present |
| Event | `contexts` | Required bounded JSON object; values are JSON scalars, arrays, or objects subject to the event limits above |
| Event | `user` | Nullable object containing only the safe readable string fields `id`, `username`, and `name` |
| Event | `sdk` | Nullable object containing exactly nullable string fields `name` and `version` |
| Event | `release` | Nullable string |
| Event | `dist` | Nullable string |
| Event | `entries` | Required array of objects containing exactly string `type` and bounded JSON `data` |
| Event | `metadata` | Required object containing exactly nullable string fields `type`, `value`, `filename`, and `function` |

`Event.title` is a derived DTO field, not an accepted event input and not an
additional member of `normalized_event_object` or `payload_digest`. The adapter
takes the first non-empty NFC-normalized string candidate in this order:
top-level `message`; each `exception.values` element in array order, checking
`value` then `type`; each `stacktrace.frames` element in array order, checking
`function` then `filename`; and `metadata.value`, `metadata.type`,
`metadata.filename`, then `metadata.function`. Missing, non-string, and empty
candidates are skipped. If no candidate remains, `title` is the empty string.

For an accepted event item, `dateReceived` is the canonical `accepted_at`
instant recorded by Ingest, not the client-supplied event time. When present,
the event `timestamp` is a finite JSON number of Unix seconds in the inclusive
range `0` through `253402300799.999999999` (from 1970-01-01T00:00:00Z through
9999-12-31T23:59:59.999999999Z) with no more than nine fractional decimal
digits. The adapter converts it to `dateCreated` using the canonical UTC
representation `YYYY-MM-DDTHH:mm:ss.sssssssssZ`; a missing `timestamp` uses
the same `accepted_at` instant for `dateCreated`. A non-finite, negative,
out-of-range, or sub-nanosecond timestamp rejects the Envelope with `400
invalid_envelope`. Event lists order by `dateReceived DESC`, then external
event ID, regardless of `dateCreated`.

`Issue.statusDetails` is a closed object. A valid ignore contributes the
non-negative integer `ignoreCount`, RFC 3339 UTC `ignoreUntil`, non-negative
integer `ignoreUserCount`, non-negative integer `ignoreUserWindow`, and
non-negative integer `ignoreWindow`; these five members are present only for a
valid ignore condition. An applicable ignore or release/commit resolution may
also contribute nullable `actor`, whose non-null value is exactly the Actor
shape `{type: "user" | "team", id: string, name: string, email?: string}`.
`inNextRelease` is the boolean `true` only for a resolved-in-next-release
issue; `inRelease` is a non-empty release-version string only for a
resolved-in-release issue; and `inCommit` is a non-empty commit identifier
string only for a commit resolution. A reprocessing issue contributes the
non-negative integer `pendingEvents` and nullable `info`; when non-null,
`info` is exactly `{dateCreated: RFC-3339-UTC string, syncCount: non-negative
integer, totalEvents: non-negative integer}`. All other members are omitted,
and no member is emitted as `null` except `actor` and `info` under those
applicable conditions.

Event `entries` are serialized from the normalized event in this fixed order;
each entry type appears at most once and absent source data produces no entry:

| Entry type | Emission condition | Exact `data` object |
| --- | --- | --- |
| `message` | `message` is present and non-empty | `{ "formatted": <normalized message> }` |
| `exception` | `exception.values` is a non-empty array | `{ "values": <normalized exception.values> }` |
| `stacktrace` | `stacktrace.frames` is a non-empty array | `{ "frames": <normalized stacktrace.frames> }` |
| `breadcrumbs` | `breadcrumbs` is a non-empty array | `{ "values": <normalized breadcrumbs> }` |

The four entry data objects contain no other members. Nested values use the
recursive bounded-value normalization rules, object keys use RFC 8785 order,
and array order is preserved. Event fields represented by dedicated DTO
members, including `platform`, `level`, `tags`, `contexts`, `user`, `sdk`,
`release`, and `dist`, do not create entries. An event admitted solely because
its level is `error` or `fatal` therefore has an empty `entries` array.

The project issue-list route accepts only these query parameters. Each scalar
parameter may occur once except `environment`, which may occur one to 100
times. Unknown parameters, empty values, malformed percent-encoding, and
values over the applicable 256-byte filter limit return `400 invalid_request`
before lookup. More than 100 unique `environment` values returns `413
payload_too_large` before lookup. `cursor` is the opaque cursor from `Link`;
`limit` is one decimal integer from `1` through `100`, defaulting to `100`.

| Parameter | Grammar and semantics |
| --- | --- |
| `query` | One non-empty UTF-8 literal, with no query-language operators; Unicode-default-case-folded substring matching is applied to the issue `title` and `culprit` projections. |
| `status` | One of `resolved`, `unresolved`, or `ignored`; it filters the current issue status. |
| `environment` | One to 100 unique non-empty environment strings; repeated values are ORed, while different parameter names are ANDed. |
| `cursor` | One opaque, URL-safe cursor returned by the contract's `Link` header; it cannot be combined with a different route scope or filter set. |
| `limit` | One decimal page size from `1` through `100`; it is not part of the filter predicate but is bound into the cursor. |

Issue results always use `lastSeen DESC` then issue `id ASC`; `sort` and every
other query parameter are unsupported. `query`, `status`, and
`environment` may be combined, and the complete normalized parameter set is
bound into pagination. The bulk `PUT` route's separate repeated `id` and
`current_status` parameters are not accepted by `GET`.

For `query` matching, the adapter computes
`match_key(value) = NFC(DefaultCaseFold(NFC(value)))` using the Unicode 15.1
full default case-folding table, independently of locale or database
collation. It tests whether the folded query is a contiguous Unicode scalar
sequence in the folded issue `title` or `culprit`; null fields do not match.
The `message` field on an individual Event DTO is not an issue-level query
projection and never participates in issue-list matching. Full folds may
expand characters, so `ß` and `ss` match one another after folding.
Locale-specific mappings are not applied: `I` folds to `i`, `İ` folds to `i`
followed by a combining dot, and dotless `ı` remains distinct.

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
target before changing any issue. After resolving each target alias, the
adapter requires its canonical project identity to equal the project resolved
from the route. A missing, inaccessible, or route-project-mismatched target
returns `404 not_found`; a `current_status` mismatch returns `409 conflict`;
and an owner or dependency outage returns `503 unavailable`; each result
produces no partial update. A successful one- to 100-ID request returns `200`
with the direct array of updated Issue DTOs in the submitted ID order.

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
contains exactly the standard `code`, `detail`, and `request_id` members; it
never contains field errors, owner diagnostics, secrets, or payload data.

The status URL returns `202` for `pending` with `Retry-After: 5`, and `200` for
`succeeded` and `failed`. A terminal operation result is retained for exactly
24 hours after its `completed_at` instant. Define `expires_at` as
`completed_at + 24h`: a status read returns the terminal Operation DTO while
`now < expires_at`, and an expired retained tombstone returns `410` with the
top-level compatibility-error object `{ "code": "operation_expired", "detail":
"The operation result has expired.", "request_id": "<request-id>" }` when
`now >= expires_at`. The same cutoff applies to a completed duplicate lookup;
pending operations are not expired by this terminal-result rule. The `410`
does not return an Operation DTO with `status: "expired"`. This `410` is the
explicit operation-status exception to the rule that successful operation
reads use the Operation DTO. Unknown or inaccessible operation IDs return
indistinguishable `404 not_found`; an unavailable owner returns `503
unavailable` without reporting a terminal state. A `202` creation response
uses the same `pending` body and never claims lifecycle or artifact completion.

Responses never expose internal component names, database identifiers, raw
storage references, secrets, or unrestricted payloads. A `202` response includes
the operation status DTO with `status=pending` and a status URL when the pinned
client requires polling; it never claims processing completion.

### Compatibility error bodies and mapping

Every direct management or ingestion error other than the documented suspension
response uses this exact JSON object. The sole bodyless error exception is a
failed TUS `HEAD`: its HTTP status and headers are authoritative, with
`Content-Length: 0`, `Tus-Resumable: 1.0.0`, and request-ID headers, and it has
neither `Content-Type` nor a JSON error body.

```json
{
  "code": "invalid_request",
  "detail": "The request is invalid.",
  "request_id": "canonical-lowercase-uuid-v7"
}
```

`code`, `detail`, and `request_id` are required and non-null. For a direct
compatibility error response, `request_id` is a canonical lowercase UUID v7
equal to the `X-Watchtower-Request-ID` response header. `field_errors` is never
emitted, including when one or more known
fields are invalid; adapters do not select, order, or expose field-specific
reasons in compatibility error bodies. No other members are allowed. The same
object shape, including `request_id`, is used for the nested operation `error`
value. A nested `Operation.error` is retained as part of the operation result
rather than returned as a direct compatibility error: its `request_id` is the
immutable ID assigned when the terminal failure occurred, not the ID of a later
status poll. The suspension response above remains the only route-specific
extension and retains only its documented bounded members.

The `internal_error` body is the same shape with the fixed `code` and `detail`
values `internal_error` and `Internal server error.`, respectively, and never
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
| `payload_too_large` | 413 | A byte, decoded-payload, or explicit cardinality limit was exceeded |
| `rate_limited` | 429 | A principal, organization, project, collection, or artifact quota was exhausted |
| `unavailable` | 503 | Authorization, quota, owner, lifecycle, or processing dependency cannot be evaluated safely |
| `deadline_exceeded` | 504 | A bounded synchronous operation exceeded its deadline without being reported complete |

The `detail` member is also closed by code so fixtures can compare complete
error bodies. Unless a route explicitly documents the suspension response
exception above, the canonical details are:

| Code | Exact `detail` |
| --- | --- |
| `invalid_authentication` | `Authentication is required.` |
| `permission_denied` | `Permission denied.` |
| `not_found` | `The requested resource was not found.` |
| `method_not_allowed` | `The requested method is not allowed.` |
| `invalid_request` | `The request is invalid.` |
| `operation_expired` | `The operation result has expired.` |
| `precondition_failed` | `The request precondition failed.` |
| `unsupported_media_type` | `The media type is not supported.` |
| `invalid_compression` | `The request compression is invalid.` |
| `invalid_multipart` | `The multipart request is invalid.` |
| `invalid_envelope` | `The Envelope is invalid.` |
| `internal_error` | `Internal server error.` |
| `unsupported_capability` | `The requested capability is not supported.` |
| `conflict` | `The request conflicts with the current resource state.` |
| `payload_too_large` | `The request payload is too large.` |
| `rate_limited` | `Rate limit exceeded.` |
| `unavailable` | `The service is temporarily unavailable.` |
| `deadline_exceeded` | `The request deadline was exceeded.` |

Runtime boundary codes `unknown`, `internal`, and `data_loss` map to the
deterministic `500 internal_error` response. Its pinned-client error shape
contains only the stable code, the fixed message `Internal server error.`, the
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
| Minidump | `multipart/form-data` with a boundary | identity and gzip |
| Release/file/chunk upload | `multipart/form-data` or the exact sentry-cli JSON/multipart form for that operation | identity and gzip |
| Native TUS upload | `application/offset+octet-stream` for `PATCH`; the exact TUS creation headers for `POST` | identity only |
| Management API with a JSON entity body | `application/json` | identity and gzip |
| Bodyless management API | an absent `Content-Type` or `application/json` | identity or absent `Content-Encoding` |

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
append. A bodyless management read, probe, or poll accepts only an absent
`Content-Encoding` or `Content-Encoding: identity`; `Content-Encoding: gzip`
returns `415 unsupported_media_type` before request handling. It never creates
an entity by compressing an empty body and may omit `Content-Type`. Every
non-empty management response, including
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
required `sentry` JSON metadata part containing the scoped external event ID
and any supplied release, distribution, and platform context. The annotation allowlist is fixture-
specific and does not accept arbitrary scalar keys; annotations are metadata,
not event or attachment parts. A body-only raw-minidump request is not
admitted; `application/octet-stream` is rejected as an unsupported media type.
Unlisted multipart file parts are rejected before acceptance. The legacy `store` body is JSON and must contain
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
    "release": optional_bounded_string_if_present,
    "dist": optional_bounded_string_if_present,
    "platform": optional_bounded_string_if_present
  }
}
```

The `sentry` member is required for an accepted minidump. Its `event_id` is a
required non-null string and must match the external Event DTO identifier.
`release`, `dist`, and `platform` are independently optional: each is omitted
when absent and, when present, is a bounded non-null string. Explicit `null`
for any of those three members is invalid, so omission is the only absent-field
representation in the digest preimage. The member contains no request ID, DSN,
or transport metadata. Annotation keys and object keys use RFC 8785 ordering, and
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
| Client-report discarded-event records | 1,024 records |
| Browser origins per project | 100 origins |
| Serialized browser origin | 2,048 ASCII bytes |
| Management response page | 100 records |
| Management request filter values | 256 bytes each |
| Repeated issue-list `environment` values | 100 values |
| Repeated `previous-with-commits` `project` values | 100 values |
| Issue-list or `previous-with-commits` request target | 16,384 bytes |

### Scalar and recursive field limits

Unless a route or grammar above defines a narrower limit, scalar text limits
are measured in UTF-8 bytes after decoding and, for normalized values, after
NFC normalization. General non-empty strings, compatibility aliases and
slugs, project and DSN names, release versions/ref/dist values, artifact and
DIF logical names, deployment environment/name values, metadata keys and
metadata values, and safe event string values are at most 256 bytes. A value
that is explicitly nullable may be `null`; a value described as non-empty may
not be empty. `message`, exception values, and stacktrace text are at most
4,096 UTF-8 bytes. Safe diagnostics, discard reasons, categories, and
processing details are at most 1,024 UTF-8 bytes.

`platform` is nullable and, when present, is an arbitrary lowercase ASCII
token matching `[a-z0-9][a-z0-9._-]{0,63}`; it is not a closed enum so a new
official platform can be admitted without changing this grammar. Event
`level` is an enum of `fatal`, `error`, `warning`, `info`, or `debug`. Absolute
HTTP(S) URLs are at most 2,048 ASCII bytes. UUIDs, event IDs, checksums,
timestamps, and other fields with an exact grammar use that grammar in
addition to these length limits.

Recursive event objects have at most 16 nesting levels, 256 members per
object, and 1,024 elements per array. Object keys are at most 128 UTF-8
bytes. Recursive strings use the general 256-byte limit unless they are
message, exception-value, or stacktrace text. These structural limits are
checked before canonicalization and digest calculation.

The smaller applicable limit wins. A request that exceeds a byte, decoded-
payload, multipart-count, or explicit assembly-cardinality limit returns `413`
with a safe code and request ID; it is not partially accepted. A scalar field
that exceeds its own bounded length, such as an issue filter or browser origin,
returns `400 invalid_request` with the exact generic error object defined
above, never field-specific details or `field_errors`. Existing organization,
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

The raw request target for the issue-list and `previous-with-commits` routes is
limited to 16,384 bytes and is checked before query parsing or lookup. An
over-limit request returns `413 payload_too_large`. Repeated filter values are
also checked against their 100-value limits before predicate construction; the
same result applies when either repeated filter exceeds its limit.

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
present. `content_type`, `filename`, `attachment_type`, `attachment_length`,
and `content_encoding` (`identity` or `gzip`) are recognized only for the item
types that define them. `item_count` and `item_headers` are not recognized by
any v1 item type and are ignored as unknown fields for every supported,
excluded, or future item. Their values are not type-checked, persisted,
returned, used for authorization, or included in the payload digest. Duplicate
object member names remain invalid under the general JSON framing rule. An
`event` payload may contain the pinned
client's `event_id`, `timestamp`, `platform`, `level`, `message`, `exception`,
`stacktrace`, `release`, `dist`, `environment`, `tags`, `contexts`,
`breadcrumbs`, `sdk`, `user`, `debug_meta`, and bounded event metadata. The
event item's `event_id` is required for a supported event.

The recognized envelope-header schemas are extensible at the top level.
Unknown top-level members are ignored and are not type-checked, persisted,
returned, used for authorization, or included in the payload digest. `event_id`,
when present, is a non-null 32-character ASCII hexadecimal string using the
event-ID grammar above and is normalized to lowercase. `dsn`, when present, is
a non-null absolute HTTP(S) DSN URL using the DSN URL grammar above; its public
key and project alias must match the authenticated collection DSN and route
project. `sent_at`, when present, is a non-null RFC 3339 UTC instant and is
normalized to the canonical nine-fraction-digit UTC representation. `sdk` is
either `null` or an object containing exactly nullable bounded NFC-normalized
string members `name` and `version`; unknown members inside this object are
rejected and omitted members serialize as `null`. `trace` is either `null` or
an object containing required `trace_id` and `public_key` strings plus optional
nullable `sampled` boolean and `transaction` string members. `trace_id` uses the
32-character hexadecimal trace-ID grammar and is normalized to lowercase;
`public_key` is a bounded non-empty string and `transaction` is a bounded
NFC-normalized string when non-null. Unknown members inside `trace`, duplicate
members anywhere, null values where a non-null value is required, wrong shapes,
malformed timestamps or IDs, invalid DSNs, and DSN/project mismatches return
`400 invalid_envelope` before acceptance. These transport headers are bounded
metadata and remain outside the payload digest.

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
`client_report` has this JSON payload shape:

```json
{
  "discarded_events": [
    {
      "reason": "network_error",
      "category": "error",
      "quantity": 1
    }
  ]
}
```

`discarded_events` is required and contains one through 1,024 records in each
`client_report` item. Across all `client_report` items in one Envelope, the
aggregate record count must also be at most 1,024. Each record requires
`reason` and `category` as non-empty lowercase ASCII tokens matching
`[a-z0-9][a-z0-9._-]{0,63}`, plus `quantity` as an integer from `1` through
`2,147,483,647`. Unknown non-structural members follow the unknown-field rule
below and are not included in the digest. Missing required members, wrong
types, empty arrays or tokens, invalid token grammar, quantities outside the
range, an item record count over 1,024, or an Envelope aggregate over 1,024
rejects the entire Envelope with `400 invalid_envelope` before acceptance.
Duplicate records are retained and sorted by canonical JSON for digest
construction; they are not merged.

An `event` item qualifies as a supported error event only when it has a valid
external `event_id` and at least one error signal: a non-empty `message`, an
`exception` object with a non-empty `values` array, a `stacktrace` object with
a non-empty `frames` array, or `level` equal to `error` or `fatal`. A present
`level` must use the enum above. The message, exception, and stacktrace forms
must otherwise satisfy the declared JSON shapes and recursive limits. A valid
event item with an ID but none of these signals is individually excluded with
reason `not_error_event`; it does not create an event or attachment, while a
malformed supported field still rejects the entire Envelope.

| Item type | v1 behavior |
| --- | --- |
| `event` | Supported when it meets the error-event predicate above. One event item is allowed. |
| `attachment` | Supported when associated with a supported error or native crash. A structurally valid unassociated attachment is individually excluded with reason `unassociated_attachment`; its bytes are not retained. |
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
unsupported non-error items, including an unassociated attachment. An
unsupported-only or attachment-only Envelope is durably accepted only as a
bounded no-op when its framing is valid; it records bounded acceptance and
handoff metadata, persists no payload bytes, and returns `200` with an empty
response body. An empty Envelope follows the same no-op behavior. Exclusion
diagnostics contain only item type, reason, count, project, request ID, and
correlation ID.

Unknown top-level members in Envelope headers, members in item headers, event
payloads, client reports, minidump metadata, and extensible bounded DTO data
are ignored at the adapter boundary and are never persisted, returned, or used
for authorization; the nested Envelope-header `sdk` and `trace` objects remain
closed schemas. Exact management request bodies defined by this contract,
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
- Every pending management or artifact `202` response, including an initial
  operation response, an operation-status poll, a release-file upload, DIF
  assembly, or artifact-bundle assembly, includes the exact decimal-seconds
  header `Retry-After: 5`. Terminal `200` responses do not include this
  pending-operation header. This fixed polling delay is independent of the
  separate quota-derived `Retry-After` values for `429` and `503` responses.
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
  | `exception`, `stacktrace`, `debug_meta`, `metadata` | Optional bounded JSON objects using the recursive bounded-value rules below; absent and `null` values are omitted. |
  | `user` | Optional `null` or object with optional `id`, `username`, and `name` members; each present member is a bounded NFC-normalized non-empty string. |
  | `sdk` | Optional `null` or object whose `name` and `version` members are nullable bounded NFC-normalized strings. |

  `user` and `sdk` use the closed schemas above rather than arbitrary recursive
  objects. A missing or explicit `null` `user` or `sdk` serializes as `null`.
  A present `user` object ignores unknown members and serializes only the
  supplied recognized string members, including an empty object when none are
  supplied. A present `sdk` object ignores unknown members and serializes
  exactly `{ "name": <string-or-null>, "version": <string-or-null> }`, using
  `null` for either recognized member that was absent. For `user` or `sdk`, a
  scalar, array, or wrong-typed recognized member rejects
  the Envelope with `400 invalid_envelope`; no value is coerced or silently
  dropped. Recognized strings are NFC-normalized before DTO serialization and
  digest construction.

  `metadata` is optional. When present and non-null, it must be an object whose
  keys and values satisfy the recursive bounded-value rules below; an explicit
  `null` is treated as absent. The normalized event retains the accepted bounded
  metadata values, including non-string recursive values, but the Issue and Event
  DTO projection is always exactly `{ "type": <value>, "value": <value>,
  "filename": <value>, "function": <value> }`. For each recognized member, an
  NFC-normalized string is emitted as that string; an absent, explicit-null, or
  non-string value is emitted as `null`. Unknown members are dropped, no value
  is coerced, and omitted or null outer metadata emits all four fields as `null`.

  Recursive bounded values are only `null`, booleans, finite numbers, NFC
  strings, arrays, or objects. Before sorting or emitting any object, the
  adapter NFC-normalizes every key and rejects the object with `400
  invalid_envelope` if two distinct input keys produce the same normalized
  key; it never overwrites or resolves the collision. Object keys are then
  sorted, array order is preserved, and explicit `null` members are retained
  inside a present nested object. The normalized top-level object contains only the
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
  attachment bytes contribute through their SHA-256 and size. Empty,
  unsupported-only, and attachment-only Envelopes use `event: null`, an empty
  attachment array, and an empty client-report array.
- Envelope and event submissions are idempotent by the tuple
  `(tenant_id, project_id, external_event_id, payload_digest)` while the
  Ingest-owned acceptance record containing the payload digest and original
  acceptance remains retained. The same tuple returns the original
  acceptance; the same event ID with a different digest returns `409` and is
  not merged or durably accepted. These idempotency checks occur after complete
  structural validation and before the environment retirement fence or any new
  acceptance side effect, so this
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
  `Idempotency-Key`. Release metadata updates and finalization require the
  exact observed release `ETag` in `If-Match`. For release creation and deployment, an absent key uses
  `(tenant_id, operation, target_scope, canonical_request_body_digest)`. For
  release metadata updates and finalization, it additionally includes the
  observed monotonic release generation:
  `(tenant_id, operation, target_scope, observed_release_generation,
  canonical_request_body_digest)`. A lost-response retry against the same
  generation resumes the identical operation; a later legitimate mutation has
  a new identity even when its body matches an older request. When supplied,
  the client key binds to the first observed generation and the same identity;
  reusing it with different content or scope returns `409`. No retry identity
  includes credentials or unrestricted payloads.
- Duplicate or out-of-order asynchronous messages are handled by the owning
  component's idempotent command/reconciliation contract. The adapter never
  invents a second canonical event or bypasses a lifecycle fence.

### Pagination and rate-limit headers

Every exposed list endpoint returns a direct array of at most 100 records and
accepts only its route-specific filters plus the opaque `cursor` and `limit`
parameters. `limit` is one decimal integer from `1` through `100`, defaulting
to `100`; a malformed, repeated, or out-of-range value returns
`400 invalid_request`. List endpoints return the upstream-compatible `Link`
header. When a next page exists, the `Link` header contains a next entry whose
URL carries the opaque `cursor` and whose parameters include exactly
`rel="next"` and `results="true"`; a response without another page has no
next entry. A cursor binds to the original tenant, project, principal,
filters, page size, sort order, and authorization revision. The default keyset
ordering is fixed per route:

| List route | Ordering, including tie-breaker |
| --- | --- |
| `GET /api/0/organizations/` | `dateCreated ASC`, then organization `id ASC` |
| `GET /api/0/organizations/<organization>/projects/` | `dateCreated ASC`, then project `id ASC` |
| `GET /api/0/projects/<organization>/<project>/keys/` | `dateCreated ASC`, then DSN `id ASC` |
| `GET /api/0/projects/<organization>/<project>/issues/` | `lastSeen DESC`, then issue `id ASC` |
| `GET /api/0/issues/<issue>/events/` | `dateReceived DESC`, then external event ID `eventID ASC` |
| `GET /api/0/projects/<organization>/<project>/events/` | `dateReceived DESC`, then external event ID `eventID ASC` |
| `GET /api/0/organizations/<organization>/releases/` | `dateCreated DESC`, then release `version ASC`, then release `id ASC` |
| `GET /api/0/projects/<organization>/<project>/releases/` | `dateCreated DESC`, then release `version ASC`, then release `id ASC` |
| `GET /api/0/organizations/<organization>/releases/<version>/commits/` | commit `id ASC` |
| `GET /api/0/projects/<organization>/<project>/releases/<version>/files/` | `dateCreated ASC`, then artifact `id ASC` |
| `GET /api/0/organizations/<organization>/releases/<version>/deploys/` | `dateFinished DESC`, then deployment `id ASC` |

The first page establishes a read snapshot and its immutable high-water mark;
the opaque cursor carries that snapshot, the last complete ordering tuple, and
the original route scope and filters. Every later page uses the same snapshot,
so records inserted or reordered after the first page are deferred to a new
traversal rather than skipped or duplicated. Each page rechecks current
authorization, revocation, lifecycle, retention, and security-projection
freshness; a record that is no longer authorized is omitted without disclosure.
A snapshot and every cursor created for it have a fixed 15-minute lifetime
starting at the instant the first page establishes the snapshot. The cursor
carries that immutable expiration, and page reads, retries, and generated next
links never refresh it. Expiration is the exact boundary `now >= expires_at`;
the request returns `400 invalid_request` with no data disclosure at or after
that boundary. A stale, cross-tenant, malformed, or expired cursor is rejected
without disclosing data: malformed and expired cursors return `400` with
`invalid_request`, while stale cursors whose bound authorization or security
revision is no longer valid
return `403` with `permission_denied`. A valid cursor replayed outside its
tenant or otherwise inaccessible scope returns the same indistinguishable
`404 not_found` used for an inaccessible resource.

Management responses include `Retry-After` for `429` and `503`. When an
authoritative quota reset or dependency-availability deadline is known, the
header is serialized as the ceiling of the remaining duration in whole
seconds. When a `503` is caused by unavailable quota evaluation or another
owner dependency and no such deadline can be evaluated, the adapter emits the
exact deterministic fallback `Retry-After: 5`.

When a quota is safely evaluated, the adapter emits these concrete headers (HTTP
header-name casing is insignificant):

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
but omits all rate-limit headers. A `503` caused by another unavailable owner
dependency uses the same five-second fallback when no deadline is available
and emits no quota headers unless quota evaluation actually supplied them. No
wildcard header name or empty
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

Artifact scope is workflow-specific. For a direct release-file upload, list, or
item read, `project` is the compatibility alias from the addressed route and
`release` is the exactly once-decoded `<version>` path segment; neither field
may be `null` in those Artifact DTOs. For artifact-bundle assembly,
`project` is each requested project alias and `release` is the supplied version,
or `null` only when the request explicitly uses the documented versionless
workflow.

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
header equal to its `status_url`, and `Retry-After: 5`. Polling that operation
returns `200` with `status: "succeeded"` and the registered Artifact DTO in
`result`, or `status: "failed"` with the standard bounded operation error.
Retries with the same identity and checksum resume the same operation or
return its terminal result; the same identity with different decompressed bytes
returns `409 conflict`. The canonical request digest includes the normalized
metadata and lowercase SHA-1, but never credentials or multipart framing.

Standalone DIF uploads are independent of release and distribution. Their
per-file content identity is `(project, full-file checksum)`; when a
`debug_id` is supplied, `(project, debug_id)` is also unique. The ordered
chunk list is only the assembly input: the adapter concatenates the referenced
chunk bytes in that order, verifies the declared full-file checksum, and then
uses the assembled bytes and checksum for identity. A matching checksum and
assembled bytes are a successful duplicate even when a valid retry uses a
different chunk partition or logical name. The logical name from the first
successful registration is canonical: every later duplicate or successful
poll returns that stored name and never replaces it with the retry's name.
Different assembled bytes fail checksum validation before mutation; a
conflicting debug identity remains `409` where the separate debug identity is
already owned by different content.

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
`{name, debug_id?, chunks}`; its response is the same checksum map and does
not require release or distribution fields. Every result contains exactly
`state` and `missingChunks`, plus state-specific fields: `not_found` and
`assembling` omit both `detail` and `dif`; `created` and `ok` omit `detail`
and require `dif`; and `error` requires non-null bounded safe `detail` and
omits `dif`. Neither field is emitted as `null`. DIF `state` uses only
`not_found`, `created`, `assembling`, `ok`, and `error`. Missing chunks produce
non-terminal `not_found` with a non-empty `missingChunks` array; once all
chunks are available but assembly is still running, the state is non-terminal
`assembling` with an empty array. A newly registered DIF returns terminal
`created`; an already registered matching DIF or a later successful poll of a
completed assembly returns terminal `ok`. Terminal owner failure produces
`error` with an empty `missingChunks` array. Neither `created` nor `ok` is a
pending state. A required `dif` uses the exact pinned `DebugInfoFile` fields
defined above. An artifact-bundle
assembly request contains `{checksum, chunks, projects, version?, dist?}`;
the pinned client supplies no filename, so the adapter derives the artifact's
logical filename deterministically as `artifact-bundle-<checksum>` using the
lowercase 40-character bundle checksum. Absent `version` selects the
versionless identity above. `projects` is required and must contain one to
100 unique project aliases. Each alias is resolved only within the
authenticated organization. The adapter validates cardinality, uniqueness,
tenant-scoped alias resolution, and authorization before checksum
verification, project lookup, operation creation, assembly, or persistence;
an empty or duplicate list returns `400 invalid_request`, an over-limit list
returns `413 payload_too_large`, and an unknown, cross-organization, or
otherwise inaccessible alias returns indistinguishable `404 not_found`, all
with no side effect. For an artifact bundle,
`chunks` is a non-empty ordered list of lowercase
40-character SHA-1 chunk names, and `checksum` is the lowercase 40-character
SHA-1 of the byte-for-byte concatenation of those chunks after each
`file_gzip` part has been decompressed, in exactly the listed order. No
separator, JSON wrapper, multipart framing, compressed bytes, or chunk-name
text is included in the preimage. The adapter validates checksum syntax before
accepting the assembly identity but defers byte verification until all
requested chunks exist. A missing-chunk request is accepted as pending; once
all chunks are available, the adapter computes the checksum before artifact
registration. A mismatch terminalizes the accepted assembly as `failed` with a
safe detail, no artifact or project registration, and no missing chunks; it is
not converted into a synchronous `400` after pending acceptance. A repeated
normalized assembly request,
including its checksum, ordered chunks, version, distribution, and ordered
project list, is an idempotent duplicate. The same checksum and bytes may be
registered under a different release, distribution, or project list; those
are distinct artifact registrations rather than conflicts. A checksum
conflict is reserved for a checksum-addressed value whose stored bytes
differ, or for an existing artifact identity requested with different bytes;
metadata differences alone never return `409 conflict`.

The first accepted normalized artifact-bundle assembly identity records an
immutable `assembly_accepted_at` and
`assembly_expires_at = assembly_accepted_at + 24h`. Matching polls and retries
do not extend this lifetime, and chunk uploads do not change the deadline.
While `now < assembly_expires_at`, an assembly missing one or more requested
chunks remains pending with the response below; a chunk that is uploaded again
before that boundary can satisfy the request. At the exact boundary
`now >= assembly_expires_at`, any still-missing or expired requested chunk
terminalizes the assembly as failed. Its `missingChunks` is then the unique
requested set absent under the chunk-expiration rule, sorted in lowercase
lexicographic order, and that terminal result is stable for later identical
polls; a later chunk upload does not reopen it. If all chunks become available
before the boundary, normal successful or owner-failure processing applies.

The artifact-bundle assembly response is exactly an object with `state`,
`missingChunks`, `detail`, and `projects` members. `state` is one of `pending`,
`succeeded`, or `failed`; `missingChunks` is always an array of lowercase
40-character SHA-1 chunk names; `detail` is nullable bounded safe text; and
`projects` is an array in the exact input order. Each project result contains
exactly `project`, `state`, `detail`, and `artifact`, where `project` is the
requested alias, the state uses the same three values, detail is nullable safe
text, and artifact is either `null` or the complete Artifact DTO whose
`project` equals that alias.

A pending response is `202` with `Retry-After: 5`, top-level `state: "pending"`,
the currently missing chunks, `detail: null`, and one pending/null project
result per input project. A successful terminal response is `200` with
`state: "succeeded"`, an
empty `missingChunks` array, `detail: null`, and one succeeded project result
with its registered Artifact DTO for every input project. A terminal owner
failure is `200` with `state: "failed"`, a non-null safe top-level detail, and
one failed/null project result per input project; no project registration is
exposed as a partial success. If failure is caused by missing or expired
chunks, `missingChunks` is the unique set of requested chunk names absent at
terminalization, sorted in lowercase lexicographic order. For every other
terminal failure, `missingChunks` is exactly `[]`. A checksum mismatch is one
of these terminal failures. Registration of all project artifacts is one atomic
operation:
if any target cannot complete, no target is committed as a successful result.
Conflicting input remains `409 conflict`, and an unavailable owner remains
`503 unavailable` rather than claiming a terminal result.

Artifact-bundle assembly is polled by repeating the identical `POST` body. It
does not return an assembly operation ID, `Location`, or generic operation
status URL.

Chunks negotiated by the organization capability are organization-scoped
transient records keyed by organization and lowercase chunk checksum; their
upload request intentionally carries no project field. A DIF upload through
the project-scoped capability remains project-bound. At DIF assembly and
artifact-bundle assembly, Watchtower resolves the target project(s), applies
the lifecycle fence, and verifies the caller's authorization before checksum
verification, operation creation, assembly, persistence, or exposing any
result. A disabled target therefore returns `403 permission_denied` at
project-bound assembly, while organization-scoped staging remains reusable.
The `projects` list is authoritative at assembly, where Watchtower resolves
every alias only within the authenticated organization and verifies the
caller's authorization. Unknown, cross-organization, or otherwise inaccessible
aliases return the same indistinguishable `404 not_found`; same-organization
reuse is allowed after those checks. Watchtower bounds every field and enforces
required checksum, order, project, and applicable artifact identity. These are
adapter DTOs only. Every accepted organization- or project-scoped chunk has
`expires_at = accepted_at + 24h`, where `accepted_at` is the first successful
storage time for that checksum in that scope. Matching retries, capability
probes, assembly submission, and assembly polling do not extend the lifetime.
At the exact boundary `now >= expires_at`, the chunk is treated as absent for
matching and assembly even if physical cleanup has not run; a later valid
upload may create a fresh record with a new `accepted_at`.
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

An interrupted upload leaves recoverable chunk state until its 24-hour
retention fence; it does not create a release file. Missing chunks, terminal
checksum mismatch, ordering conflicts, expired upload state, quota exhaustion,
unauthorized project lists, and cross-organization reuse are explicit errors.
Same-organization reuse of an
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

The `previous-with-commits` route accepts only an optional repeated `project`
query parameter with one to 100 unique values. More than 100 values returns
`413 payload_too_large` before lookup. Each value is a unique, non-empty
project alias resolved only within the authenticated organization; an unknown,
cross-organization, or otherwise inaccessible alias returns the
indistinguishable `404 not_found`, and any other query parameter returns `400
invalid_request`. When the filter is omitted, the candidate project scope is
the intersection of the current release's associated projects and the
projects currently readable by the principal; when supplied, it is the
validated requested project set. A candidate release must be in the same
organization, be associated with at least one readable project in that scope,
differ from the requested release, and have both `commitCount > 0` and a
non-null `lastCommit`; releases without commits are skipped. Candidates are
ordered by `dateCreated ASC`, then
`version ASC`, then `id ASC`. The route returns the candidate with the greatest
ordering tuple strictly before the requested release's tuple, using the fixed
Release DTO below. If no candidate matches, it returns the standard `404
not_found` body without disclosing another release.

For project-scoped release list and detail reads, the release remains visible
only when the route project is currently readable by the principal, and the
Release DTO's `projects` array is filtered to associated projects for which the
principal has current read authority. The route project must remain in the
filtered array; otherwise the route returns indistinguishable `404 not_found`.
For organization-scoped release list and detail reads, an associated release
is eligible only when at least one associated project is currently readable by
the principal; its `projects` array is filtered to those readable projects,
and an eligible release with no remaining readable project is omitted or
returned as indistinguishable `404 not_found` for detail. An unassociated
release is visible only to a principal with organization-level `Owner` or
`Admin` authority. No organization-scoped Release DTO exposes an unreadable
project's ID, slug, or name.
The same eligibility predicate applies before every organization-scoped
release subresource read, including `/commits/` and `/deploys/`: an associated
release requires at least one currently readable associated project, while an
unassociated release requires organization-level `Owner` or `Admin` authority.
An ineligible release returns indistinguishable `404 not_found` before commit
IDs or Deployment DTO metadata are selected or serialized.
For `previous-with-commits`, readable-project scope is applied before candidate
ordering and selection, so a candidate associated only with unreadable
projects is not eligible and produces the standard `404 not_found` when no
other candidate matches. After selection, the result's `projects` array is
still filtered to associated projects for which the principal has current read
authority. No project-scoped response includes an unreadable project's ID,
slug, or name.

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

Release finalization is idempotent. Before a deployment record is accepted, the
adapter resolves every project associated with the release and requires the
authenticated principal to have current `Write` or `Manage` authority on every
one. A deployment for an unassociated release requires organization-level
`Owner` or `Admin` authority. These checks are repeated for retries and occur
before returning a new or duplicate deployment result; an inaccessible or
unauthorized project fails closed without mutation. Deployment records reference
a release and carry the following exact closed JSON body:

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
timestamp is an RFC 3339 UTC instant with zero through nine fractional decimal
digits. More than nine fractional digits returns `400 invalid_request` before
mutation. `name` and `url` are optional nullable
strings, with omission equivalent to `null`; a non-null URL is HTTP(S).
`metadata` is optional but, when present, is a non-null object of bounded
string keys and string values; omission is equivalent to `{}`. Duplicate or
unknown members, null required fields, invalid URLs/timestamps, nested
metadata values, or values over the applicable field limits return
`400 invalid_request` before mutation.

The normalized body replaces omitted nullable values with `null`, omitted
metadata with `{}`, and NFC-normalizes strings. Distinct metadata keys that
collide after NFC normalization are rejected with `400 invalid_request` before
the digest or mutation; no key overwrites another. Accepted timestamps with
fewer than nine fractional digits are right-padded with zeroes in the
canonical UTC serialization. The normalized body is the RFC 8785 request
digest preimage. Deployment writes do not require a client idempotency key; without
one, retries use `(tenant_id, operation, release_scope,
canonical_request_body_digest)`, so a new normalized body digest is a distinct
deployment record. When a client key is supplied, it binds to the same release
scope and normalized body digest; repeating that key with the same body returns
the original successful result, while reusing it with a different body returns
`409 conflict`.
An identical no-key retry also returns the original Deployment DTO with `200`.
The first successful `POST` for a new identity returns `201` with the fixed
Deployment DTO; both `dateCreated` and `dateFinished` equal the normalized
request `timestamp`, serialized as the canonical UTC form
`YYYY-MM-DDTHH:mm:ss.sssssssssZ`, and `dateStarted` is always `null`. The
adapter does not use request-receipt or persistence-commit time, and the
request has no start-time field or native deployment source. Deployment records
history only;
they do not grant deployment authority, execute deployment work, or activate
unsupported release-health behavior.

## Identity, aliases, and storage ownership

- Organization, project, operation, artifact, release-operation, and internal
  resource identities are canonical lowercase UUID v7 values at Watchtower
  boundaries and PostgreSQL `uuid` when persisted by their owner.
- Sentry project IDs, DSN key IDs, release versions, and event IDs are
  compatibility aliases or scoped external identifiers. Issue IDs and short
  IDs are globally unique compatibility aliases across tenants and are never
  reused across project generations. Organization slugs are globally
  unique compatibility aliases; project slugs are unique within their
  organization and tenant-scoped. Organization slugs are resolved before tenant
  selection, while project slugs are resolved only after the canonical tenant
  is selected. Slugs may be reused only after deletion completes for a new
  resource generation, while canonical IDs and other scoped external
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
   compatibility aliases are scoped and non-reusable; organization slugs are
   globally unique, project slugs are organization-scoped, and either slug may
   be reused only after deletion completes.
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
  without `Content-Type`, with explicit identity/absent encoding and rejection
  of bodyless gzip, plus body-bearing management requests with accepted
  and mismatched content types, including identity/gzip JSON bodies at and over
  the `10,000,000`-byte decompressed limit, and `Content-Type: application/json`
  on every non-empty management response;
- minidump uploads with the exact fixture-emitted Crashpad scalar annotations,
  required Sentry metadata and external event ID, each optional release/dist/
  platform omission combination, explicit-null rejection, and rejection of eventless
  minidumps, body-only `application/octet-stream` requests, and unlisted file
  parts, bounded fields, and the successful `200` zero-length acknowledgement;
- `sdk.native.crash` using the exact multipart minidump request and
  `sdk.native.tus-minidump` using the separate TUS creation/append and Envelope
  `attachment-ref` binding workflow;
- Unity 4.10.0 Windows x64 and Unreal 1.23.0 Win64 native-crash fixtures,
  each using `/envelope/` with a fatal event and `event.minidump` attachment,
  the pinned `sentry-native` submodule commit, and no non-Envelope alternative;
- legacy `store` uploads with the required JSON event fields and the successful
  `200` zero-length acknowledgement;
- Native TUS large-attachment creation (`201` and `Location`) for both zero-
  and positive-length uploads, with zero-length uploads immediately
  `complete-unbound`, the exact `Upload-Metadata` value, `HEAD` requests with
  `Tus-Resumable: 1.0.0`,
  successful `200` empty responses with `Tus-Resumable`, `Upload-Offset`, and
  `Upload-Length`, `412` version-precondition failures, `401` authentication
  failures, and `404` missing/expired/bound/inaccessible uploads, followed by
  expected-offset identity-only `PATCH` appends, gzip `415` responses with no
  append, stale-offset `409` responses and current
  offsets, overflow `413` responses, atomic no-append behavior for both
  failures, incomplete-upload retention, finalization at the declared length,
  the 24-hour pending and complete-unbound lifetimes, no extension by append,
  and exact `now >= expires_at` behavior,
  failed-`HEAD` status/header-only responses with `Content-Length: 0`, the
  exact closed `{url,path}` reference object and relative-path validation,
  ordinary `attachment_length` range/equality checks, reference-length checks
  against dereferenced upload bytes rather than reference JSON bytes, and
  subsequent Envelope `attachment-ref` binding to the event ID, including the
  canonical lowercase UUID v7 upload ID, event-unbound creation metadata,
  same-project binding authorization, exact same-event retries after a lost
  `200` binding response when the upload is already `bound`, and rejection of
  cross-project binding;
- empty, unsupported-only, attachment-only, supported-only, and mixed Envelopes,
  including unassociated-attachment exclusion, and an
  envelope-level event ID on an excluded-only Envelope, all expecting `200`
  with a zero-length response body, plus eventless empty/client-report retries
  with the same client `X-Request-ID`, different client IDs, and no client ID;
  client reports also cover the exact `discarded_events` shape, token and
  quantity boundaries, duplicate-record digest handling, unknown members,
  multiple `client_report` items, and the aggregate 1,024-record limit;
  conflicting event/request digests expect the standard `409 conflict` body
  and no new acceptance side effect;
- nested identity/gzip item payloads at and over the decoded 20,000,000-byte
  item and 50,000,000-byte aggregate limits, with no partial persistence;
- duplicate, case-variant, malformed, and conflicting event IDs, including
  acceptance-record retirement while the canonical event remains queryable,
  identical retries after environment retirement, and uniqueness-tombstone
  enforcement; equivalent payloads with different
  compression, JSON ordering, or excluded metadata; message-only and
  stacktrace-only error events, exception events, deterministic multi-entry
  Event DTO serialization and ordering, deterministic Event `title` candidate
  precedence and empty fallback, `timestamp` to `dateCreated` mapping,
  `accepted_at` to `dateReceived` mapping, missing-timestamp fallback,
  nanosecond precision/range rejection, nullable level mapping, deterministic
  tag-array serialization, invalid levels, event items with no
  error signal, strict `user`/`sdk` type validation and null/missing/unknown
  member mapping, recognized Envelope `event_id`/`dsn`/`sent_at`/`sdk`/`trace`
  header shapes, ignored unknown top-level members, rejected unknown nested
  `sdk`/`trace` members, invalid-shape rejection, and NFC-normalized key
  collisions before hashing;
- new and duplicate chunks with exact `200` empty responses, conflicting
  chunks, interrupted assembly, optional and conflicting DIF idempotency keys,
  retries, polling, and lost responses, including non-terminal `not_found` and
  `assembling`, newly created terminal `created`, and duplicate/polled terminal
  `ok` DIF states with exact state-specific `detail`/`dif` presence, plus
  identical DIF bytes submitted with alternate valid chunk partitions or names,
  asserting first-write-wins for the registered logical name;
- collection credentials in `X-Sentry-Auth`, DSN query parameters, and DSN
  URLs, including percent-decoding, duplicate parameters, missing/unknown
  members, route-project mismatches, and conflicting sources;
- versioned and versionless artifact-bundle assembly, the deterministic
  `artifact-bundle-<checksum>` name, reuse of identical bundle bytes across
  release, distribution, and project-list identities, release-artifact
  identity across release-or-null, distribution, artifact type, and logical
  filename, direct release-file upload/list/item scope populated from the
  addressed project and decoded release path, repeat-POST polling without an
  operation ID or status URL, plus
  release-independent DIF duplicates and checksum/debug identity conflicts;
- release versions containing percent-encoded reserved path bytes, literal
  plus signs, malformed escapes, invalid UTF-8, query delimiters, and
  double-decoding attempts;
- allowlisted and disallowed browser origins, Envelope CORS preflight and
  actual responses, DSN tenant binding, exact origin reflection, exposed
  request and rate-limit headers including `Content-Encoding`, and no
  persistence for a disallowed origin,
  plus project setting update, version-conflict, lifecycle propagation,
  WHATWG default-port and host-case canonicalization, normalized duplicate
  rejection, and read-back cases;
- suspended project deletion with the minimal `deletion_target.name`, the
  current strong `ETag` and project-generation headers, exact
  `X-Confirm-Project-Name`/`If-Match`/`X-Watchtower-Project-Generation` reuse, and
  no broader project DTO disclosure, plus authorized polling of that exact
  deletion operation while suspended, the pending Support release gate, and
  rejection of unrelated operation status reads; deletion also covers its
  zero-byte body requirement and rejection of `{}` or other entity bodies,
  plus same-key fresh-authentication reconfirmation after Support release
  without creating a second operation;
- pagination using the documented per-route order and tie-breaker, snapshot
  consistency under concurrent inserts/updates, the fixed 15-minute cursor
  lifetime and exact `now >= expires_at` cutoff, cursor binding, malformed and
  expired cursor `400` results, stale cursor `403` results, cross-tenant cursor
  `404` results, rate-limit headers, exact
  `rel="next"`/`results="true"`/`cursor` Link parameters, `limit` bounds,
  DSN-key, release-file, release-commit, and deployment lists, unknown fields,
  organization lists scoped to one credential owner including active and
  suspended behavior, and every safe error class with
  the exact error-body member and detail rules, including consistent omission
  of `field_errors`;
- exact organization/project DTO bodies, including nullable platform,
  organization compatibility booleans, required deployment finish times,
  canonical aliases, origin arrays, omitted unknown fields, and list/detail
  consistency;
- exact issue/event DTO bodies, nullable fields, omitted unknown fields,
  omission of `permalink`, and strict `user`/`sdk` serialization,
  canonical Event `dateCreated`/`dateReceived` timestamp mappings and exact
  invalid-timestamp behavior,
  every `statusDetails` member's exact type, nullability, and status-dependent
  presence condition, including Actor and reprocessing-info shapes,
  list/detail/status-transition consistency, globally unique issue aliases with
  owning-tenant authorization, CLI
  `muted`/`resolvedInNextRelease` mappings, exact single-issue and bulk PUT
  bodies, exact issue-list `query`/`status`/repeated `environment`/`cursor`/
  `limit` filters, duplicate and unknown-filter rejection, repeated unique
  `environment` values from 1 through 100 and deterministic over-limit `413`
  responses, the 16,384-byte request-target boundary, repeated unique `id`
  query parameters from 1 through 100, bounded current-status filters, direct
  input-ordered bulk response arrays,
  all-or-nothing precondition failures, and rejection of
  scalar/query-only/unbounded updates and route-project-mismatched IDs;
- release `/commits/` direct arrays containing exactly `{ "id": string }`,
  fixed Release DTO responses with `shortVersion: null` or `404 not_found` for
  `/previous-with-commits/`, including repeated project filters from 1 through
  100, deterministic over-limit `413` responses, skipped no-commit releases,
  deterministic ordering/tie-breaking, normalized project/environment array
  ordering, readable-project candidate filtering before selection,
  inaccessible-project filtering, the same visibility gate for organization
  `/commits/` and `/deploys/` reads, no-match behavior, and the pinned
  sentry-cli parsing workflow, including organization release list/detail
  filtering for readable projects and unassociated-release organization
  authority;
- release creation, metadata update, and finalization with the exact request
  bodies, nullable fields, mutually exclusive combinations, canonical digests,
  observed-generation retry identities carried by required `If-Match` ETags,
  lost-response retries, stale-generation conflicts, exact `201`/`200` DTO
  responses and headers, no `202` operation responses, and rejection of
  unknown or misplaced fields, mixed-authority project lists, all-or-nothing
  project authorization, and the Owner/Admin requirement when `projects` is
  omitted or empty;
- project creation and browser-origin update with the exact closed request
  bodies including the required explicit slug, printable-ASCII project-name
  validation, canonical slug-collision and reuse behavior, canonical creation
  digest, required idempotency, nullable platform, origin validation, exact
  `200`/`202` Project and Operation DTO states, duplicate behavior, generation
  headers and stale-generation rejection, ordinary alias reads without a
  generation input, response headers, and rejection of unknown members;
- issue queries with NFC plus Unicode 15.1 default case folding, `ß`/`ss`,
  locale-independent Turkish case behavior, and folded Unicode-scalar
  substring matching over only the Issue `title` and `culprit` projections,
  including message-only non-matches; Envelope items carrying arbitrary `item_count` or
  `item_headers` values on supported and excluded types, confirming they are
  ignored and do not alter acceptance or the payload digest;
- DSN issuance with required name and nullable platform, empty-object rotation,
  bodyless revocation, exact `201`/`200`/`204` responses, same-tuple conflicts,
  independent cross-project/operation keys, and rejection of unknown members
  or bodies;
- direct release-file uploads with exact multipart parts and encodings,
  decompressed-byte checksums, duplicate/conflicting identities, `202`
  operation responses, terminal artifact results, and invalid-part rejection;
- project deletion with missing/mismatched confirmation, release-file deletion
  item reads exposing the current strong `ETag`, deletion without `If-Match` or
  idempotency key, a non-empty entity body, by exact `file_id`, repeated deletion, wrong-scope `404`,
  stale-version and idempotency-key conflicts, and owner outage, including a
  terminal successful deletion poll with `result: null`;
- organization-scoped capability probes for both DIF and artifact bundles,
  including allowed Owner/Admin and project Write/Manage credentials, denied
  read-only credentials, and the same authority rule on the staging POST,
  project-scoped DIF compatibility, exact SHA-1/hash/compression/chunk values,
  the shared `maxFileSize: 50000000` cap,
  exact `maxWait: 0` and `concurrency: 8`, and positive `chunksPerRequest`;
- the authenticated root capability probe with the exact `200` response,
  `Content-Type`, compatibility value, capability array, and array ordering;
- active, disabled, deleting, and deleted project collection admission with
  the exact `200`, `403 permission_denied`, `409 conflict`, and `404
  not_found` results, retired-environment `409 conflict`, and no persistence
  for rejected requests, including compressed and legacy parsed events before
  the environment fence, plus authorized disabled-project reads, blocked
  project-bound management writes, reusable organization-scoped chunk staging,
  staging reuse for disabled targets, and `403` at disabled-project assembly;
- chunk requests at and over the advertised `maxRequestSize`, including
  duplicate and rejected parts, with `413` and no partial persistence for an
  over-limit request, `400` for overlong scalar fields with the exact generic
  body and no `field_errors`, platform-token grammar,
  exact scalar byte boundaries, recursive event depth/member/array boundaries,
  and URL/text limits, plus
  DIF/artifact-bundle assembly cardinality at and over each explicit digest,
  chunk, and project limit before lookup, including zero, one, 100, duplicate,
  cross-organization, and 101-project artifact lists, and repeated identical
  assembly POST polling without a generic status URL, the 24-hour
  organization/project chunk lifetime, non-extending duplicate/poll behavior,
  and exact `now >= expires_at` absence;
- valid, expired, revoked, insufficient-scope, cross-tenant, stale-projection,
  suspended, disabled, deleting, and deleted resources;
- personal-token and service-token organization lists limited to the
  credential's owning organization, with cross-organization enumeration
  denied and suspended owning organizations omitted safely;
- organization/project reads, creation, update, deletion, DSN issuance,
  rotation/revocation, issue/event reads, resolve/reopen/ignore/mute/next-release,
  release requests without client idempotency keys, and deployment workflows
  with an always-null `dateStarted`;
- operation polling with `202 pending` and exact `Retry-After: 5`, `200
  succeeded`, `200 failed`, the immutable originating nested failure
  `request_id` across repeated failed polls with distinct current poll IDs, the
  top-level `410 operation_expired` error at and after the exact
  `completed_at + 24h` cutoff, unknown-operation `404`, and owner-outage `503`
  responses;
- malformed management JSON versus malformed Envelope JSON, with
  `invalid_request` and `invalid_envelope` respectively;
- single- and multi-entry DIF assembly retries using the canonical sorted
  checksum-keyed request-map digest, excluding the idempotency key and
  preserving chunk order;
- artifact-bundle polling with exact pending `202` and `Retry-After: 5`,
  ordered per-project results for one and 100 projects, all-or-nothing
  successful/failed terminal
  states, sorted missing-chunk arrays for missing/expired terminal failures,
  empty arrays for other terminal failures, deferred checksum validation and
  terminal checksum-mismatch failures, safe details, and nullability;
- deployment writes with the closed JSON body, omitted/null normalization,
  metadata bounds, NFC key-collision rejection, bounded timestamp precision,
  canonical digest, exact `201` initial and `200` duplicate responses, distinct
  no-key deployment bodies, and conflicting supplied-key retry rejection, plus
  Write/Manage authorization over every associated
  release project and Owner/Admin authorization for unassociated releases;
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
