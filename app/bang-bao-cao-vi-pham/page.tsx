
'use client';

import PublicViolationReport from "@/src/public/PublicViolationReport";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export default function PublicViolationReportPage() {
  return (
    <ConvexClientProvider>
      <PublicViolationReport />
    </ConvexClientProvider>
  );
}