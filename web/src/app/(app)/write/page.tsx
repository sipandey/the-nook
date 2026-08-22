import { ComingSoon } from "@/components/ComingSoon";

/** Next natural build target — the entry composer (text + voice), wired to
 *  src/lib/crypto for client-side encryption before POST /api/entries. */
export default function WritePage() {
  return <ComingSoon title="New entry" />;
}
