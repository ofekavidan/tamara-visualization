import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tamara · RNA Visualization",
  description:
    "Interactive viewer for differential RNA expression across timepoints (Baseline, 15, 30, 60 min).",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {/* Top bar / brand (אפשר להחליף בלוגו/כותרת בהמשך) */}
        <div className="border-b bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold tracking-tight">
                Tamara Visualization
              </div>
              <div className="text-xs text-neutral-500">
                Baseline · 15 · 30 · 60 min
              </div>
            </div>
          </div>
        </div>

        {/* Main container */}
        <div className="mx-auto w-full max-w-6xl px-4">{children}</div>

        {/* Footer קטן */}
        <footer className="mt-12 border-t bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-neutral-500">
            Built with Next.js · Static assets from <code>public/</code>
          </div>
        </footer>
      </body>
    </html>
  );
}
