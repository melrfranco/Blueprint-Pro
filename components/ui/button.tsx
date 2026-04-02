import * as React from "react"
import { cn } from "@/lib/utils"

function Button({ className, variant = "default", size = "default", ...props }: React.ComponentProps<"button"> & { variant?: "default" | "secondary" | "ghost" | "destructive", size?: "default" | "sm" | "lg" | "icon" }) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/92 active:bg-primary/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_24px_rgba(10,44,84,0.20)]",
    secondary: "bg-accent text-accent-foreground hover:bg-accent/92 active:bg-accent/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(50,92,130,0.16)]",
    ghost: "hover:bg-muted hover:text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  }

  const sizes = {
    default: "h-14 px-4 py-2",
    sm: "h-9 px-3",
    lg: "h-16 px-8",
    icon: "h-10 w-10",
  }

  return (
    <button
      className={cn(
        "blueprint-focus inline-flex items-center justify-center rounded-full text-sm font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Button }
