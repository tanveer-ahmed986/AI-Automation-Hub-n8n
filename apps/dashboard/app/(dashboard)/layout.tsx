import { Sparkles } from "lucide-react";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { NavLinks } from "@/components/nav-links";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
          Z&amp;T Automation Hub
        </p>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          Lead Management
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-4">
          <NavLinks />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (sidebar is hidden below md) */}
        <header className="flex flex-col gap-3 border-b border-border bg-card/40 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <Brand />
          </div>
          <nav aria-label="Primary" className="flex flex-wrap gap-1 md:hidden">
            <NavLinks />
          </nav>
          <div className="hidden md:block" />
          <DemoModeBadge />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
