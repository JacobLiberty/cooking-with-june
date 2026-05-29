import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Cooking with June",
};

export default function AboutPage() {
  return (
    <section className="py-16 text-center">
      <p className="text-6xl" aria-hidden>
        🐱
      </p>
      <h1 className="mt-4 font-hand text-5xl text-clay">About June</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-cocoa/80">
        June is our orange cat and head kitchen supervisor. This is the cookbook
        Jacob &amp; Lily are building around her. Her full story is coming soon. 🐾
      </p>
    </section>
  );
}
