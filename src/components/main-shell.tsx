"use client";

import React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { CliApp } from "@/components/cli/cli-app";
import { RefShell } from "@/components/ref/ref-shell";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUiMode } from "@/lib/ui-mode";

export function MainShell({ children }: { children: React.ReactNode }) {
  const { mode } = useUiMode();
  if (mode === "cli") return <CliApp />;
  if (mode === "ref") return <RefShell>{children}</RefShell>;
  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <main className="min-h-full min-w-0 p-4 lg:container lg:pt-5">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
