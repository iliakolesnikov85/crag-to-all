import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '../context/ConfirmContext';
import { chooseConfirm } from '../test/helpers';
import type { Route } from '../types';
import DrawRouteModal from './DrawRouteModal';

const route: Route = {
  id: 'umbrella',
  name: 'Umbrella Project',
  grade: '6A',
  sectorName: 'Cave',
  description: '',
  tags: [],
  images: [
    {
      imageFile: 'topo.jpg',
      routeIndex: 0,
      line: [
        { x: 0.2, y: 0.3 },
        { x: 0.4, y: 0.8 },
      ],
    },
  ],
};

function stageRect(): DOMRect {
  return {
    left: 0,
    top: 0,
    width: 200,
    height: 100,
    right: 200,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

function renderModal(onSave = vi.fn(), onClose = vi.fn()) {
  render(
    <ConfirmProvider>
      <DrawRouteModal
        open
        route={route}
        imageFile="topo.jpg"
        imageUrl="/topo.jpg"
        saving={false}
        error={null}
        onClose={onClose}
        onSave={onSave}
      />
    </ConfirmProvider>,
  );
  const stage = document.querySelector('.draw-route-stage');
  if (!(stage instanceof HTMLElement)) throw new Error('Missing draw stage');
  stage.getBoundingClientRect = () => stageRect();
  return { onSave, onClose, stage };
}

describe('DrawRouteModal', () => {
  it('adds points from clicks, undoes the last one, and keeps the previous line', () => {
    const { stage } = renderModal();

    expect(screen.getByRole('dialog', { name: 'Draw "Umbrella Project" on the topo' })).toBeInTheDocument();
    expect(document.querySelector('.draw-route-line--previous')).toHaveAttribute('d', 'M 0.2 0.3 L 0.4 0.8');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(stage, { clientX: 50, clientY: 25 });

    expect(document.querySelector('.draw-route-point')).toBeInTheDocument();
    expect(document.querySelector('.draw-route-line--draft')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(stage, { clientX: 100, clientY: 80 });

    expect(document.querySelector('.draw-route-line--draft')).toHaveAttribute('d', 'M 0.25 0.25 L 0.5 0.8');
    expect(document.querySelector('.draw-route-line--previous')).toHaveAttribute('d', 'M 0.2 0.3 L 0.4 0.8');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(document.querySelector('.draw-route-line--draft')).not.toBeInTheDocument();
    expect(document.querySelector('.draw-route-point')).toBeInTheDocument();
    expect(document.querySelector('.draw-route-line--previous')).toHaveAttribute('d', 'M 0.2 0.3 L 0.4 0.8');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the draft line', () => {
    const onSave = vi.fn();
    const { stage } = renderModal(onSave);

    fireEvent.click(stage, { clientX: 40, clientY: 20 });
    fireEvent.click(stage, { clientX: 160, clientY: 90 });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.9 },
    ]);
  });

  it('asks before discarding a draft line', async () => {
    const onClose = vi.fn();
    const { stage } = renderModal(vi.fn(), onClose);

    fireEvent.click(stage, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const leave = screen.getByRole('dialog', { name: 'Leave this drawing?' });
    expect(leave).toHaveTextContent('Leave this drawing? Your unsaved line will be lost.');
    expect(within(leave).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    chooseConfirm('Leave this drawing?', 'Cancel');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    chooseConfirm('Leave this drawing?', 'Leave');

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
