const PATHS: Record<string, string[]> = {
  pill: ['M10.5 3.5a5 5 0 0 1 7.07 7.07l-7.07 7.07a5 5 0 0 1-7.07-7.07z', 'M7 7l7 7'],
  store: ['M3 10l9-6 9 6', 'M5 10v9h14v-9', 'M10 19v-5h4v5'],
  external: ['M7 17L17 7', 'M9 7h8v8'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  mic: ['M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  stop: ['M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'],
  pause: ['M8 5h2.5v14H8z', 'M13.5 5H16v14h-2.5z'],
  alert: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v5', 'M12 16h.01'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8h.01'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-3.5-3.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  plus: ['M12 5v14', 'M5 12h14'],
  shield: ['M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z'],
  speaking: ['M4 10v4', 'M8 7v10', 'M12 4v16', 'M16 7v10', 'M20 10v4'],
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 20,
  strokeWidth = 2.2,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
