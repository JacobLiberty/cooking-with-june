import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MotionProvider } from "@/components/motion-provider";
import { ToastProvider } from "@/components/toast";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <ToastProvider>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-5 py-10 md:py-14">{children}</main>
        <SiteFooter />
      </ToastProvider>
    </MotionProvider>
  );
}
