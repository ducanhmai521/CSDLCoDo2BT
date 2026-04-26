import { createRoot } from "react-dom/client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "./lib/authClient";
import "./index.css";
import AppWrapper from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexBetterAuthProvider client={convex} authClient={authClient}>
    <AppWrapper />
  </ConvexBetterAuthProvider>,
);
