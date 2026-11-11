import { Router, type Request, type Response } from 'express';
import { createAccountSchema, updateAccountSchema } from './account.dto.js';
import type { AccountService } from './account.service.js';
import type { Account } from './account.types.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export function createAccountRouter(service: AccountService): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const parsed = createAccountSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error.issues[0]?.message);

    return respond(res, () => res.status(201).json(serialize(service.createAccount({ userId, ...parsed.data }))));
  });

  router.get('/', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    return respond(res, () =>
      res.status(200).json({ accounts: service.listAccounts(userId).map(serialize) }),
    );
  });

  router.patch('/:id', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    const parsed = updateAccountSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendValidationError(res, parsed.error.issues[0]?.message);

    return respond(res, () =>
      res.status(200).json(serialize(service.renameAccount(req.params.id, { userId, ...parsed.data }))),
    );
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const userId = currentUserId(req, res);
    if (!userId) return;

    return respond(res, () => {
      service.deleteAccount(req.params.id, userId);
      return res.status(204).send();
    });
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

function serialize(account: Account) {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
