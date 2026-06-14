import { cn } from "@/lib/utils"

export function VeeeyLogo({
  className,
  variant = "default",
}: {
  className?: string
  variant?: "default" | "light"
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-base font-semibold text-primary-foreground"
        aria-hidden="true"
      >
        v
      </span>
      <span
        className={cn(
          "text-xl font-semibold lowercase tracking-tight",
          variant === "light" ? "text-slate-foreground" : "text-foreground",
        )}
      >
        veeey
      </span>
    </div>
  )
}
