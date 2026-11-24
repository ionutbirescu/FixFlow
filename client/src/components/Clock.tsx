import { useEffect, useState } from 'react'

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** The day and time, like a game's pause menu shows them: "Monday 15:10". */
export function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Every 15 s, so the minute is never more than 15 s late
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <time className={className} dateTime={now.toISOString()}>
      {DAY.format(now)} {TIME.format(now)}
    </time>
  )
}
