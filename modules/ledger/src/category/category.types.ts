export interface Category {
  id: string;
  userId: string;
  /** Null on a top-level category. */
  parentId: string | null;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A category with its children, as the list returns it. */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}
