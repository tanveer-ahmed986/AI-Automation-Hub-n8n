import Link from "next/link";
import { DemoModeBadge } from "@/components/demo-mode-badge";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/approvals", label: "Approvals" },
  { href: "/execution-log", label: "Execution Log" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-lg font-semibold">Z&amp;T Automation Hub</span>
            <nav aria-label="Primary" className="flex flex-wrap gap-4 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <DemoModeBadge />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
