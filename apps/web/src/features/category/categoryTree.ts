/** Something that nests like the API's category tree. */
interface Nested<T> {
  id: string;
  name: string;
  children?: T[] | undefined;
}

export interface Flat<T> {
  item: T;
  /** 1 for a top-level category, 2 for a child, 3 for a grandchild. */
  depth: number;
}

/** The tree the API returned, depth-first in its order: each category before its children. */
export function flattenTree<T extends Nested<T>>(nodes: readonly T[], depth = 1): Flat<T>[] {
  return nodes.flatMap((item) => [{ item, depth }, ...flattenTree(item.children ?? [], depth + 1)]);
}

/** The ids of the category and every category under it. */
export function branchIds<T extends Nested<T>>(node: T): string[] {
  return flattenTree([node]).map((f) => f.item.id);
}

/** The name indented by tier with no-break spaces, for a select option. */
export function indented<T extends Nested<T>>({ item, depth }: Flat<T>): string {
  return `${'    '.repeat(depth - 1)}${item.name}`;
}
