import React from "react";

import { MainShell } from "@/components/main-shell";
import { TokenGate } from "@/components/rooms/token-gate";
import { UiModeProvider } from "@/lib/ui-mode";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <UiModeProvider>
      <TokenGate>
        <MainShell>{children}</MainShell>
      </TokenGate>
    </UiModeProvider>
  );
}
