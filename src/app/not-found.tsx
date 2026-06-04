import Link from "next/link";
import { JuneArt } from "@/components/june";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <JuneArt pose="bat" className="h-44 w-auto" />
      <p className="kicker mt-6 text-terracotta">404</p>
      <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">
        June knocked this page off the counter
      </h1>
      <p className="mt-4 text-ink-soft">
        It isn&rsquo;t where it used to be. Let&rsquo;s get you back to the kitchen.
      </p>
      <Link
        href="/"
        className="kicker mt-6 border border-terracotta px-4 py-2 text-terracotta hover:bg-terracotta-wash"
      >
        Back to the collection
      </Link>
    </main>
  );
}
