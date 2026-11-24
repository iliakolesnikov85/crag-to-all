import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrag, deleteCrag, listCrags, patchCragSettings } from '../api/client';
import { setAuthAccount, type AuthAccount } from '../auth/session';
import { AppOnlineProvider } from '../context/AppOnlineContext';
import { chooseConfirm, withQueryClient } from '../test/helpers';
import type { Crag } from '../types';
import CragManagePage from './CragManagePage';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    listCrags: vi.fn(),
    createCrag: vi.fn(),
    deleteCrag: vi.fn(),
    patchCragSettings: vi.fn(),
  };
});

const updatedAt = '2026-01-02T03:04:05.000Z';

const crags: Crag[] = [
  {
    id: 'roshka',
    cragName: 'Roshka',
    source: 'explorer',
    sectorCount: 2,
    published: true,
    updatedAt,
    version: 4,
  },
  {
    id: 'empty-crag',
    cragName: 'Empty',
    source: 'external',
    externalId: '35366',
    sectorCount: 0,
    published: false,
    updatedAt,
    version: 1,
  },
];

function signIn(superadmin: boolean): void {
  const account: AuthAccount = {
    uid: superadmin ? 'super-user' : 'member-user',
    email: 'editor@example.com',
    emailVerified: true,
    superadmin,
    roles: superadmin ? null : {},
    getIdToken: async () => 'token',
  };
  setAuthAccount(account);
}

function renderPage() {
  return render(
    withQueryClient(
      <AppOnlineProvider>
        <MemoryRouter>
          <CragManagePage />
        </MemoryRouter>
      </AppOnlineProvider>,
    ),
  );
}

describe('CragManagePage', () => {
  beforeEach(() => {
    vi.mocked(listCrags).mockReset();
    vi.mocked(listCrags).mockResolvedValue(crags);
    vi.mocked(createCrag).mockReset();
    vi.mocked(deleteCrag).mockReset();
    vi.mocked(patchCragSettings).mockReset();
  });

  it('shows the catalog columns for a superadmin', async () => {
    signIn(true);
    renderPage();

    expect(await screen.findByRole('cell', { name: 'roshka' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Id' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sectors' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Published' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Updated' })).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /roshka/i });
    expect(within(row).getByText('roshka')).toBeInTheDocument();
    expect(within(row).getByText('Roshka')).toBeInTheDocument();
    expect(within(row).getByText('explorer')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByText('Yes')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Unpublish Roshka' })).not.toBeInTheDocument();
    expect(within(row).getByTitle(updatedAt)).toBeInTheDocument();
  });

  it('hides the page from anyone who is not a superadmin', async () => {
    signIn(false);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Id' })).not.toBeInTheDocument();
  });

  it('asks for an external id only when the new crag is external', async () => {
    signIn(true);
    vi.mocked(createCrag).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    expect(within(dialog).queryByLabelText('External id')).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Source'), { target: { value: 'external' } });
    expect(within(dialog).getByLabelText('External id')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Source'), { target: { value: 'explorer' } });
    expect(within(dialog).queryByLabelText('External id')).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Id'), { target: { value: 'new-crag' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New Crag' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createCrag).toHaveBeenCalledWith({
        id: 'new-crag',
        name: 'New Crag',
        source: 'explorer',
        country: 'GE',
      });
    });
  });

  it('renames an explorer crag with its catalog version and shows the saved name', async () => {
    signIn(true);
    const renamed: Crag[] = [
      { ...crags[0], cragName: 'Roshka Valley', version: 5 },
      crags[1],
    ];
    let saved = false;
    vi.mocked(listCrags).mockImplementation(async () => (saved ? renamed : crags));
    vi.mocked(patchCragSettings).mockImplementation(async () => {
      saved = true;
      return { name: 'Roshka Valley', version: 5 };
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Roshka' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit crag' });
    expect(within(dialog).queryByLabelText('External id')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: '  Roshka Valley  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchCragSettings).toHaveBeenCalledWith('roshka', 4, { name: 'Roshka Valley' });
    });
    expect(await screen.findByRole('cell', { name: 'Roshka Valley' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the editor open when the catalog version is stale', async () => {
    signIn(true);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = 'This crag was updated somewhere else. Reload the page and try again.';
    vi.mocked(patchCragSettings).mockRejectedValue(new Error(message));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Roshka' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit crag' });
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Roshka Valley' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(patchCragSettings).toHaveBeenCalledWith('roshka', 4, { name: 'Roshka Valley' });
    expect(screen.getByRole('dialog', { name: 'Edit crag' })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('opens an extracted crag without a name field', async () => {
    signIn(true);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Empty' }));
    const dialog = screen.getByRole('dialog', { name: 'Crag' });
    expect(within(dialog).getByLabelText('Id')).toHaveValue('empty-crag');
    expect(within(dialog).getByLabelText('Id')).toBeDisabled();
    expect(within(dialog).getByLabelText('Source')).toHaveValue('external');
    expect(within(dialog).getByLabelText('Source')).toBeDisabled();
    expect(within(dialog).getByLabelText('External id')).toHaveValue('35366');
    expect(within(dialog).getByLabelText('External id')).toBeDisabled();
    expect(within(dialog).queryByLabelText('Name')).not.toBeInTheDocument();
    expect(within(dialog).getByText(
      'The name cannot be changed. You can still change the country and Published.',
    )).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Published' })).not.toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('rejects the reserved crag id before creating', async () => {
    signIn(true);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    fireEvent.change(within(dialog).getByLabelText('Id'), { target: { value: 'crag-manage' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Manage' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByText('id is reserved')).toBeInTheDocument();
    expect(createCrag).not.toHaveBeenCalled();
  });

  it('keeps the shown country when Enter is pressed without a search', async () => {
    signIn(true);
    vi.mocked(createCrag).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    const country = within(dialog).getByLabelText('Country');
    expect(country).toHaveValue('Georgia (GE)');
    fireEvent.focus(country);
    fireEvent.keyDown(country, { key: 'Enter' });
    expect(country).toHaveValue('Georgia (GE)');

    fireEvent.change(within(dialog).getByLabelText('Id'), { target: { value: 'new-crag' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New Crag' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createCrag).toHaveBeenCalledWith({
        id: 'new-crag',
        name: 'New Crag',
        source: 'explorer',
        country: 'GE',
      });
    });
  });

  it('selects the best country match on Enter', async () => {
    signIn(true);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    const country = within(dialog).getByLabelText('Country');
    fireEvent.change(country, { target: { value: 'ge' } });
    fireEvent.keyDown(country, { key: 'Enter' });
    expect(country).toHaveValue('Georgia (GE)');

    fireEvent.change(country, { target: { value: 'Sudan' } });
    fireEvent.keyDown(country, { key: 'Enter' });
    expect(country).toHaveValue('Sudan (SD)');

    fireEvent.change(country, { target: { value: 'Turkey' } });
    fireEvent.keyDown(country, { key: 'Enter' });
    expect(country).toHaveValue('Türkiye (TR)');
  });

  it('chooses the highlighted country after the arrow keys', async () => {
    signIn(true);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const country = within(screen.getByRole('dialog', { name: 'Add crag' })).getByLabelText('Country');
    fireEvent.focus(country);
    fireEvent.keyDown(country, { key: 'ArrowDown' });
    fireEvent.keyDown(country, { key: 'Enter' });
    expect(country).toHaveValue('Afghanistan (AF)');
  });

  it('closes the country list on Escape and leaves the dialog open', async () => {
    signIn(true);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    const country = within(dialog).getByLabelText('Country');
    fireEvent.change(country, { target: { value: 'fra' } });
    expect(within(dialog).getByRole('option', { name: /^France/ })).toBeInTheDocument();
    fireEvent.keyDown(country, { key: 'Escape' });
    expect(country).toHaveValue('Georgia (GE)');
    expect(within(dialog).queryByRole('option', { name: /^France/ })).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  it('sends the country chosen from search', async () => {
    signIn(true);
    vi.mocked(createCrag).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add crag' }));

    const dialog = screen.getByRole('dialog', { name: 'Add crag' });
    fireEvent.change(within(dialog).getByLabelText('Country'), { target: { value: 'France' } });
    fireEvent.mouseDown(within(dialog).getByRole('option', { name: /^France/ }));
    fireEvent.change(within(dialog).getByLabelText('Id'), { target: { value: 'new-crag' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New Crag' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createCrag).toHaveBeenCalledWith({
        id: 'new-crag',
        name: 'New Crag',
        source: 'explorer',
        country: 'FR',
      });
    });
  });

  it('saves a country on an extracted crag', async () => {
    signIn(true);
    vi.mocked(patchCragSettings).mockResolvedValue({ version: 2, country: 'GE' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Empty' }));
    const dialog = screen.getByRole('dialog', { name: 'Crag' });
    expect(within(dialog).getByLabelText('Country')).toBeEnabled();
    expect(within(dialog).queryByLabelText('Name')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Country'), { target: { value: 'Georgia' } });
    fireEvent.mouseDown(within(dialog).getByRole('option', { name: /^Georgia/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchCragSettings).toHaveBeenCalledWith('empty-crag', 1, { country: 'GE' });
    });
  });

  it('offers delete only when the crag has no sectors', async () => {
    signIn(true);
    vi.mocked(deleteCrag).mockResolvedValue(undefined);
    renderPage();

    const roshka = await screen.findByRole('row', { name: /roshka/i });
    expect(within(roshka).getByRole('button', { name: 'Edit Roshka' })).toBeInTheDocument();
    expect(within(roshka).queryByRole('button', { name: 'Delete Roshka' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Empty' }));
    chooseConfirm('Delete crag', 'Delete');

    await waitFor(() => {
      expect(deleteCrag).toHaveBeenCalledWith('empty-crag');
    });
  });

  it('saves published from the edit dialog', async () => {
    signIn(true);
    vi.mocked(patchCragSettings).mockResolvedValue({ version: 5 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Roshka' }));
    const roshkaDialog = screen.getByRole('dialog', { name: 'Edit crag' });
    const roshkaPublished = within(roshkaDialog).getByRole('checkbox', { name: 'Published' });
    expect(roshkaPublished).toBeChecked();
    fireEvent.click(roshkaPublished);
    fireEvent.click(within(roshkaDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(patchCragSettings).toHaveBeenCalledWith('roshka', 4, { published: false });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Empty' }));
    const emptyDialog = screen.getByRole('dialog', { name: 'Crag' });
    const emptyPublished = within(emptyDialog).getByRole('checkbox', { name: 'Published' });
    expect(emptyPublished).not.toBeChecked();
    fireEvent.click(emptyPublished);
    fireEvent.click(within(emptyDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(patchCragSettings).toHaveBeenCalledWith('empty-crag', 1, { published: true });
    });
  });
});
