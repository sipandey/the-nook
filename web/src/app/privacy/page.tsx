import { PublicPageHeader, PublicPageFooter } from "@/components/PublicPageChrome";
import { MarkdownContent } from "@/components/MarkdownContent";
import { readPrivacyContent } from "@/lib/content";

export const metadata = {
  title: "Privacy Policy — The Nook",
};

// Kept out of the Markdown source deliberately — it's document metadata,
// not prose content, and bumping it is a one-line change either way.
const LAST_UPDATED = "August 24, 2026";

export default function PrivacyPage() {
  return (
    <div className="font-editorial-sans min-h-dvh flex flex-col bg-background text-on-background">
      <PublicPageHeader />

      <main className="flex-1 px-container-padding py-stack-loose max-w-2xl mx-auto w-full">
        <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary mb-2">
          Privacy Policy
        </h1>
        <p className="text-label-sm text-outline mb-stack-gap">Last updated: {LAST_UPDATED}</p>

        <MarkdownContent source={readPrivacyContent()} />
      </main>

      <PublicPageFooter />
    </div>
  );
}
