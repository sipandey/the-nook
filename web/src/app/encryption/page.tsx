import Link from "next/link";
import { PublicPageHeader, PublicPageFooter } from "@/components/PublicPageChrome";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MaterialIcon } from "@/components/MaterialIcon";
import { readEncryptionContent } from "@/lib/content";

export const metadata = {
  title: "How we encrypt your journal — The Nook",
};

export default function EncryptionPage() {
  return (
    <div className="font-editorial-sans min-h-dvh flex flex-col bg-background text-on-background">
      <PublicPageHeader />

      <main className="flex-1 px-container-padding py-stack-loose max-w-2xl mx-auto w-full">
        <MarkdownContent source={readEncryptionContent()} />

        <div className="flex items-center gap-2 text-outline">
          <MaterialIcon name="lock" filled size={16} />
          <Link href="/privacy" className="text-label-sm text-primary underline underline-offset-2">
            Read the full Privacy Policy
          </Link>
        </div>
      </main>

      <PublicPageFooter />
    </div>
  );
}
