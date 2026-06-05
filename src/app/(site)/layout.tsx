import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MotionProvider } from "@/components/motion-provider";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 md:py-14">{children}</main>
      <SiteFooter />
    </MotionProvider>
  );
}
