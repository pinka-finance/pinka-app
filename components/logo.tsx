import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "default" | "light";
};

export function Logo({ className, variant = "default" }: Props) {
  const color = variant === "light" ? "text-cream" : "text-ink";
  return (
    <span
      aria-label="pinka"
      className={cn(
        "inline-flex items-center font-display text-[28px] sm:text-[32px] tracking-tight leading-none select-none",
        color,
        className,
      )}
    >
      <span className="text-coral">p</span>
      <span>inka</span>
      <span className="ml-[1px] -translate-y-[2px] text-coral text-[20px] sm:text-[24px]">
        .
      </span>
    </span>
  );
}
