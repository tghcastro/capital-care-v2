# Password Recovery

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by project owner, 2026-11-25

## Situation

- Effort: in active construction - base authentication (`.prd/base-authentication.md`) and user management (`.prd/user-management.md`) are approved but not built yet; this PRD builds on their sign-in, sessions, registration and profile.
- Decision: committed by project owner, 2026-11-23, as the third of four authentication PRDs (order: base authentication → user management → password recovery → rate limiting); method decided by project owner: self-service recovery codes, with an owner-run reset as the fallback, and no email.
- In flight: adds a step to registration and sign-in from the earlier PRDs; limiting repeated recovery attempts is specified in the rate limiting PRD.
- At stake: high - a mistake either locks a person out of their account and all its data, or lets someone else in.

## Problem

Once people can register, anyone who forgets their password loses their account and every record in it. There is no email server, so the usual "send me a link" recovery is not available, and the only way out today would be the owner editing the database by hand. With open registration, the people who forget passwords are not only the owner, so recovery has to work without them in most cases. No usage number applies: the capability does not exist yet.

Accepted risk (project owner, 2026-11-23): a person who loses both their password and their recovery codes, and cannot reach the owner, loses access to their account.

## Success

- Worked if: a person who forgets their password gets back in on their own with a recovery code, or through the owner's reset, with nobody editing the database by hand - when this PRD ships.
- Going wrong: a used or replaced code still works, or someone ends up with no recovery codes without having gone through the mandatory codes screen.
- Review: at the end of this PRD's delivery, before rate limiting starts - project owner.

## Boundary

In: recovering access with a recovery code, the mandatory recovery codes screen, generating new codes from the profile, the owner-run reset with a temporary password, and audit records for these actions.

Out: recovery by email or SMS - there is no email server, and SMS is another external service.
Out: security questions - their answers can be guessed or found publicly.
Out: MFA and passkeys - not a requirement for now.
Out: limiting repeated recovery-code attempts - rate limiting PRD, next in order.
Out: email verification - dropped; there is no email server.

Unchanged: the password rule (12 to 128 characters), sign-in, sessions and the generic "Invalid email or password" message from base authentication.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Person finishes registration | Before the main page, the mandatory recovery codes screen shows a new set of codes once; they continue only after confirming they saved them | Recovery codes screen with "Copy" and "Download", and "I saved my codes" |
| Person with no recovery codes signs in (the five test users, or any account created before this PRD) | Before any other page, the same mandatory screen generates and shows their codes once | Recovery codes screen |
| Recovery codes are shown | 8 codes of 10 characters, `XXXXX-XXXXX`, with no ambiguous characters (`0`/`O`, `1`/`I`/`l`); "Copy" copies them all, "Download" saves them as a text file | The codes |
| Person recovers with their email, a valid unused code and a valid new password | The code is used up, the password changes, every earlier session ends, and the person is signed in on this device | The main page, and how many codes remain |
| Person types a code in lower case, with spaces, or without the hyphen | Accepted as the same code | Same as a valid code |
| Recovery leaves 2 or fewer unused codes | The person is told to generate new codes | A warning with the number of codes left |
| Recovery with an unknown email, a wrong code, a used code or a replaced code | Nothing changes; the response does not reveal whether the account exists | "Invalid email or recovery code" |
| Recovery with a new password shorter than 12 or longer than 128 characters | Nothing changes and the code is not used up | The password rule message |
| Recovery with the email of a deleted account | Nothing changes | "Invalid email or recovery code" |
| Person opens their profile | They see how many unused codes remain, never the codes themselves | Count of remaining codes |
| Person generates new codes from the profile with the correct password | Every earlier code, used or not, stops working; the new set is shown once on the mandatory screen; open sessions stay signed in | Recovery codes screen |
| Person generates new codes with a wrong password | Nothing changes | "Password is incorrect" |
| Owner runs the reset for an existing email | A random temporary password is shown to the owner once; it expires after 24 hours; every session of that person ends; their recovery codes stay valid | Owner: the temporary password, once |
| Owner runs the reset for an unknown email | Nothing changes | Owner: an error naming the unknown email |
| Person signs in with a valid temporary password | Before any other page, they must set a new password | Set new password page |
| Person signs in with a temporary password older than 24 hours | Sign-in is refused; the owner has to run the reset again | "Invalid email or password" |
| Recovery with a code, generating new codes, or an owner reset | An audit record is kept in the same format as base authentication's records: full user id, partially masked email, outcome, and the cause on failure; never a password or a code | Owner, in the logs |
