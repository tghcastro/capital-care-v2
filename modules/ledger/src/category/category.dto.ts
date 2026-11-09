import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'name is required').max(255, 'name must not exceed 255 characters'),
  description: z.string().max(500).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().max(255, 'name must not exceed 255 characters').optional(),
  description: z.string().max(500).nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
