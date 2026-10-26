import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
