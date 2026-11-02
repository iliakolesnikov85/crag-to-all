import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setBodyScrollLock } from '../utils/bodyScrollLock';
import Modal from './Modal';

describe('Modal', () => {
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
