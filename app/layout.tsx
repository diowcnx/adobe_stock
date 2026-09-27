import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adobe Stock AI Generator & Dispatcher",
  description: "Automated commercial stock photo research, prompt engineering, image generation, and daily email dispatcher.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
