import { useState } from 'react';
import { NONE } from '../transaction/ledgerView';
import { Button, Card, Dialog, Field, inputClass } from '../../components/ui';

export interface PanelItem {
  id: string;
  name: string;
  description?: string | null | undefined;
}

export interface PanelValues {
  name: string;
  /** On edit an empty description is sent as null so it can be cleared. */
  description?: string | null;
}

interface Props {
  title: string; // "Categories"
  noun: string; // "category"
  noneLabel: string; // "Uncategorized"
  withDescription: boolean;
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
  const { title, noun, noneLabel, items, selected, onToggle } = props;
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const sorted = [...items].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
  const entries: PanelItem[] = [{ id: NONE, name: noneLabel }, ...sorted];

  return (
    <Card className="min-w-0">
      <section aria-label={title}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button
            variant="outline"
            className="whitespace-nowrap"
            onClick={() => setDialogue({ kind: 'add' })}
          >
            Add {noun}
          </Button>
        </div>
        <ul className="space-y-1">
          {entries.map((item) => {
            const real = item.id !== NONE;
            const on = selected.has(item.id);
            return (
              <li key={item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(item.id)}
                  className={`flex-1 rounded-control px-3 py-2 text-left text-sm font-medium ${
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
          item={dialogue.kind === 'edit' ? dialogue.item : null}
          onClose={() => setDialogue(null)}
        />
      ) : null}
      {dialogue?.kind === 'delete' ? (
        <DeleteDialog
          item={dialogue.item}
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
  item,
  onSave,
  onClose,
}: Props & { item: PanelItem | null; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
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
  onDelete,
  onClose,
}: {
  item: PanelItem;
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
