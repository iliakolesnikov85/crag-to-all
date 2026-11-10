import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setBodyScrollLock } from '../utils/bodyScrollLock';
import Modal from './Modal';

describe('Modal', () => {
  it('focuses the dialog without scrolling the page', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(
      <Modal open title="Edit section" onClose={() => {}}>
        <input aria-label="Section name" />
      </Modal>,
    );

    expect(screen.getByRole('textbox', { name: 'Section name' })).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('renders the dialog, title, and footer', () => {
    render(
      <Modal
        open
        title="Edit section"
        onClose={() => {}}
        footer={<button type="button">Save</button>}
      >
        <p>Section form</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Edit section' })).toBeInTheDocument();
    expect(screen.getByText('Section form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(document.documentElement.classList.contains('scroll-locked')).toBe(true);
  });

  it('calls onClose for Escape, the backdrop, and the close button', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Add section" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.querySelector('.modal-backdrop') as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('stays open when the backdrop is pressed and backdrop closing is off', () => {
    const onClose = vi.fn();
    render(
      <Modal open closeOnBackdrop={false} title="Edit sector" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    fireEvent.mouseDown(document.querySelector('.modal-backdrop') as Element);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit sector' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open when the press starts inside it', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Add section" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing and unlocks scroll when closed', () => {
    const view = render(
      <Modal open title="Add section" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );
    expect(document.documentElement.classList.contains('scroll-locked')).toBe(true);

    view.rerender(
      <Modal open={false} title="Add section" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains('scroll-locked')).toBe(false);
  });

  it('keeps Escape from reaching other document listeners', () => {
    const onClose = vi.fn();
    const onDocumentEscape = vi.fn();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDocumentEscape();
    };
    document.addEventListener('keydown', handleKeyDown);
    try {
      render(
        <Modal open title="Delete marker" onClose={onClose}>
          <p>Delete the marker?</p>
        </Modal>,
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onDocumentEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  it('closes only the top dialog when Escape is pressed', () => {
    const closeList = vi.fn();
    const closeDetails = vi.fn();
    render(
      <>
        <Modal open title="Routes" onClose={closeList}>
          <p>List</p>
        </Modal>
        <Modal open title="Edit route" onClose={closeDetails}>
          <p>Details</p>
        </Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeDetails).toHaveBeenCalledTimes(1);
    expect(closeList).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the top dialog', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Modal open title="Routes" onClose={() => {}}>
          <input aria-label="Filter routes" />
        </Modal>
        <Modal
          open
          title="Edit route"
          onClose={() => {}}
          footer={<button type="button">Save</button>}
        >
          <input aria-label="Route name" />
        </Modal>
      </>,
    );

    const edit = screen.getByRole('dialog', { name: 'Edit route' });
    const close = within(edit).getByRole('button', { name: 'Close' });
    const save = within(edit).getByRole('button', { name: 'Save' });
    const outside = screen.getByRole('button', { name: 'Outside' });

    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();

    save.focus();
    fireEvent.keyDown(save, { key: 'Tab', ctrlKey: true });
    expect(save).toHaveFocus();

    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(close).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Filter routes' })).not.toHaveFocus();

    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
  });

  it('keeps an outer scroll lock when the dialog closes', () => {
    setBodyScrollLock(true);
    try {
      const view = render(
        <Modal open title="Use photo location?" onClose={() => {}}>
          <p>This photo was taken elsewhere.</p>
        </Modal>,
      );

      view.rerender(
        <Modal open={false} title="Use photo location?" onClose={() => {}}>
          <p>This photo was taken elsewhere.</p>
        </Modal>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.documentElement).toHaveClass('scroll-locked');
    } finally {
      setBodyScrollLock(false);
    }
  });
});
