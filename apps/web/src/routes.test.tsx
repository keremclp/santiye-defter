import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('rotalar', () => {
  it('ana sayfada "Şantiye Hesap" başlığını gösterir', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Şantiye Hesap' })).toBeInTheDocument();
  });
});
