/**
 * The logger a module writes business records through. `apps/api` passes its pino instance at
 * composition (AD-014); tests pass a fake that keeps the records.
 */
export interface LedgerLogger {
  info(record: Record<string, unknown>, message: string): void;
}

export const silentLogger: LedgerLogger = {
  info: () => undefined,
};
