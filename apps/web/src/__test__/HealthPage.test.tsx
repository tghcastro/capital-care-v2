import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { HealthPage } from '../HealthPage';
import { server } from '../mocks/server';

// Component: the health page rendered with the API answered by MSW.
function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HealthPage />
    </QueryClientProvider>,
  );
}

describe('HealthPage', () => {
  it('shows "Checking API…" while the request is pending', async () => {
    server.use(http.get('/health', () => new Promise<never>(() => undefined)));
    renderPage();
    expect(await screen.findByText('Checking API…')).toBeInTheDocument();
  });

  it('shows "API is up" for 200 with {"status":"ok"}', async () => {
    server.use(http.get('/health', () => HttpResponse.json({ status: 'ok' })));
    renderPage();
    expect(await screen.findByText('API is up')).toBeInTheDocument();
  });

  it('shows "API is unreachable" for a non-200 response', async () => {
    server.use(http.get('/health', () => new HttpResponse(null, { status: 503 })));
    renderPage();
    expect(await screen.findByText('API is unreachable')).toBeInTheDocument();
  });

  it('shows "API is unreachable" for 200 with another body', async () => {
    server.use(http.get('/health', () => HttpResponse.json({ status: 'degraded' })));
    renderPage();
    expect(await screen.findByText('API is unreachable')).toBeInTheDocument();
  });

  it('shows "API is unreachable" on a network error', async () => {
    server.use(http.get('/health', () => HttpResponse.error()));
    renderPage();
    expect(await screen.findByText('API is unreachable')).toBeInTheDocument();
  });
});
