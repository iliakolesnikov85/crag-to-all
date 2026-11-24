import React, { useEffect, useMemo, useRef, useState } from 'react';
import { countryByCode, searchCountries, type Country } from '@crag-to-all/shared-crag';
import { countryFlagUrl } from './countryFlags';

const MAX_COUNTRY_MATCHES = 30;

interface CountryFieldProps {
  id: string;
  value: string;
  disabled: boolean;
  error?: string;
  onChange: (code: string) => void;
}

interface CountryMatches {
  matches: readonly Country[];
  truncated: boolean;
}

function CountryFlag({ code }: { code: string }) {
  const src = countryFlagUrl(code);
  if (!src) return null;
  return <img className="crag-manage-form__flag" src={src} alt="" />;
}

function visibleCountries(query: string, selectedCode: string): CountryMatches {
  const found = searchCountries(query);
  const limited = found.slice(0, MAX_COUNTRY_MATCHES);
  const selected = countryByCode(selectedCode);
  const selectedIsHidden = selected != null
    && found.some((country) => country.code === selected.code)
    && !limited.some((country) => country.code === selected.code);
  if (selected && selectedIsHidden) {
    return {
      matches: [selected, ...limited.slice(0, MAX_COUNTRY_MATCHES - 1)],
      truncated: found.length > MAX_COUNTRY_MATCHES,
    };
  }
  return {
    matches: limited,
    truncated: found.length > limited.length,
  };
}

function selectedIndex(matches: readonly Country[], code: string): number {
  const index = matches.findIndex((country) => country.code === code);
  return index >= 0 ? index : 0;
}

const CountryField: React.FC<CountryFieldProps> = ({
  id,
  value,
  disabled,
  error,
  onChange,
}) => {
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);
  const searchingRef = useRef(searching);
  const selected = countryByCode(value);
  const selectedLabel = selected ? `${selected.name} (${selected.code})` : '';
  const { matches, truncated } = useMemo(
    () => visibleCountries(searching ? query : '', value),
    [searching, query, value],
  );
  const safeIndex = matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1);
  const active = matches[safeIndex];
  openRef.current = open;
  searchingRef.current = searching;

  useEffect(() => {
    const node = activeOptionRef.current;
    if (!open || !node || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ block: 'nearest' });
  }, [open, safeIndex, matches]);

  useEffect(() => {
    // The dialog closes on Escape from a document listener. This runs first,
    // so one Escape drops the list and the next Escape closes the dialog.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!openRef.current && !searchingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      setSearching(false);
      setQuery('');
      setBrowsing(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const choose = (code: string) => {
    onChange(code);
    setQuery('');
    setSearching(false);
    setBrowsing(false);
    setOpen(false);
    setActiveIndex(0);
  };

  const showList = (index: number) => {
    setOpen(true);
    setBrowsing(true);
    setActiveIndex(index);
  };

  return (
    <div className="crag-manage-form__field">
      <label className="crag-manage-form__label" htmlFor={id}>
        Country
      </label>
      <div className="crag-manage-form__country">
        {selected ? <CountryFlag code={selected.code} /> : null}
        <input
          id={id}
          className={error ? 'crag-manage-form__input is-invalid' : 'crag-manage-form__input'}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active ? `${id}-option-${active.code}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={searching ? query : selectedLabel}
          placeholder={selected ? undefined : 'Search by name, code, or domain'}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearching(true);
            setBrowsing(false);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={(event) => {
            setOpen(true);
            if (!searching) setActiveIndex(selectedIndex(matches, value));
            event.currentTarget.select();
          }}
          onBlur={() => {
            setOpen(false);
            setSearching(false);
            setQuery('');
            setBrowsing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const start = open ? safeIndex : selectedIndex(matches, value);
              showList(Math.min(start + 1, Math.max(matches.length - 1, 0)));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const start = open ? safeIndex : selectedIndex(matches, value);
              showList(Math.max(start - 1, 0));
              return;
            }
            if (event.key === 'Enter' && open && (searching || browsing)) {
              event.preventDefault();
              if (active && (query.trim() || browsing)) choose(active.code);
            }
          }}
        />
      </div>
      {open && !disabled ? (
        <ul id={listId} className="crag-manage-form__countries" role="listbox">
          {matches.map((country, index) => (
            <li key={country.code} role="presentation">
              <button
                type="button"
                id={`${id}-option-${country.code}`}
                ref={index === safeIndex ? activeOptionRef : undefined}
                className={
                  index === safeIndex
                    ? 'crag-manage-form__country-option is-active'
                    : 'crag-manage-form__country-option'
                }
                role="option"
                aria-selected={country.code === value}
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(country.code);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(country.code);
                }}
                onMouseEnter={() => {
                  if (!searching && !browsing) return;
                  setActiveIndex(index);
                }}
              >
                <CountryFlag code={country.code} />
                <span className="crag-manage-form__country-name">{country.name}</span>
                <span className="crag-manage-form__country-code">{country.code}</span>
                <span className="crag-manage-form__country-tld">.{country.tld}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="crag-manage-form__country-empty">No countries match.</li>
          ) : null}
          {truncated ? (
            <li className="crag-manage-form__country-empty">Keep typing to narrow the list.</li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className="crag-manage-form__field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default CountryField;
