// How the pages show dates and sizes. British English, like the clock in the header.

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
// Plain dates (`2026-11-29`) are days, not instants: read and shown in UTC, so no time zone moves them.
const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** An ISO-8601 instant in local time: "24 Nov 2026, 14:05". */
export function formatDateTime(instant: string): string {
  return DATE_TIME.format(new Date(instant))
}

/** An ISO-8601 date: "Sat, 29 Nov 2026". */
export function formatDate(date: string): string {
  return DATE.format(new Date(`${date}T00:00:00Z`))
}

/** A file size: "820 KB", "2.5 MB". Rounds up, so a file just over a limit never reads as within it. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${Math.ceil((bytes / (1024 * 1024)) * 10) / 10} MB`
}
