export function Logo({ size = 40 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#0077FF" />
      <path
        fill="#fff"
        d="M13 15h18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H22l-6 5v-5h-3a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z"
      />
    </svg>
  );
}
