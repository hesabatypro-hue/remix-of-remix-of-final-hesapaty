import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBranches from "./tools/list-branches";
import revenueSummary from "./tools/revenue-summary";
import listRecentTransfers from "./tools/list-recent-transfers";

// The OAuth issuer MUST be the direct supabase.co host. Read the project ref
// from the Vite-inlined env so the entry stays import-safe (no runtime env
// reads at module load); the fallback keeps the issuer well-formed during
// the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hesabaty-mcp",
  title: "Hesabaty PRO",
  version: "0.1.0",
  instructions:
    "Tools for Hesabaty PRO. Read the signed-in user's branches, recent bank transfers, and confirmed revenue summaries. All calls run under the user's Supabase RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listBranches, revenueSummary, listRecentTransfers],
});
