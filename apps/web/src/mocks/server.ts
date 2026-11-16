import { setupServer } from 'msw/node';

// Web tests never reach a real API: every request is answered by MSW.
export const server = setupServer();
