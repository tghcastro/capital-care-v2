# Base Authentication

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by project owner, 2026-11-23

## Situation

- Effort: in active construction - the app exists, but the acting user is identified by a stand-in that any caller can forge.
- Decision: committed by project owner, 2026-11-23, as the first of four authentication PRDs (order: base authentication → user management → password recovery → rate limiting).
- In flight: replaces the interim acting-user identification used by every data route; user management, password recovery, and rate limiting are specified in their own PRDs and stay out.
- At stake: moderate - reversible, but every later authentication PRD and any move to a hosted server depend on it.

## Problem

Capital Care is promised to become a hosted, multi-user personal finance tracker in which each user sees only their own ledger. Today the "current user" is whatever id the caller sends, so anyone who can reach the app can read or change any user's accounts, categories, and transactions, and anyone can create users. While this stands in, the app cannot leave the owner's local machine, realistic multi-user testing is not meaningful, and the user management, password recovery, and rate limiting PRDs cannot start. It comes first because every later piece builds on a real, verified identity. No usage number applies: there is one user today and the protection does not exist yet.

The solution is built in-house; an external identity provider was ruled out by the project owner, with no planned change.

## Success

- Worked if: no data route accepts a request without a valid session, the forgeable acting-user stand-in is gone, the five test users can sign in and each sees only their own data, and the user management PRD can start - when this PRD ships.
- Going wrong: users are asked to sign in again repeatedly during normal use, or one user can see another user's data.
- Review: at the end of this PRD's delivery, before user management starts - project owner.

## Boundary

In: sign-in with email and password, sign-out, a persistent session whose lifetime is set by system configuration, expired-session handling, changing one's own password, a script that creates five test users, closing public user creation, each user seeing only their own data, and an audit record of access events.

Out: user management (registration, invitations, deactivation, roles) - its own PRD, next in order.
Out: password recovery by email - its own PRD, after user management.
Out: rate limiting and account lockout - its own PRD, after password recovery.
Out: only one active device per user - future requirement; in this PRD a user may be signed in on several devices at once.
Out: multi-factor authentication and captcha - not a requirement for now.
Out: HTTPS / secure hosting - not in scope for now; the app runs locally.
Out: session management (listing or ending sessions per device) - not planned.
Out: external identity provider - ruled out; solution is in-house.

Unchanged: there is still a single kind of user, with no roles. Data already tied to a user keeps its owner as it is today.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Valid sign-in, user came from a protected page | Session starts; user returns to the page they were trying to reach | That page |
| Valid sign-in, user opened the sign-in page directly | Session starts; user lands on the app's main page | Main page |
| Already signed in, opens the sign-in page | No form is shown; user goes straight to the main page | Main page |
| Sign-in with unknown email, wrong password, or deleted user | Sign-in is refused; the cause is not revealed to the user | "Invalid email or password" |
| Sign-in with empty fields or malformed email | Error shown on the form before anything is sent | Field-level error on the form |
| Signed-out user opens a protected page | Redirected to sign-in; after signing in, returns to that page | Sign-in page |
| Session within its configured lifetime, user active | Session renews silently | Nothing - work continues uninterrupted |
| Session past its configured lifetime, mid-action (e.g. filling a transaction) | User is sent to sign-in; after signing in, returns to the page they were on; unsaved form input may be lost | Sign-in page with "Session expired" |
| Manual sign-out | Session ends on the server, not only in the browser | Sign-in page with "Signed out" |
| Same user signed in on several devices | All sessions stay valid independently | Nothing different on any device |
| Change password with correct current password | Password changes; every other session of that user ends; the current session stays signed in | Confirmation; other devices are sent to sign-in on their next action |
| Change password with wrong current password | Password does not change | Error stating the current password is incorrect |
| Any user requests another user's data | Refused as if the data did not exist | Not found |
| Anyone tries to create a user through the app | Refused; public user creation is closed | Not available |
| Owner runs the test-user script for the first time | Five test users are created with passwords following one common pattern, taken from configuration rather than written in the script | Report listing the users created |
| Owner runs the test-user script again | Existing users are skipped, not duplicated; their passwords are not changed | Report listing users created and users skipped |
| Owner runs the test-user script with password configuration missing | Script stops without creating anyone | Clear error naming the missing configuration |
| Successful sign-in | Audit record kept with the full user id and the email partially masked | Owner, in the logs |
| Failed sign-in | Audit record kept with the internal cause (unknown email, wrong password, deleted user), the email partially masked, and the user id when the account exists; never the password, not even partially | Owner, in the logs |
| Sign-out and password change (success or failure) | Audit record kept in the same format as sign-in | Owner, in the logs |

## Open questions

1. Session lifetime values - default taken: set by system configuration; the concrete values are chosen when the configuration is defined, not in this PRD.
2. Email masking format - default taken: enough of the email stays visible to tell repeated attempts against the same account apart, without exposing the full address.
