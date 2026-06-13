# TypeScript Styleguide

Standards for writing clean, type-safe TypeScript code in Clash Tracker.

> Project addendum at the bottom — **Functional programming rules** — is binding for this
> codebase and takes precedence where it differs from generic guidance.

## General Principles

- Enable strict mode in `tsconfig.json`
- Explicit types for public APIs, inference for internals
- Use `readonly` where applicable
- Prefer immutability

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `UserService` |
| Interfaces | PascalCase | `UserConfig` |
| Types | PascalCase | `ResponseType` |
| Enums | PascalCase | `HttpStatus` |
| Functions | camelCase | `getUserById` |
| Variables | camelCase | `userName` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |

## Type Definitions

### Prefer Interfaces for Objects, Type for unions

```typescript
interface War {
  id: string;
  opponentName: string;
  teamSize: number;
}

type WarType = 'classic' | 'cwl';
type SyncState = 'synced' | 'out-of-sync';
```

### Avoid `any`

```typescript
// Bad
function process(data: any): any { ... }
// Good
function process(data: unknown): Result<Parsed> { ... }
// Good
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Functions

- Arrow functions for callbacks and short functions; declarations for hoisting/recursion.
- Destructure parameters with a named input interface.
- `async/await` over `.then()` chains.

```typescript
async function fetchClan(tag: string): Promise<Clan> {
  const response = await gateway.get(`/clans/${encodeURIComponent(tag)}`);
  return response.data;
}
```

## Error Handling

### Result Types Pattern (preferred for expected failures)

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function parseConfig(input: string): Result<Config> {
  try {
    return { success: true, data: JSON.parse(input) };
  } catch (e) {
    return { success: false, error: e as Error };
  }
}
```

Reserve thrown exceptions for truly exceptional cases. Custom error classes set `name`.

## Module Organization

Import order: (1) Node built-ins, (2) external packages, (3) internal absolute imports,
(4) relative imports. Prefer **named exports**; default export only for a Vue SFC/main
component. Use barrel files (`index.ts`) for public surfaces (e.g. `@clash-tracker/core`).

## Testing Patterns

```typescript
describe('attackUsagePct', () => {
  it('returns 100 when all attacks used', () => {
    expect(attackUsagePct({ used: 2, available: 2 })).toBe(100);
  });

  it('returns 0 when no attacks available', () => {
    expect(attackUsagePct({ used: 0, available: 0 })).toBe(0);
  });
});
```

Use `describe`/`it`. Prefer passing real/in-memory collaborators over mocking frameworks.

## Quick Reference

| Aspect | Recommendation |
|--------|----------------|
| Strict mode | Always enabled |
| `any` | Never use (`unknown` + narrowing instead) |
| Interface vs Type | Interface for objects, Type for unions |
| Async | `async/await` preferred |
| Exports | Named preferred |
| Errors | `Result<T,E>` for expected failures |

---

## Project addendum — Functional programming rules (binding)

Clash Tracker is written in a **functional style**. Reviewers enforce these:

1. **Pure functions by default.** A function's output depends only on its inputs; no
   reading/writing external mutable state, no I/O, no `Date.now()`/`Math.random()` inside.
   All such logic lives in `@clash-tracker/core`.
2. **No shared mutable state.** Don't mutate inputs. Return new values. Use `readonly`,
   `as const`, and non-mutating array methods (`map`/`filter`/`reduce`, spread) instead of
   `push`/`splice`/reassignment.
3. **Inject side-effecting dependencies as parameters.** Instead of importing a Firestore
   client or calling `new Date()` inside logic, accept them:
   ```typescript
   // A use case is a function of its dependencies returning a function of its input.
   const makeRecordWar = (deps: { warRepo: WarRepository; now: () => Date }) =>
     async (input: WarInput): Promise<Result<War>> => { /* ... */ };
   ```
   Tests supply in-memory repositories and a fixed clock — **no mocking library needed**.
4. **Higher-order functions & closures** are welcome when they clarify (factories like
   `makeRecordWar`, comparators built from key extractors, partial application).
5. **Time and ids are inputs**, never read ambiently inside pure code.
6. **Impure shell, pure core.** Firestore/network/clock only at the edges (`functions/`,
   `web/` adapters). Keep those adapters thin; push decisions into pure functions.
7. **Repositories are the one exception** that talks to Firestore directly — and they are
   tested against the **emulator**, not mocks (see `workflow.md`).
