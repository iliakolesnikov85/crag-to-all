import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { confirm, ConfirmProvider, type ConfirmOptions } from '../context/ConfirmContext';

function Ask({ options }: { options: ConfirmOptions }) {
  const [result, setResult] = useState('idle');
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm(options).then((ok) => setResult(ok ? 'yes' : 'no'));
        }}
      >
        Ask
      </button>
      <p>Result: {result}</p>
    </>
  );
}

function renderAsk(options: ConfirmOptions) {
  render(
    <ConfirmProvider>
      <Ask options={options} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('ConfirmDialog', () => {
  it('focuses Cancel for a destructive confirm', async () => {
    renderAsk({
      title: 'Delete route',
      message: 'Delete the "Classic" route?',
      confirmLabel: 'Delete',
      destructive: true,
    });

    const dialog = screen.getByRole('dialog', { name: 'Delete route' });
    expect(dialog).toHaveTextContent('Delete the "Classic" route?');
    expect(dialog).toHaveAccessibleDescription('Delete the "Classic" route?');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAccessibleDescription(
      'Delete the "Classic" route?',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAccessibleDescription(
      'Delete the "Classic" route?',
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAccessibleDescription(
      'Delete the "Classic" route?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn--danger');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Result: yes')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focuses the confirm button when the action is not destructive', () => {
    renderAsk({
      title: 'Move route',
      message: 'Move route 2/3 down?',
      confirmLabel: 'Move',
    });

    expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Move' })).toHaveAccessibleDescription(
      'Move route 2/3 down?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAccessibleDescription(
      'Move route 2/3 down?',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Move' })).toHaveClass('btn--primary');
  });

  it('treats Cancel, Escape, the backdrop, and Close as a no', async () => {
    function Decline() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              void confirm({
                title: 'Delete sector',
                message: 'Delete this sector?',
                confirmLabel: 'Delete',
                destructive: true,
              }).then((ok) => {
                if (!ok) setCount((current) => current + 1);
              });
            }}
          >
            Ask
          </button>
          <p>Declined: {count}</p>
        </>
      );
    }

    render(
      <ConfirmProvider>
        <Decline />
      </ConfirmProvider>,
    );

    const dismiss = async (action: () => void, count: number) => {
      fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
      action();
      expect(await screen.findByText(`Declined: ${count}`)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    };

    await dismiss(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })), 1);
    await dismiss(() => fireEvent.keyDown(document, { key: 'Escape' }), 2);
    await dismiss(
      () => fireEvent.mouseDown(document.querySelector('.modal-backdrop') as Element),
      3,
    );
    await dismiss(() => fireEvent.click(screen.getByRole('button', { name: 'Close' })), 4);
  });
});
