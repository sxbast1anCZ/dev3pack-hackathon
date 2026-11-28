import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { filterItems, highlight, type PickItem } from '../lib/search'
import { Icon } from './Icon'

interface Props {
  label: string
  chipsLabel?: string
  placeholder: string
  fullText: string
  items: PickItem[]
  selected: string[]
  max: number
  onChange(next: string[]): void
}

export function MultiPicker({
  label,
  chipsLabel,
  placeholder,
  fullText,
  items,
  selected,
  max,
  onChange,
}: Props) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [forcedOpen, setForcedOpen] = useState(false)
  const [active, setActive] = useState(0)

  const full = selected.length >= max
  const { shown, total } = filterItems(items, query, selected, 8)
  const open = !full && focused && (query.length > 0 || forcedOpen)
  const clampedActive = shown.length > 0 ? Math.min(active, shown.length - 1) : 0

  const optionId = (index: number) => `${baseId}-opt-${index}`
  const labelById = new Map(items.map((item) => [item.id, item.label]))
  const labelOf = (id: string) => labelById.get(id) ?? id

  function add(id: string) {
    if (selected.includes(id) || selected.length >= max) return
    onChange([...selected, id])
    setQuery('')
    setActive(0)
    setForcedOpen(false)
    inputRef.current?.focus()
  }

  function remove(id: string) {
    onChange(selected.filter((item) => item !== id))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setForcedOpen(true)
        setActive(0)
      } else if (shown.length > 0) {
        setActive((prev) => (prev + 1) % shown.length)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      if (open && shown.length > 0) {
        e.preventDefault()
        setActive((prev) => (prev - 1 + shown.length) % shown.length)
      }
      return
    }

    if (e.key === 'Enter') {
      if (open && shown[clampedActive]) {
        e.preventDefault()
        add(shown[clampedActive].id)
      }
      return
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setForcedOpen(false)
        setQuery('')
      }
      return
    }

    if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
  }

  const footText = `${total} ${total === 1 ? 'resultado' : 'resultados'} de ${items.length} · ↑↓ para moverte, Enter para agregar`

  return (
    <div className="picker">
      <label className={full ? 'picker-input is-full' : 'picker-input'}>
        <span className="visually-hidden">{`Buscar ${label.toLowerCase()}`}</span>
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && shown.length > 0 ? optionId(clampedActive) : undefined}
          disabled={full}
          placeholder={full ? fullText : placeholder}
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setForcedOpen(false)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
        />
      </label>

      {open && (
        <ul
          className="picker-list"
          id={listId}
          role="listbox"
          aria-label={`Resultados de ${label.toLowerCase()}`}
        >
          {shown.length === 0 ? (
            <li className="picker-foot">No encontramos «{query}».</li>
          ) : (
            <>
              {shown.map((item, i) => (
                <li
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === clampedActive}
                  className="picker-option"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    add(item.id)
                  }}
                >
                  <span>
                    <strong>
                      {highlight(item.label, query).map((part, idx) =>
                        part.match ? (
                          <mark key={idx}>{part.text}</mark>
                        ) : (
                          <span key={idx}>{part.text}</span>
                        ),
                      )}
                    </strong>
                    {item.detail && <span className="detail">{item.detail}</span>}
                  </span>
                  <span className="add">Agregar ↵</span>
                </li>
              ))}
              <li className="picker-foot" aria-hidden="true">
                {footText}
              </li>
            </>
          )}
        </ul>
      )}

      <ul className="chips" aria-label={chipsLabel ?? `${label} elegidas`}>
        {selected.map((id) => (
          <li key={id} className="chip">
            {labelOf(id)}
            <button
              type="button"
              aria-label={`Quitar ${labelOf(id)}`}
              onClick={() => remove(id)}
            >
              <Icon name="x" size={16} strokeWidth={2.4} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
