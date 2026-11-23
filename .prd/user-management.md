# User Management

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by project owner, 2026-11-23

## Situation

- Effort: in active construction - base authentication (`.prd/base-authentication.md`) is approved but not built yet; this PRD builds on its users, account status and sign-in.
- Decision: committed by project owner, 2026-11-23, as the second of four authentication PRDs (order: base authentication → user management → password recovery → rate limiting), with open self-registration.
- In flight: replaces the base authentication rule "public user creation is closed" with open registration; email verification and password recovery are specified in the password recovery PRD, and protection against mass registration in the rate limiting PRD.
- At stake: high for the people involved - this is where the app starts accepting strangers, and deleting an account permanently removes that person's financial data.

## Problem

After base authentication, the only accounts that exist are the five the owner creates with a script, so nobody new can use Capital Care without the owner adding them by hand. The project is meant to grow to more users and keep a register of them, and every later identity PRD (password recovery, rate limiting) assumes people can create and manage their own accounts. There is a single kind of user and no administrator, so "managing users" means each person managing their own account. No usage number applies: the capability does not exist yet.

Open registration without rate limiting is accepted only while the app runs locally (project owner, 2026-11-23).

## Success

- Worked if: a new person can register, sign in, edit their profile and delete their account without the owner's help, and the script is no longer the only way to create an account - when this PRD ships.
- Going wrong: two accounts exist for the same email, or any of a person's data remains after they delete their account.
- Review: at the end of this PRD's delivery, before password recovery starts - project owner.

## Boundary

In: open self-registration (name, email, password), accounts marked as having an unverified email, viewing and editing one's own profile (name and email), deleting one's own account together with all of its data, and audit records for these actions.

Out: email verification - password recovery PRD; until then every email stays unverified.
Out: password recovery - password recovery PRD.
Out: rate limiting and protection against mass registration - rate limiting PRD; accepted only while the app runs locally.
Out: administrator, roles, and deactivating other people's accounts - there is a single kind of user for now; to be revisited.
Out: default categories or accounts for a new user - the account starts empty.
Out: exporting one's data before deleting the account - not requested.

Unchanged: sign-in, sessions, sign-out and password change from base authentication. The script that creates the five test users stays, for tests.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Visitor registers with a name, a new email and a valid password | Account is created, active, with the email marked unverified; the person is signed in straight away | The main page, empty, inviting them to create their first account and first category |
| Visitor registers with an email that is already registered | No account is created | "This email is already registered" |
| Visitor registers with the email of a deleted account | A new, empty account is created; nothing from the deleted account comes back | The main page, empty |
| Visitor registers with a password shorter than 12 or longer than 128 characters | No account is created | The same password rule message as password change |
| Visitor registers with a missing name, or a name longer than 100 characters after trimming | No account is created | A field error on the name |
| Visitor registers with a name that another user already has | Account is created; names do not need to be unique | The main page, empty |
| Name entered with spaces at the start or end | Spaces are removed before saving | The trimmed name |
| Signed-in user opens their profile | Their name and email are shown, and whether the email is verified | Profile page |
| User changes their name | Saved without asking for the password | The new name |
| User changes their email with the correct current password | Email is changed and marked unverified again; open sessions stay signed in; the next sign-in uses the new email | The new email, marked unverified |
| User changes their email to one already registered to another account | Nothing changes | "This email is already registered" |
| User changes their email with a wrong password | Nothing changes | "Password is incorrect" |
| User deletes their account with the correct password, after being told it is permanent and removes all their data | The account and all of its accounts, categories and transactions are permanently removed; all sessions end; other devices lose access when their current access expires | Sign-in page with "Account deleted" |
| User deletes their account with a wrong password | Nothing is deleted | "Password is incorrect" |
| Someone signs in with the email of a deleted account | Sign-in is refused like any unknown account | "Invalid email or password" |
| Registration, profile change or account deletion | An audit record is kept in the same format as base authentication's records: full user id, partially masked email, outcome, and the cause on failure; never a password | Owner, in the logs |

## Open questions

1. Account enumeration at registration - default taken: "This email is already registered" reveals that an email has an account; accepted while the app runs locally, to be revisited in the password recovery PRD once emails can be sent.
