import { useQuery } from '@tanstack/react-query';

// "up" only for a 200 response whose body is exactly {"status":"ok"}.
async function fetchHealth(): Promise<true> {
  const response = await fetch('/health');
  if (response.status !== 200) throw new Error(`Unexpected status ${response.status}`);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ok') {
    throw new Error('Unexpected health body');
  }
  return true;
}

export function HealthPage() {
  const { isPending, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  const message = isPending ? 'Checking API…' : isError ? 'API is unreachable' : 'API is up';

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Capital Care</h1>
      <p role="status" className="mt-4 text-gray-700">
        {message}
      </p>
    </main>
  );
}
