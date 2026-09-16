/**
 * Generates a fun, feed-worthy meal name from the AI's item list + meal type.
 *
 * Strategy:
 * 1. If the AI identified ≥1 item, try to compose a short catchy name.
 * 2. Rotate through personality-forward templates seeded by the item list.
 * 3. Fall back to meal-type-based names when no items are available.
 *
 * These names show in the feed so they need to be short (≤35 chars),
 * interesting, and personal — not just ingredient lists.
 */

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

// Adjective pools per meal type — rotate based on a hash of item names
const BREAKFAST_ADJ = ['Morning', 'Wake-up', 'Rise & shine', 'Sunrise', 'AM', 'First bite']
const LUNCH_ADJ     = ['Midday', 'Lunch hour', 'Afternoon', 'Power lunch', 'Noon fuel']
const DINNER_ADJ    = ['Evening', 'Dinner time', 'Night fuel', 'Sunset', 'Day-ender']
const SNACK_ADJ     = ['Quick', 'Little', 'Sneaky', 'In-between', 'Pocket']

// Fun standalone fallbacks when there are no AI items
const FALLBACKS: Record<MealType, string[]> = {
  breakfast: [
    'Morning fuel 🌅', 'Sunrise situation 🍳', 'First meal of the day',
    'AM power-up ⚡', 'Morning ritual', 'Rise & eat 🌄',
  ],
  lunch:     [
    'Midday boost 🔋', 'Lunch break fuel', 'Afternoon check-in',
    'Power lunch ⚡', 'Noon fuel-up', 'The lunch situation',
  ],
  dinner:    [
    'Dinner sorted 🌙', 'Evening wind-down', 'Night fuel loaded',
    'Sunset plate 🌅', 'Day done, eat on', 'Dinner time ✓',
  ],
  snack:     [
    'Little treat 🍎', 'Sneaky bite', 'In-between situation',
    'Quick refuel ⚡', 'Mini meal moment', 'Snack attack 😏',
  ],
}

/** Simple deterministic hash — same items always give the same template pick */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Capitalise first letter only */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** Strip generic qualifiers that make names boring ("grilled", "plain", "fresh") */
const BORING = /\b(grilled|boiled|steamed|plain|fresh|raw|cooked|fried)\s+/gi

function cleanItem(name: string): string {
  return cap(name.replace(BORING, '').trim())
}

export function generateMealName(
  rawItems: { name: string }[],
  mealType: MealType,
): string {
  const items = rawItems.map((i) => cleanItem(i.name)).filter(Boolean)

  // No items — use a fallback
  if (items.length === 0) {
    const pool = FALLBACKS[mealType]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  const seed = hashStr(items.join(','))

  // Single item — simple adjective prefix
  if (items.length === 1) {
    const adj = pick(adjPool(mealType), seed)
    return `${adj} ${items[0]}`.slice(0, 40)
  }

  // 2 items — "X & Y" or template
  if (items.length === 2) {
    const templates = [
      `${items[0]} & ${items[1]}`,
      `${pick(adjPool(mealType), seed)} ${items[0]} plate`,
      `${items[0]} with ${items[1]}`,
    ]
    return pick(templates, seed).slice(0, 40)
  }

  // 3+ items — hero item + "and more" or "plate"
  const hero = items[0]
  const templates = [
    `${hero} plate 🍽️`,
    `${hero} & more`,
    `${pick(adjPool(mealType), seed)} ${hero} bowl`,
    `${hero}, ${items[1]} & more`,
    `The ${hero} spread`,
  ]
  return pick(templates, seed).slice(0, 40)
}

function adjPool(mealType: MealType): string[] {
  const pools: Record<MealType, string[]> = {
    breakfast: BREAKFAST_ADJ,
    lunch:     LUNCH_ADJ,
    dinner:    DINNER_ADJ,
    snack:     SNACK_ADJ,
  }
  return pools[mealType]
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}
