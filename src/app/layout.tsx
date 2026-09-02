import type { Metadata, Viewport } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

const arcade = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-arcade",
});

export const metadata: Metadata = {
  title: "Willow Snake",
  description: "Arcade snake. WASD. Eat apples. Don't hit the wall.",
};

export const viewport: Viewport = {
  themeColor: "#efe6c9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${arcade.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-parchment text-ink">{children}</body>
    </html>
  );
}
