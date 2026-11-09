import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OptionsMenu from './OptionsMenu';

function renderMenu(onSelect = vi.fn()) {
  render(
    <OptionsMenu
      label="Options for Classic"
      overlay
      items={[
        { label: 'Edit route details', onSelect },
        { label: 'Edit sector details', onSelect },
      ]}
      renderButton={({ open: _open, ...buttonProps }) => <button type="button" {...buttonProps} />}
    />,
  );
  return onSelect;
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Options for Classic' }));
}

describe('OptionsMenu keyboard', () => {
  it('moves focus into an overlay menu and between its items', () => {
    renderMenu();
    openMenu();

    const route = screen.getByRole('menuitem', { name: 'Edit route details' });
    const sector = screen.getByRole('menuitem', { name: 'Edit sector details' });
    expect(route).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Options for Classic' })).toHaveAttribute(
      'aria-controls',
      screen.getByRole('menu').id,
    );

    fireEvent.keyDown(route, { key: 'ArrowDown' });
    expect(sector).toHaveFocus();

    fireEvent.keyDown(sector, { key: 'ArrowUp' });
    expect(route).toHaveFocus();

    fireEvent.keyDown(route, { key: 'ArrowUp' });
    expect(sector).toHaveFocus();
  });

  it('returns focus to the button when the menu closes from the keyboard', () => {
    const onSelect = renderMenu();
    openMenu();
    const button = screen.getByRole('button', { name: 'Options for Classic' });

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Edit route details' }), { key: 'Tab' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();

    openMenu();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Edit route details' }), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('runs the focused item and closes the menu', () => {
    const onSelect = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit sector details' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Options for Classic' })).toHaveFocus();
  });
});
