// Monochrome pictograms for onboarding options (Cal-AI-style, but line-drawn so
// they follow the ink/paper theme). Icons come from lucide-react (MIT); add a
// key here rather than importing lucide directly in screens so the whole set
// stays one consistent size/stroke.
import {
  Apple, BatteryLow, CalendarCheck, Camera, ChefHat, CircleCheck, CircleOff,
  CookingPot, Drumstick, Dumbbell, Flame, Footprints, Globe, HardHat, HeartPulse,
  History, Hourglass, Infinity as InfinityIcon, Laptop, Leaf, Lock, Mars, Nut, Pencil, Puzzle, Rabbit,
  Rocket, Ruler, Scale, Snail, Sparkles, Sprout, TrendingDown, Users, Utensils, Venus,
  Wheat, Zap, type LucideIcon,
} from 'lucide-react'

const ICONS = {
  // goal / pace
  lose: TrendingDown, maintain: Scale, gain: Dumbbell,
  slow: Snail, moderate: Rabbit, fast: Rocket,
  // basics
  female: Venus, male: Mars,
  // activity
  desk: Laptop, on_feet: Footprints, physical: HardHat,
  none: CircleOff, cardio: HeartPulse, strength: Dumbbell, mixed: InfinityIcon,
  // food
  no_restrictions: Utensils, vegetarian: Leaf, vegan: Sprout, other: Pencil,
  quick: Zap, cook: CookingPot, chef: ChefHat,
  // experience
  yes: CircleCheck, tried: History, never: Sparkles,
  consistency: CalendarCheck, logging_time: Hourglass, social: Users,
  accuracy: Ruler, motivation: BatteryLow, complexity: Puzzle,
  // privacy
  public: Globe, private: Lock,
  // welcome / plan
  camera: Camera, flame: Flame, friends: Users, apple: Apple,
  protein: Drumstick, carbs: Wheat, fat: Nut,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function OptionIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const Icon = ICONS[name]
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />
}
