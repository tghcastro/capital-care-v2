# Checklist: web

Sources: [`docs/tech/definitions/web.md`](../../../../../docs/tech/definitions/web.md); UI files also [`design.md`](../../../../../docs/tech/definitions/design.md) (read only the sections for the components touched). ADR: [001](../../../../../docs/adr/001-keep-business-rules-in-the-api.md).

1. **Boundary.** Business rules computed in the web app (balances, validation rules beyond form UX) instead of asking the API; imports from `modules/` (ARCH-2). → `#app-boundary`, ADR-001.
2. **API client.** `fetch` called outside the shared API client in `packages/shared`; the acting-user header set anywhere else. → `#api-client`.
3. **Module resolution.** `.js` extensions or `NodeNext` assumptions inside `apps/web`; `Bundler`-only imports leaking into `packages/shared`. → `#module-resolution`.
4. **Security.** `dangerouslySetInnerHTML`; secrets in `VITE_*`; inline scripts that would break the planned CSP. → `#dependency-and-front-end-security`, `#same-origin-serving`.
5. **Folder layout.** New code outside the suggested layout (`routes/`, `components/`, `features/<aggregate>/`, `lib/`) without a reason. Suggestion only. → `#folder-layout`.
6. **Design (UI files only).** Colors, typography, spacing or components that ignore the design tokens and component specs; inaccessible controls (lint covers jsx-a11y basics). Usually suggestions, blocking only for a clear breach of a stated rule.
7. **Tests.** Network mocked with anything but MSW; `fetch` or TanStack Query internals mocked. → testing.md `#web`.
