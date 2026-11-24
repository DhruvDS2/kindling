import { forwardRef } from 'react';
import { Search } from './icons';
import './SearchField.css';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called on Esc after clearing, e.g. to return focus to the table. */
  onEscape?: () => void;
  'aria-label'?: string;
}

/**
 * The table's search slot. `/` focuses it (pass its ref to <Table searchRef>); Esc clears it.
 * Shows the "/" hint while empty and unfocused.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder = 'Find a school', onEscape, ...aria },
  ref,
) {
  return (
    <label className="k-search">
      <Search className="k-search__icon" />
      <input
        ref={ref}
        type="search"
        className="k-search__input"
        value={value}
        placeholder={placeholder}
        aria-label={aria['aria-label'] ?? placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); onChange(''); e.currentTarget.blur(); onEscape?.(); }
        }}
      />
      {!value && <kbd className="k-kbd k-search__hint" aria-hidden="true">/</kbd>}
    </label>
  );
});
