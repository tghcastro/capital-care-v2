import { z } from 'zod';

// The name rules (required, length, characters, uniqueness) run in CategoryService, so `name`
// is not checked here beyond being passed on.
export const createCategorySchema = z.object({
  name: z.unknown().optional(),
  description: z.string().max(500).nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.unknown().optional(),
  description: z.string().max(500).nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
