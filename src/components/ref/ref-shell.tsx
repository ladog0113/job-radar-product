"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { name: "Collections", url: "/" },
  { name: "Sync", url: "/sources/" },
  { name: "Settings", url: "/settings/" },
];

export function RefShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = theme === "system" ? systemTheme : theme;
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  const active = (url: string) =>
    url === "/" ? ["/", "/room/", "/job/", "/room/new/"].includes(norm(path)) : norm(path) === url;

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Layers className="size-4" />
            </span>
            <span className="hidden sm:inline">Reference Shelf</span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.url}
                href={n.url}
                className={cn(active(n.url) ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {n.name}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              onClick={() => setTheme(current === "light" ? "dark" : "light")}
            >
              {mounted ? current === "light" ? <Moon className="size-4" /> : <Sun className="size-4" /> : null}
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-4 px-4 pb-2 text-sm sm:hidden">
          {NAV.map((n) => (
            <Link key={n.url} href={n.url} className={active(n.url) ? "font-medium" : "text-muted-foreground"}>
              {n.name}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
