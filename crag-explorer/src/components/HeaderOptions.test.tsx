import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { setAuthAccount } from '../auth/session';
import { signInTestUser } from '../test/authAccount';
import Header from './Header';

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('HeaderOptions', () => {
  it('opens crag management for a superadmin', () => {
    signInTestUser();
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Crags' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/crag-manage');
  });

  it('hides the menu when the user is not a superadmin', () => {
    setAuthAccount(null);
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
