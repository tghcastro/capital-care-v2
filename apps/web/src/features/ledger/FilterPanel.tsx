import { useState } from 'react';
import { flattenTree, indented, type Flat } from '../category/categoryTree';
import { NONE } from '../transaction/ledgerView';
import { Button, Card, Dialog, Field, inputClass } from '../../components/ui';

export interface PanelItem {
  id: string;
  name: string;
  description?: string | null | undefined;
  /** Tree mode: null on a top-level item. */
  parentId?: string | null | undefined;
  /** Tree mode: the items nested under this one, in the API's order. */
  children?: PanelItem[] | undefined;
}

export interface PanelValues {
  name: string;
  /** On edit an empty description is sent as null so it can be cleared. */
  description?: string | null;
  /** Tree mode: sent only when it differs from today; null moves to the top level. */
  parentId?: string | null;
}

type Row = Flat<PanelItem>;

const INDENT = ['', 'pl-6', 'pl-12'];

interface Props {
  title: string; // "Categories"
  noun: string; // "category"
  noneLabel: string; // "Uncategorized"
  withDescription: boolean;
  /**
   * Items nest through `children` and arrive ordered: roots start expanded, deeper items
   * collapsed; the dialogs offer a Parent and the delete confirmation counts the branch.
   */
  tree?: boolean;
  items: PanelItem[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSave: (id: string | null, values: PanelValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type Dialogue =
  { kind: 'add' } | { kind: 'edit'; item: PanelItem } | { kind: 'delete'; item: PanelItem } | null;

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function FilterPanel(props: Props) {
  const { title, noun, noneLabel, items, selected, onToggle, tree = false } = props;
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  // Expanded state the user chose; otherwise top-level items are expanded and others collapsed.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ordered = tree
    ? items
    : [...items].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const isExpanded = (row: Row) => expanded[row.item.id] ?? row.depth === 1;
  const expand = (id: string, open: boolean) => setExpanded((e) => ({ ...e, [id]: open }));

  const rows: Row[] = [{ item: { id: NONE, name: noneLabel }, depth: 1 }];
  const visit = (level: readonly PanelItem[], depth: number) => {
    for (const item of level) {
      const row = { item, depth };
      rows.push(row);
      if (tree && isExpanded(row)) visit(item.children ?? [], depth + 1);
    }
  };
  visit(ordered, 1);

  const onSave = async (id: string | null, values: PanelValues) => {
    await props.onSave(id, values);
    if (values.parentId) expand(values.parentId, true);
  };

  return (
    <Card className="min-w-0">
      <section aria-label={title}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button
            variant="outline"
            className="whitespace-nowrap !px-3 text-xs"
            onClick={() => setDialogue({ kind: 'add' })}
          >
            Add {noun}
          </Button>
        </div>
        <ul className="space-y-1">
          {rows.map((row) => {
            const { item, depth } = row;
            const real = item.id !== NONE;
            const on = selected.has(item.id);
            const hasChildren = (item.children ?? []).length > 0;
            const open = isExpanded(row);
            return (
              <li
                key={item.id}
                className={`flex items-center gap-1 ${tree ? (INDENT[depth - 1] ?? '') : ''}`}
              >
                {tree && real ? (
                  hasChildren ? (
                    <button
                      type="button"
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${item.name}`}
                      aria-expanded={open}
                      onClick={() => expand(item.id, !open)}
                      className="w-6 shrink-0 rounded-full text-muted hover:bg-mint-50"
                    >
                      <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                    </button>
                  ) : (
                    <span aria-hidden="true" className="w-6 shrink-0" />
                  )
                ) : null}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(item.id)}
                  className={`min-w-0 flex-1 truncate rounded-control px-3 py-2 text-left text-sm font-medium ${
                    on ? 'bg-mint-100 font-bold text-primary-deep' : 'hover:bg-mint-50'
                  }`}
                >
                  {item.name}
                </button>
                {real ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setDialogue({ kind: 'edit', item })}
                      className="rounded-full p-2 text-muted hover:bg-mint-50"
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => setDialogue({ kind: 'delete', item })}
                      className="rounded-full p-2 text-muted hover:bg-mint-50"
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      {dialogue?.kind === 'add' || dialogue?.kind === 'edit' ? (
        <SaveDialog
          {...props}
          tree={tree}
          onSave={onSave}
          item={dialogue.kind === 'edit' ? dialogue.item : null}
          onClose={() => setDialogue(null)}
        />
      ) : null}
      {dialogue?.kind === 'delete' ? (
        <DeleteDialog
          item={dialogue.item}
          tree={tree}
          onDelete={props.onDelete}
          onClose={() => setDialogue(null)}
        />
      ) : null}
    </Card>
  );
}

function SaveDialog({
  noun,
  withDescription,
  tree,
  items,
  item,
  onSave,
  onClose,
}: Props & { item: PanelItem | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [parent, setParent] = useState(item?.parentId ?? '');
  const parents = flattenTree(items).filter((row) => row.item.id !== item?.id);
  const [description, setDescription] = useState(item?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) {
      setError('name is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const values: PanelValues = { name: name.trim() };
      if (withDescription) {
        const text = description.trim();
        if (text) values.description = text;
        else if (item) values.description = null;
      }
      if (tree) {
        const parentId = parent === '' ? null : parent;
        if (parentId !== (item?.parentId ?? null)) values.parentId = parentId;
      }
      await onSave(item?.id ?? null, values);
      onClose();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <Dialog title={`${item ? 'Edit' : 'Add'} ${noun}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {withDescription ? (
          <Field label="Description">
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        ) : null}
        {tree ? (
          <Field label="Parent">
            <select
              className={inputClass}
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">None (top level)</option>
              {parents.map((row) => (
                <option key={row.item.id} value={row.item.id}>
                  {indented(row)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({
  item,
  tree,
  onDelete,
  onClose,
}: {
  item: PanelItem;
  tree: boolean;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onDelete(item.id);
      onClose();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  return (
    <Dialog title={`Delete ${item.name}?`}>
      {tree ? <p className="mb-4 text-sm">{deleteWarning(item)}</p> : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-error">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy}>
          Delete
        </Button>
      </div>
    </Dialog>
  );
}

/** What a delete removes: the item and its whole branch, permanently. */
function deleteWarning(item: PanelItem): string {
  const count = flattenTree([item]).length;
  return count === 1
    ? 'This permanently removes this category. Its transactions become uncategorized.'
    : `This permanently removes ${count} categories: ${item.name} and its ${count - 1} subcategories. Their transactions become uncategorized.`;
}
