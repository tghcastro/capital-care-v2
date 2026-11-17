import { createTransactionSchema, type Account, type Category } from '@capital-care/shared';
import { useState } from 'react';
import { useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { Button, Card, Field, compactInput as inputClass } from '../../components/ui';
import { api } from '../../lib/api';

interface FormValues {
  date: string;
  description: string;
  accountId: string;
  categoryId: string;
  amount: string;
  type: 'receipt' | 'debit';
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'annually' | 'instalments';
  instalmentNumber: string;
  instalmentTotal: string;
}

function payloadOf(values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    date: values.date,
    description: values.description,
    categoryId: values.categoryId,
    accountId: values.accountId,
    amount: values.amount,
    type: values.type,
  };
  if (values.repeat === 'instalments') {
    payload.instalment = {
      number: Number(values.instalmentNumber),
      total: Number(values.instalmentTotal),
    };
  } else if (values.repeat !== 'none') {
    payload.recurrence = values.repeat;
  }
  return payload;
}

const fieldOf: Record<string, keyof FormValues | 'root'> = {
  date: 'date',
  description: 'description',
  categoryId: 'categoryId',
  accountId: 'accountId',
  amount: 'amount',
  type: 'type',
  recurrence: 'repeat',
  instalment: 'instalmentNumber',
};

/** Validates with the shared request schema so messages match the API's. */
const resolver: Resolver<FormValues> = (values) => {
  const parsed = createTransactionSchema.safeParse(payloadOf(values));
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<FormValues> = {};
  for (const issue of parsed.error.issues) {
    const head = String(issue.path[0] ?? '');
    let field = fieldOf[head] ?? 'root';
    if (head === 'instalment' && issue.path[1] === 'total') field = 'instalmentTotal';
    const key = field === 'root' ? 'repeat' : field;
    if (!errors[key]) errors[key] = { type: 'validate', message: issue.message };
  }
  return { values: {}, errors };
};

interface Props {
  categories: Category[];
  accounts: Account[];
  defaultDate: string;
  onCreated: () => void;
}

function emptyValues(date: string): FormValues {
  return {
    date,
    description: '',
    accountId: '',
    categoryId: '',
    amount: '',
    type: 'debit',
    repeat: 'none',
    instalmentNumber: '1',
    instalmentTotal: '2',
  };
}

export function QuickAdd({ categories, accounts, defaultDate, onCreated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver, defaultValues: emptyValues(defaultDate) });
  const repeat = useWatch({ control, name: 'repeat' });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.createTransaction(createTransactionSchema.parse(payloadOf(values)));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Something went wrong');
      return;
    }
    reset(emptyValues(values.date));
    onCreated();
  });

  return (
    <Card className="px-5 py-3">
      <form aria-label="Quick add transaction" onSubmit={submit} noValidate className="space-y-3">
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[9.5rem_minmax(0,1fr)_7rem_9.5rem_9.5rem_6.5rem_auto]">
          <Field label="Date" error={errors.date?.message}>
            <input type="date" className={inputClass} {...register('date')} />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <input className={inputClass} {...register('description')} />
          </Field>
          <Field label="Amount" error={errors.amount?.message}>
            <input inputMode="decimal" className={inputClass} {...register('amount')} />
          </Field>
          <Field label="Category" error={errors.categoryId?.message}>
            <select className={inputClass} {...register('categoryId')}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account" error={errors.accountId?.message}>
            <select className={inputClass} {...register('accountId')}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className={inputClass} {...register('type')}>
              <option value="debit">Debit</option>
              <option value="receipt">Credit</option>
            </select>
          </Field>
          <div className="flex gap-2 self-end sm:col-span-2 lg:col-span-1">
            <Button type="submit" disabled={isSubmitting}>
              Add transaction
            </Button>
            <Button
              variant="outline"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded((v) => !v);
                if (expanded) setValue('repeat', 'none');
              }}
            >
              More details
            </Button>
          </div>
        </div>
        {expanded ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Repeat" error={errors.repeat?.message}>
              <select className={inputClass} {...register('repeat')}>
                <option value="none">Does not repeat</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
                <option value="annually">annually</option>
                <option value="instalments">Instalments</option>
              </select>
            </Field>
            {repeat === 'instalments' ? (
              <>
                <Field label="Instalment number" error={errors.instalmentNumber?.message}>
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    {...register('instalmentNumber')}
                  />
                </Field>
                <Field label="Instalment total" error={errors.instalmentTotal?.message}>
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    {...register('instalmentTotal')}
                  />
                </Field>
              </>
            ) : null}
          </div>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-error">
            {serverError}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
