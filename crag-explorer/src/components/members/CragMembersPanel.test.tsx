import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteCragMember,
  listCragMembers,
  lookupVerifiedAccount,
  upsertCragMember,
} from '../../api/client';
import { createAppQueryClient } from '../../api/queryClient';
import { setAuthAccount, type AuthAccount } from '../../auth/session';
import { CragContext } from '../../context/CragContext';
import type { Crag } from '../../types';
import CragMembersPanel from './CragMembersPanel';

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    listCragMembers: vi.fn(),
    lookupVerifiedAccount: vi.fn(),
    upsertCragMember: vi.fn(),
    deleteCragMember: vi.fn(),
  };
});

const explorerCrag: Crag = { id: 'roshka', cragName: 'Roshka', source: 'explorer', published: true };

const members = [
  { userId: 'admin-1', role: 'admin' as const, email: 'ada@example.com', name: 'Ada' },
  { userId: 'owner-1', role: 'owner' as const, email: 'owen@example.com', name: 'Owen' },
];

function signIn(account: Pick<AuthAccount, 'uid' | 'superadmin' | 'roles'>): void {
  setAuthAccount({
    email: `${account.uid}@example.com`,
    emailVerified: true,
    getIdToken: async () => 'token',
    ...account,
  });
}

function renderPanel(crag: Crag = explorerCrag) {
  const client = createAppQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CragContext.Provider value={{ crag, getUrl: (url) => url }}>
        <CragMembersPanel />
      </CragContext.Provider>
    </QueryClientProvider>,
  );
}

describe('CragMembersPanel', () => {
  beforeEach(() => {
    setAuthAccount(null);
    vi.mocked(listCragMembers).mockReset();
    vi.mocked(lookupVerifiedAccount).mockReset();
    vi.mocked(upsertCragMember).mockReset();
    vi.mocked(deleteCragMember).mockReset();
    vi.mocked(listCragMembers).mockResolvedValue(members);
    vi.mocked(upsertCragMember).mockResolvedValue(undefined);
    vi.mocked(deleteCragMember).mockResolvedValue(undefined);
  });

  it('stays hidden when signed out', () => {
    renderPanel();
    expect(screen.queryByRole('heading', { name: 'Authors' })).not.toBeInTheDocument();
  });

  it('stays hidden on an extracted crag', () => {
    signIn({ uid: 'owner-user', superadmin: false, roles: { shulaveri: 'owner' } });
    renderPanel({ id: 'shulaveri', cragName: 'Shulaveri', source: 'external', published: true });
    expect(screen.queryByRole('heading', { name: 'Authors' })).not.toBeInTheDocument();
  });

  it('shows the table without actions for an admin', async () => {
    signIn({ uid: 'admin-user', superadmin: false, roles: { roshka: 'admin' } });
    renderPanel();

    expect(await screen.findByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'User UID' })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Ada' })).not.toBeInTheDocument();
  });

  it('lets an owner add a verified account and not change another owner', async () => {
    signIn({ uid: 'owner-user', superadmin: false, roles: { roshka: 'owner' } });
    vi.mocked(lookupVerifiedAccount).mockResolvedValue({
      uid: 'ada-uid',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
    });
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Edit Ada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Owen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Ada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Owen' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    const dialog = screen.getByRole('dialog', { name: 'Add member' });
    const role = within(dialog).getByLabelText('Role');
    expect(within(role).getByRole('option', { name: 'Admin' })).toBeInTheDocument();
    expect(within(role).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'Ada@Example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Look up' }));

    expect(await within(dialog).findByText('ada-uid')).toBeInTheDocument();
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(lookupVerifiedAccount).toHaveBeenCalledWith('roshka', 'Ada@Example.com');

    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'someone-else@example.com' },
    });
    expect(within(dialog).queryByText('ada-uid')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Look up' }));
    expect(await within(dialog).findByText('ada-uid')).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(upsertCragMember).toHaveBeenCalledWith('roshka', 'ada-uid', 'admin');
    });
  });

  it('shows the lookup error when the email is not a verified account', async () => {
    signIn({ uid: 'owner-user', superadmin: false, roles: { roshka: 'owner' } });
    vi.mocked(lookupVerifiedAccount).mockRejectedValue(
      new Error('No verified account uses that email'),
    );
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = screen.getByRole('dialog', { name: 'Add member' });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'pending@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Look up' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No verified account uses that email',
    );
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('lets a superadmin choose the owner role', async () => {
    signIn({ uid: 'super-user', superadmin: true, roles: null });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Owen' }));
    const dialog = screen.getByRole('dialog', { name: 'Change member' });
    const role = within(dialog).getByLabelText('Role');
    expect(within(role).getByRole('option', { name: 'Owner' })).toBeInTheDocument();
    expect(within(dialog).getByText('owner-1')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Look up' })).not.toBeInTheDocument();
  });
});
