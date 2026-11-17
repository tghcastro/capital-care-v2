import { createApiClient } from '@capital-care/shared';

/** The signed-in user. Hardcoded for now: the same user the API tests use. */
export const CURRENT_USER = { id: 'alice' } as const;

export const api = createApiClient({ baseUrl: '', userId: CURRENT_USER.id });
