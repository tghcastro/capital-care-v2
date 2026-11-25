import { Router, type Request, type Response } from 'express';
import { createCategorySchema, updateCategorySchema } from './category.dto.js';
import type { CategoryService } from './category.service.js';
import type { Category, CategoryNode } from './category.types.js';
import { ValidationError, ConflictError, NotFoundError } from '../shared/errors.js';

// Named route params are always strings; Express 5 types only widen to string[] for wildcards.
type IdRequest = Request<{ id: string }>;

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

  router.get('/', (req: Request, res: Response) => {
    const userIdHeader = req.headers['x-user-id'];
    if (typeof userIdHeader !== 'string') {
      return res.status(401).json({ type: 'UnauthorizedError', detail: 'User ID required' });
    }
    const userId: string = userIdHeader;

    const sort = (req.query.sort as string) || 'name';
    const categories = service.listCategories(userId, sort);

    return res.status(200).json({ categories: categories.map(serializeNode) });
  });

  router.get('/:id', (req: IdRequest, res: Response) => {
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

  router.patch('/:id', (req: IdRequest, res: Response) => {
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

  router.delete('/:id', (req: IdRequest, res: Response) => {
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
      throw err;
    }
  });

  return router;
}

function serializeCategory(category: Category) {
  return {
    id: category.id,
    userId: category.userId,
    parentId: category.parentId,
    name: category.name,
    description: category.description,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function serializeNode(node: CategoryNode): ReturnType<typeof serializeCategory> & {
  children: unknown[];
} {
  return { ...serializeCategory(node), children: node.children.map(serializeNode) };
}
