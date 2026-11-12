import { Router, type Request, type Response } from 'express';
import {
  createTransactionSchema,
  monthSchema,
  settleSchema,
  updateTransactionSchema,
} from './transaction.dto.js';
import type { TransactionService } from './transaction.service.js';
import type { Transaction } from './transaction.types.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export function createTransactionRouter(service: TransactionService): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const parsed = createTransactionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error.issues[0]?.message);

    return respond(res, () =>
      res.status(201).json(serializeTransaction(service.createTransaction(userId, parsed.data))),
    );
  });

  router.get('/', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const month = monthSchema.safeParse(req.query.month);
    if (!month.success) return sendValidationError(res, month.error.issues[0]?.message);

    return respond(res, () =>
      res.status(200).json({ occurrences: service.listMonth(userId, month.data) }),
    );
  });

  router.patch('/:id/occurrences/:date', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const parsed = updateTransactionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error.issues[0]?.message);

    return respond(res, () =>
      res
        .status(200)
        .json(service.editOccurrence(userId, req.params.id, req.params.date, parsed.data)),
    );
  });

  router.delete('/:id/occurrences/:date', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    return respond(res, () => {
      service.stopFrom(userId, req.params.id, req.params.date);
      return res.status(204).send();
    });
  });

  router.put('/:id/occurrences/:date/settlement', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const parsed = settleSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error.issues[0]?.message);

    return respond(res, () =>
      res.status(200).json(service.settle(userId, req.params.id, req.params.date, parsed.data)),
    );
  });

  router.delete('/:id/occurrences/:date/settlement', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    return respond(res, () =>
      res.status(200).json(service.unsettle(userId, req.params.id, req.params.date)),
    );
  });

  return router;
}

function currentUserId(req: Request, res: Response): string | null {
  const header = req.headers['x-user-id'];
  if (typeof header !== 'string' || header.trim().length === 0) {
    res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
    return null;
  }
  return header;
}

function sendValidationError(res: Response, detail: string | undefined): Response {
  return res.status(400).json({ type: 'ValidationError', detail: detail ?? 'Invalid input' });
}

function respond(res: Response, action: () => Response): Response {
  try {
    return action();
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ type: 'NotFoundError', detail: err.message });
    }
    if (err instanceof ConflictError) {
      return res.status(409).json({ type: 'ConflictError', detail: err.message });
    }
    if (err instanceof ValidationError) return sendValidationError(res, err.message);
    throw err;
  }
}

function serializeTransaction(transaction: Transaction) {
  return {
    ...transaction,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}
