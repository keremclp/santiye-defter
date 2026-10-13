import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState, type ReactNode } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { createQueryClient } from '../api/queries';
import { Loading } from '../components/ui/States';
import { ApiHandlers } from './guards';

function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ApiHandlers>{children}</ApiHandlers>
    </QueryClientProvider>
  );
}

export function Root() {
  return (
    <Providers>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
    </Providers>
  );
}

export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
