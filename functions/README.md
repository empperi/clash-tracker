# @clash-tracker/functions

Firebase Cloud Functions (2nd gen, TypeScript, Node 20). The only place server-side I/O
happens: the CoC API gateway, scheduled war ingestion, the auth/magic-link endpoints, and
the Firestore repositories that wrap reads/writes.

Pure decision logic is imported from [`@clash-tracker/core`](../packages/core); functions
here are thin adapters around it.

> Scaffolded by Track 1; populated by Tracks 2, 3, 6, 7, 8.
