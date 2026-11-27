# Checklist: testing

Source: [`docs/tech/definitions/testing.md`](../../../../../docs/tech/definitions/testing.md).

1. **Missing tests.** New or changed service logic (each business branch) without unit tests; a new repository query without an integration test. → `#test-levels-test-pyramid`.
2. **Right level.** Unit tests touching a real DB or native bindings; integration tests mocking the aggregate's own repository; component tests in the wrong folder. → `#test-levels-test-pyramid`, `#test-location`.
3. **Location.** Tests outside the aggregate's `__test__/` or `apps/api/test/`; acceptance tests added to this repository (they belong in capital-care-tests). → `#test-location`.
4. **Coverage.** Thresholds lowered or real code excluded from coverage to pass. → `#coverage`.
5. **Test database.** Tests using the developer's database file instead of a fresh instance with the committed migrations. → `#test-database-strategy`.
6. **Weak tests.** Assertions that cannot fail, `.skip`/`.only` left in, tests that depend on order or wall-clock time. (The human-approval gate also flags `.skip`/`.only`.)
