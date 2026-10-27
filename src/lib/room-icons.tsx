import {
  Briefcase,
  Brain,
  Building2,
  Car,
  Code,
  Cpu,
  Database,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Megaphone,
  Palette,
  PenTool,
  Rocket,
  Server,
  ShoppingCart,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

export const ROOM_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  rocket: Rocket,
  target: Target,
  sparkles: Sparkles,
  brain: Brain,
  cpu: Cpu,
  server: Server,
  database: Database,
  code: Code,
  palette: Palette,
  "pen-tool": PenTool,
  megaphone: Megaphone,
  "heart-pulse": HeartPulse,
  landmark: Landmark,
  "shopping-cart": ShoppingCart,
  car: Car,
  building: Building2,
  "graduation-cap": GraduationCap,
  gamepad: Gamepad2,
};

export function RoomAvatar({
  icon,
  image,
  className = "size-10",
}: {
  icon: string | null;
  image: string | null;
  className?: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />;
  }
  const Icon = ROOM_ICONS[icon ?? ""] ?? Briefcase;
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground`}>
      <Icon className="size-1/2" />
    </div>
  );
}
