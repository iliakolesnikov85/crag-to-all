import React, { useId } from 'react';
import './ChoiceGroup.scss';

interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  options: readonly ChoiceOption<T>[];
  selected: readonly T[];
  disabled?: boolean;
  onToggle: (value: T) => void;
}

function ChoiceGroup<T extends string | number>({
  label,
  options,
  selected,
  disabled = false,
  onToggle,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  return (
    <div className="choice-group">
      <span className="choice-group__label" id={labelId}>
        {label}
      </span>
      <div className="choice-group__options" role="group" aria-labelledby={labelId}>
        {options.map((option) => {
          const pressed = selected.includes(option.value);
          return (
            <button
              key={String(option.value)}
              type="button"
              className="choice-group__option"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => onToggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { ChoiceOption };

export default ChoiceGroup;
