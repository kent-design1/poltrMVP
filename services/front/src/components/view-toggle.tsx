"use client"

import { useRouter } from "next/navigation"
import { Columns2, List, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"

type View = "columns" | "feed" | "tree"

const views: { key: View; icon: typeof Columns2; label: string; href: (id: string) => string }[] = [
  { key: "columns", icon: Columns2, label: "Dual Column", href: (id) => `/ballots/${id}` },
  { key: "feed", icon: List, label: "Feed", href: (id) => `/feed/${id}` },
  { key: "tree", icon: GitBranch, label: "Argument Tree", href: (id) => `/ballots/${id}` },
]

export function ViewToggle({ active, ballotId }: { active: View; ballotId: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {views.map(({ key, icon: Icon, label, href }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => key !== active && router.push(href(ballotId))}
          className={cn(
            "flex items-center justify-center size-[30px] rounded-[var(--r-sm)] border transition-all duration-150 cursor-pointer",
            key === active
              ? "border-[var(--line-mid)] bg-accent text-[var(--text)]"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--text-mid)] hover:bg-accent hover:border-[var(--line-mid)]"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
