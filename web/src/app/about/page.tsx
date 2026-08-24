import { PublicPageHeader, PublicPageFooter } from "@/components/PublicPageChrome";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MaterialIcon } from "@/components/MaterialIcon";
import { readAboutContent } from "@/lib/content";

export const metadata = {
  title: "About — The Nook",
};

export default function AboutPage() {
  return (
    <div className="font-editorial-sans min-h-dvh flex flex-col bg-background text-on-background">
      <PublicPageHeader />

      <main className="flex-1 px-container-padding py-stack-loose max-w-2xl mx-auto w-full">
        <MarkdownContent source={readAboutContent()} />

        <div className="flex items-center gap-2 text-outline mt-stack-loose">
          <MaterialIcon name="lock" filled size={16} />
          <span className="text-label-sm">End-to-End Encrypted, by design, not by policy</span>
        </div>
      </main>

      <PublicPageFooter />
    </div>
  );
}
