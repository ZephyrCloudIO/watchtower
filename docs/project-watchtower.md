# Watchtower Project

## Purpose and Ownership

Watchtower is a future Sentry-compatible error monitoring and observability
platform. This project owns the product compatibility requirements for
Watchtower services. The authoritative server runtime profile is defined in
`docs/servers-watchtower-runtime-contract.md`.

## Version 1 Release Requirements

- Accept events from supported Sentry SDKs.
- Provide compatibility with Sentry management REST APIs.

## Compatibility Boundary

Watchtower must preserve the Sentry route and request behavior required by a
supported compatible interface. Native Watchtower HTTP APIs use explicit major
route versions.

This project does not yet define the supported Sentry version, individual
endpoints, authentication behavior, data model, persistence topology, or
migration behavior. Each must be established in an owning API or service
contract before implementation.

## Current Status

This repository contains policy and contract foundations only. It does not yet
provide a Watchtower server, public API, SDK, or persistent storage.
