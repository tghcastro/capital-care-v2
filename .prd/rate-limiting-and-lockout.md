# Rate Limiting and Lockout

> Read this PRD as a draft. Nothing below is decided except what Situation and Boundary record as committed.
> Status: draft - parked by project owner, 2026-11-25, to be reviewed later; written only to keep the context gathered so far

## Situation

- Effort: in active construction - base authentication, user management and password recovery (`.prd/base-authentication.md`, `.prd/user-management.md`, `.prd/password-recovery.md`) are approved but not built yet; this PRD protects the entry points they add.
- Decision: committed by project owner, 2026-11-23, as the fourth and last of the authentication PRDs (order: base authentication → user management → password recovery → rate limiting); scope and values are open.
- In flight: the three earlier PRDs each left their repeated-attempt protection here; nothing else is specified elsewhere.
- At stake: moderate while the app runs locally; high once it is reachable from a public server.

## Problem

Nothing limits how many times someone can try to get into Capital Care. Once the earlier PRDs ship, anyone who can reach the app can try passwords against an account without limit, create accounts in bulk through open registration, and try recovery codes against an account without limit. Today the app runs only on the owner's machine, so nobody else can reach it; the owner plans to put it on a server, and at that point these become real attacks. The project owner also wants this PRD for learning, even though the current setup does not strictly need it (2026-11-23). No usage number applies: the app has no outside users yet.

Accepted until this PRD ships (project owner, 2026-11-23): open registration and unlimited attempts are acceptable only while the app runs locally.

## Boundary

In (candidate, to confirm at review):
- repeated failed sign-in attempts, per account and per source;
- account lockout after repeated failed sign-ins;
- bulk registration through open registration;
- repeated recovery-code attempts (password recovery);
- what the person sees when they are limited or locked out.

Out: captcha - not a requirement for now (project owner, 2026-11-23).
Out: MFA - not a requirement for now; may follow once the app is on a server.
Out: HTTPS and secure hosting - out of scope for now.

Unchanged: the generic sign-in message "Invalid email or password" and the generic recovery message "Invalid email or recovery code" from the earlier PRDs.

## Open questions

1. Limits - not decided. How many failed attempts, in what time window, for sign-in, registration and recovery codes. Blocks the Journey.
2. Lockout - not decided. Whether an account locks after repeated failures, for how long, and whether it unlocks on its own or needs the owner (for example, the owner-run reset from password recovery). Blocks the Journey.
3. Account lockout as a weapon - not decided. Locking an account after failures lets anyone lock someone else out by typing wrong passwords; how much of that risk is acceptable. High impact.
4. What the person sees - not decided. Whether a limited or locked person is told so, and how long to wait, without revealing whether an account exists. Blocks the Journey.
5. Per account or per source - not decided. Whether limits count attempts per email, per network address, or both.
6. When it must ship - not decided. Whether this PRD becomes a requirement before the app goes onto a public server.
7. Success measure - not decided. Defined at review.
