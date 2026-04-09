import {
  Snowflake,
  Thermometer,
  Flame,
  Sun,
  Moon,
  Star,
  Heart,
  Zap,
  Cloud,
  Droplets,
  Wind,
  Target,
  Circle,
  Square,
  Triangle,
  Diamond,
  Sparkles,
  Rocket,
  Leaf,
  Skull,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const TEMPERATURE_ICON_MAP: Record<string, LucideIcon> = {
  snowflake: Snowflake,
  thermometer: Thermometer,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  star: Star,
  heart: Heart,
  zap: Zap,
  cloud: Cloud,
  droplets: Droplets,
  wind: Wind,
  target: Target,
  circle: Circle,
  square: Square,
  triangle: Triangle,
  diamond: Diamond,
  sparkles: Sparkles,
  rocket: Rocket,
  leaf: Leaf,
  skull: Skull,
};

export const TEMPERATURE_ICON_NAMES = Object.keys(TEMPERATURE_ICON_MAP);

export const TEMPERATURE_PRESET_COLORS = [
  "#1f93ff",
  "#4CAF50",
  "#FF9800",
  "#E91E63",
  "#9C27B0",
  "#00BCD4",
  "#795548",
  "#607D8B",
];
