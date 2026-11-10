import { Router, type Request, type Response } from 'express';
import { createCategorySchema, updateCategorySchema } from './category.dto.js';
import type { CategoryService } from './category.service.js';
import { ValidationError, ConflictError, NotFoundError } from '../shared/errors.js';

export function createCategoryRouter(service: CategoryService): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    try {
      const userIdHeader = req.headers['x-user-id'];
      if (typeof userIdHeader !== 'string') {
        return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
      }
      const userId: string = userIdHeader;
      const parsed = createCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          type: 'ValidationError',
          detail: parsed.error.issues[0]?.message || 'Invalid input',
        });
      }

      const category = service.createCategory({
        ...parsed.data,
        userId: userId as string,
      });

      return res.status(201).json(serializeCategory(category));
    } catch (err) {
      if (err instanceof ConflictError) {
        return res.status(409).json({ type: 'ConflictError', detail: err.message });
      }
      if (err instanceof ValidationError) {
        return res.status(400).json({ type: 'ValidationError', detail: err.message });
      }
      throw err;
    }
  });

  router.get('/', (req: Request, res: Response) => {
    try {
      const userIdHeader = req.headers['x-user-id'];
      if (typeof userIdHeader !== 'string') {
        return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
      }
      const userId: string = userIdHeader;

      const sort = (req.query.sort as string) || 'name';
      const categories = service.listCategories(userId, sort);

      return res.status(200).json({ categories: categories.map(serializeCategory) });
    } catch (err) {
      throw err;
    }
  });

  router.get('/:id', (req: Request, res: Response) => {
    try {
      const userIdHeader = req.headers['x-user-id'];
      if (typeof userIdHeader !== 'string') {
        return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
      }
      const userId: string = userIdHeader;

      const category = service.getCategory(req.params.id, userId);
      return res.status(200).json(serializeCategory(category));
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ type: 'NotFoundError', detail: err.message });
      }
      throw err;
    }
  });

  router.patch('/:id', (req: Request, res: Response) => {
    try {
      const userIdHeader = req.headers['x-user-id'];
      if (typeof userIdHeader !== 'string') {
        return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
      }
      const userId: string = userIdHeader;

      const parsed = updateCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          type: 'ValidationError',
          detail: parsed.error.issues[0]?.message || 'Invalid input',
        });
      }

      const category = service.updateCategory(req.params.id, {
        ...parsed.data,
        userId,
      });

      return res.status(200).json(serializeCategory(category));
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ type: 'NotFoundError', detail: err.message });
      }
      if (err instanceof ConflictError) {
        return res.status(409).json({ type: 'ConflictError', detail: err.message });
      }
      if (err instanceof ValidationError) {
        return res.status(400).json({ type: 'ValidationError', detail: err.message });
      }
      throw err;
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const userIdHeader = req.headers['x-user-id'];
      if (typeof userIdHeader !== 'string') {
        return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
      }
      const userId: string = userIdHeader;

      service.deleteCategory(req.params.id, userId);
      return res.status(204).send();
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ type: 'NotFoundError', detail: err.message });
      }
      if (err instanceof ConflictError) {
        return res.status(409).json({ type: 'ConflictError', detail: err.message });
      }
      throw err;
    }
  });

  return router;
}

function serializeCategory(category: any) {
  return {
    id: category.id,
    userId: category.userId,
    name: category.name,
    description: category.description,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
