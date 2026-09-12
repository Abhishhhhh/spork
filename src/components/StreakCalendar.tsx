/**
 * StreakCalendar — shows the last `days` calendar days as a dot grid.
 * Filled dot = logged that day. Empty = missed.
 * Optionally tappable (onDayTap) — used by Profile screen to drill into that day's logs.
 */

interface StreakCalendarProps {
  logDates: Set<string>          // set of yyyy-mm-dd strings
  days?: number                  // how many days to show (default 14)
  onDayTap?: (date: string) => void
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function StreakCalendar({ logDates, days = 14, onDayTap }: StreakCalendarProps) {
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

  return (
    <div className="flex gap-1 flex-wrap">
      {cells.map(({ dateStr, logged, dayLabel, isToday }) => {
        const base =
          'flex flex-col items-center gap-0.5 rounded-lg p-1 w-[calc((100%-6*0.25rem)/7)]'
        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayTap?.(dateStr)}
            disabled={!onDayTap}
            className={`${base} ${onDayTap ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span className="text-[9px] text-muted uppercase">{dayLabel}</span>
            <span
              className={`h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-semibold ${
                logged
                  ? 'bg-primary text-background'
                  : isToday
                  ? 'border-2 border-primary text-primary'
                  : 'bg-background text-muted'
              }`}
            >
              {logged ? '●' : '○'}
            </span>
          </button>
        )
      })}
    </div>
  )
}