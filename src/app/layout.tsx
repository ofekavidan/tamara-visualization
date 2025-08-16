import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tamara Visualization",
  description: "Interactive RNA visualization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <main className="container mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
