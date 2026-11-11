# Account management verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 33a205f
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `account.router.test.ts` `C1 POST /accounts returns 201 with the account fields` | yes |
| C2 | `account.router.test.ts` `C2 GET /accounts with no accounts returns an empty list` | yes |
| C3 | `account.router.test.ts` `C3 GET /accounts returns only the caller accounts` | yes |
| C4 | `account.repository.test.ts` `C4 listByUser orders names alphabetically ignoring case and accents` | yes |
| C5 | `account.router.test.ts` `C5 PATCH /accounts/:id renames and keeps id userId createdAt` | yes |
| C6 | `account.service.test.ts` `C6 rename to its own name or only its casing succeeds` | no - runs on the in-memory mock; the real `isNameTaken(..., excludeId)` + unique-key update path is never exercised for a casing-only or same-name rename |
| C7 | `account.router.test.ts` `C7 PATCH without a usable name returns 400 and changes nothing` | yes |
| C8 | `account.dto.test.ts` `C8 name rule rejects a missing empty or blank name` | yes |
| C9 | `account.dto.test.ts` `C9 name rule accepts 30 characters and rejects 31` | no - only ASCII `a`; the bound counts code points, and a 30-char accented, NFD or astral name is never asserted |
| C10 | `account.dto.test.ts` `C10 name rule accepts letters digits and spaces only` | no - "letters of any language" is proven on Latin/Greek only; scripts whose letters carry combining marks (Devanagari, Thai, Hebrew with niqqud) are rejected and no test names one |
| C11 | `account.dto.test.ts` `C11 name is trimmed before the rules apply` | yes |
| C12 | `account.router.test.ts` `C12 invalid names return 400 with the rule and save nothing` | yes |
| C13 | `account.service.test.ts` `C13 create rejects a name taken ignoring case` | yes |
| C14 | `account.service.test.ts` `C14 rename rejects a name taken by another account` | yes |
| C15 | `account.repository.test.ts` `C15 unique key rejects a duplicate name ignoring case with a conflict` | yes |
| C16 | `account.router.test.ts` `C16 two users can each create Cash` | yes |
| C17 | `account.router.test.ts` `C17 a deleted account name can be used again` | yes |
| C18 | `account.router.test.ts` `C18 conflicts return 409 with a ConflictError body` | yes |
| C19 | `account.service.test.ts` `C19 create is rejected at the limit and the message states it` | yes |
| C20 | `account.service.test.ts` `C20 deleting an account at the limit frees a slot` | yes |
| C21 | `account.service.test.ts` `C21 the limit counts each user separately` | yes |
| C22 | `account.service.test.ts` `C22 a lowered limit keeps existing accounts and blocks new ones` | yes |
| C23 | `config.test.ts` `C23 account limit defaults to 99 and reads valid values` | yes |
| C24 | `config.test.ts` `C24 invalid account limit fails with the variable name` | no - none of the whitespace or leading-zero forms (`" 5"`, `"05"`) are asserted either way, so the contract on them is unfixed |
| C25 | `ledger.startup.test.ts` `C25 createLedgerRouters fails to start with an invalid account limit`; `accounts.component.test.ts` `C25 the app fails to start with an invalid account limit` | yes |
| C26 | grep proof in `checks.md` (`.env.example`, `docker-compose.dev.yml` carry 5; `docker-compose.prd.yml`, `docker-compose.yml` do not mention it); re-run by the Verifier, exit 0 | yes |
| C27 | `account.router.test.ts` `C27 a limit field in the request body is ignored` | yes |
| C28 | `account.router.test.ts` `C28 DELETE /accounts/:id returns 204 and removes the account` | yes |
| C29 | `account.router.test.ts` `C29 PATCH and DELETE of a missing account return 404` | yes |
| C30 | `account.router.test.ts` `C30 another user account returns 404 for PATCH and DELETE` | yes |
| C31 | `account.router.test.ts` `C31 a request without X-User-Id returns 401` | no - only an absent header; an empty `X-User-Id:` (the controller's `length === 0` branch) is never sent |
| C32 | `accounts.component.test.ts` `C32 the app mounts /accounts` | yes |
| C33 | `account.repository.test.ts` `C33 the account table and its unique index exist` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Letters of many languages are rejected: the name regex `^[\p{L}\p{Nd} ]+$` has no `\p{M}`, so a name still holding a combining mark after NFC is refused although S2 says "letters of any language" | Throwaway probe at 6c2f4a1: `नमस्ते`, `สวัสดี`, `שָׁלוֹם` all return 400 "may contain only letters, digits and spaces"; `account.dto.ts:5`; C10 tests only Latin and Greek | allow `\p{M}` in the character class (or decide in the plan that such names are out and say so) and add C10 cases for a Devanagari, a Thai and a niqqud name | 7607372 - `\p{M}` allowed; C10 now proves Devanagari, Thai, niqqud names |
| `ACCOUNT_LIMIT` with surrounding spaces or leading zeros stops startup: `" 5"`, `"5 "`, `"05"`, `"005"` all throw although `"05"` is a whole number >= 1 and the plan says only non-whole or < 1 values fail | Probe: `getLedgerConfig()` throws for each; `config.ts:19` regex `^[1-9][0-9]*$` with no trim; C23/C24 name neither form | decide the contract (trim and accept `05`, or reject and state it in AC S4.6) and add the values to C23 or C24 | 7607372 - contract decided (trim, leading zeros ok; plan Assumptions); C23 and C24 carry the new values |
| C6 proves a same-name and casing-only rename only against the in-memory mock | `account.service.test.ts` C6 uses `MockAccountRepository`; the real `isNameTaken(userId, name, excludeId)` and the `update` unique-key path are not run for it (probe at HEAD shows they work today, so a regression would pass unseen) | add a rename `Cash` -> `cash` and `Cash` -> `Cash` on the same account to the router or repository test with real SQLite | 7607372 - second C6 proof over HTTP with real SQLite (`Cash`, `cash`, padded `CASH`) |
| NFC normalization, the code-point length count and the NFD duplicate case have no test | `account.dto.ts` normalizes to NFC and counts `[...value]`; no test uses a decomposed name, an accented 30-char name or an astral letter (probe at HEAD: 30 `é`, 30 `é`, 30 `𝒜` accepted, 31 rejected; `Poupança` after `Poupança` returns 409) | add to C9/C13: 30 and 31 accented, NFD and astral names, and an NFD duplicate of an NFC name | 7607372 - C9 (decomposed and astral names), C11 (NFD saved composed), C13 (NFD duplicate) |
| C31 does not send an empty `X-User-Id` | `account.router.test.ts` C31 omits the header only; `account.controller.ts` `currentUserId` has a separate `length === 0` branch. A whitespace-only header (`" "`) is also accepted as a user id | send `X-User-Id:` empty in C31; decide whether a blank id is a 401 | 7607372 - C31 sends empty and blank headers; blank id is now 401 (plan Assumptions) |
