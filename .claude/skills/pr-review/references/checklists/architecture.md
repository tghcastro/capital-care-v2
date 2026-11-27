# Checklist: architecture

Source: [`docs/tech/definitions/architecture.md`](../../../../../docs/tech/definitions/architecture.md). ADRs: [001](../../../../../docs/adr/001-keep-business-rules-in-the-api.md), [002](../../../../../docs/adr/002-identity-as-a-separate-module.md).

1. **Apps wire, modules decide.** Business logic added under `apps/api` (beyond wiring and HTTP middleware) or `apps/web`. → `#api-layering--composition`, ADR-001.
2. **Layer order.** Controller → service → repository only; a controller calling a repository, or a service formatting HTTP responses. → `#api-layering--composition`.
3. **Aggregate boundary.** An aggregate importing another aggregate's repository or entity instead of its service. → `#api-layering--composition`.
4. **Module boundary.** Imports into another module or into a module's internals instead of its `index.ts` (ARCH-1, ARCH-3). Lint catches the import patterns; look for indirect ways around them (re-exports, dynamic imports). → `#architecture-lint-rules`.
5. **`index.ts` surface.** New exports of services, repositories or entities from a module's `index.ts`. → `#api-layering--composition`.
6. **Wiring.** A DI container, decorators or service locators instead of manual factory functions. → `#api-layering--composition`.
7. **Row types leak.** Drizzle row types used outside the repository; money handled with `number` math instead of `Decimal`; epoch integers instead of `Date` past the repository. → `#db-types-vs-domain-types`.
8. **Configuration.** Hardcoded paths, ports, secrets or connection strings; a new env variable missing from `.env.example`. → `#environment-configuration`.
9. **New dependency.** Does it duplicate something already in use, or belong in `devDependencies`? (The human-approval gate makes the owner look at every new library; here, judge only the fit.)
