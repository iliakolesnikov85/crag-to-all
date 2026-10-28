import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchCragDescription } from '../api/client';
import { canEditCrag } from '../api/permissions';
import { CragContext } from '../context/CragContext';
import type { DescriptionSection } from '../types';
import { paragraphsToHtml } from '../utils/descriptionHtml';
import DescriptionPage from './DescriptionPage';

vi.mock('../api/permissions', () => ({
  canEditCrag: vi.fn(() => true),
}));

vi.mock('../api/client', () => ({
  patchCragDescription: vi.fn(),
}));

vi.mock('../components/RichTextInput', () => ({
  default: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (html: string) => void;
  }) => (
    <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

const cragValue = {
  crag: { cragId: 'shulaveri', cragName: 'Shulaveri' },
  getUrl: (url: string) => url,
};

const sections: DescriptionSection[] = [
  {
    subheader: 'Access',
    paragraphs: ['<strong>Park</strong> at the lot.', 'Walk ten minutes.'],
  },
  {
    subheader: 'Season',
    paragraphs: ['Best in autumn.'],
  },
];

function renderPage(description: DescriptionSection[] = sections, version?: number) {
  const onDescriptionChange = vi.fn();
  render(
    <CragContext.Provider value={cragValue}>
      <DescriptionPage
        description={description}
        version={version}
        onDescriptionChange={onDescriptionChange}
      />
    </CragContext.Provider>,
  );
  return { onDescriptionChange };
}

describe('DescriptionPage', () => {
  beforeEach(() => {
    vi.mocked(canEditCrag).mockReturnValue(true);
    vi.mocked(patchCragDescription).mockReset();
  });

  it('renders every section and HTML paragraph', () => {
    renderPage(sections, 3);

    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
    expect(screen.getByText('Park')).toBeInTheDocument();
    expect(screen.getByText('Walk ten minutes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Season' })).toBeInTheDocument();
    expect(screen.getByText('Best in autumn.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add section' })).toBeInTheDocument();
  });

  it('shows a loading message when a visitor has no description', () => {
    vi.mocked(canEditCrag).mockReturnValue(false);
    renderPage([]);

    expect(screen.getByText('Loading description...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Access' })).not.toBeInTheDocument();
  });

  it('hides edit controls when the user cannot manage the crag', () => {
    vi.mocked(canEditCrag).mockReturnValue(false);
    renderPage(sections, 3);

    expect(screen.queryByRole('button', { name: 'Edit Access' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Access' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add section' })).not.toBeInTheDocument();
  });

  it('opens an editor filled with the section name and HTML', () => {
    renderPage(sections, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit section' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Access');
    expect(within(dialog).getByRole('textbox', { name: 'Contents' })).toHaveValue(
      paragraphsToHtml(sections[0].paragraphs),
    );
  });

  it('saves an edited section through the API', async () => {
    vi.mocked(patchCragDescription).mockImplementation(async (_cragId, _version, description) => ({
      description,
      version: 4,
    }));
    const { onDescriptionChange } = renderPage(sections, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit section' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Approach' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    const paragraphs = [paragraphsToHtml(sections[0].paragraphs)];
    await waitFor(() => {
      expect(patchCragDescription).toHaveBeenCalledWith('shulaveri', 3, [
        { subheader: 'Approach', paragraphs },
        sections[1],
      ]);
    });
    expect(onDescriptionChange).toHaveBeenCalledWith({
      description: [
        { subheader: 'Approach', paragraphs },
        sections[1],
      ],
      version: 4,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('adds a section and keeps the dialog open when saving fails', async () => {
    const { onDescriptionChange } = renderPage(sections, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));

    const dialog = screen.getByRole('dialog', { name: 'Add section' });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'History' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Contents' }), {
      target: { value: '<p>First ascent in 2025.</p>' },
    });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();

    vi.mocked(patchCragDescription).mockRejectedValue(new Error('version conflict'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('version conflict');
    expect(onDescriptionChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not save a block that exceeds the API limit', () => {
    renderPage(sections, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit section' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Contents' }), {
      target: { value: 'a'.repeat(20_001) },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('20000 characters or fewer');
    expect(patchCragDescription).not.toHaveBeenCalled();
  });

  it('refuses to save when the guard returns false', () => {
    renderPage(sections, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));
    vi.mocked(canEditCrag).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('permission');
    expect(patchCragDescription).not.toHaveBeenCalled();
  });

  it('shows an error instead of saving when the crag has no version', () => {
    renderPage(sections, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('no version');
    expect(patchCragDescription).not.toHaveBeenCalled();
  });

  it('removes a section after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(patchCragDescription).mockImplementation(async (_cragId, _version, description) => ({
      description,
      version: 4,
    }));
    const { onDescriptionChange } = renderPage(sections, 3);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Access' }));

    await waitFor(() => {
      expect(patchCragDescription).toHaveBeenCalledWith('shulaveri', 3, [sections[1]]);
    });
    expect(onDescriptionChange).toHaveBeenCalledWith({
      description: [sections[1]],
      version: 4,
    });
    vi.mocked(window.confirm).mockRestore();
  });

  it('leaves the description unchanged when removal is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage(sections, 3);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Season' }));

    expect(patchCragDescription).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Season' })).toBeInTheDocument();
    vi.mocked(window.confirm).mockRestore();
  });
});
