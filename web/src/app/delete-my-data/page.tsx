import { PublicPageHeader, PublicPageFooter } from "@/components/PublicPageChrome";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MaterialIcon } from "@/components/MaterialIcon";
import { readDeleteMyDataContent } from "@/lib/content";

export const metadata = {
  title: "Delete my information — The Nook",
};

export default function DeleteMyDataPage() {
  return (
    <div className="font-editorial-sans min-h-dvh flex flex-col bg-background text-on-background">
      <PublicPageHeader />

      <main className="flex-1 px-container-padding py-stack-loose max-w-2xl mx-auto w-full">
        <MarkdownContent source={readDeleteMyDataContent()} />

        <div className="flex items-center gap-2 text-outline">
          <MaterialIcon name="lock" filled size={16} />
          <span className="text-label-sm">Deletion is real, immediate, and not something we can undo for you</span>
        </div>
      </main>

      <PublicPageFooter />
    </div>
  );
}
