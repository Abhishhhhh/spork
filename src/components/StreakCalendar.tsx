/**
 * StreakCalendar — the last `days` calendar days as a 7-column dot grid.
 * Logged days use the teal tracking accent; today is highlighted in soft grey.
 * Tappable when onDayTap is provided.
 */

interface StreakCalendarProps {
  logDates: Set<string>          // set of yyyy-mm-dd strings
  days?: number                  // how many days to show (default 14)
  onDayTap?: (date: string) => void
  selectedDay?: string | null
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function StreakCalendar({ logDates, days = 14, onDayTap, selectedDay }: StreakCalendarProps) {
  const cells: { dateStr: string; logged: boolean; dayLabel: string; isToday: boolean }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toLocaleDateString('en-CA') // yyyy-mm-dd
    cells.push({
      dateStr,
      logged: logDates.has(dateStr),
      dayLabel: DAY_LABELS[d.getDay()],
      isToday: i === 0,
    })
  }

  // Header labels follow the first row's weekdays (columns repeat every 7 days)
  const header = cells.slice(0, 7).map((c) => c.dayLabel)

  return (
    <div className="calendar">
      {header.map((l, i) => <span key={i}>{l}</span>)}
      {cells.map(({ dateStr, logged, isToday }) => {
        const cls = `${logged ? 'on' : ''} ${isToday ? 'today' : ''} ${selectedDay === dateStr ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''}`
        const title = new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        return onDayTap ? (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayTap(dateStr)}
            className={`no-press ${cls}`}
            aria-label={`${title}${logged ? ' · logged' : ''}`}
            aria-pressed={selectedDay === dateStr}
          />
        ) : (
          <i key={dateStr} className={cls} title={title} />
        )
      })}
    </div>
  )
}
