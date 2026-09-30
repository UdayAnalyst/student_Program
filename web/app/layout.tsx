import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight, Newsreader } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Light editorial serif for headlines and body copy.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

// Heavy, tightly tracked display type for the poster panels.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Launchpad: Tech opportunities for underclassmen",
  description:
    "Internships, programs, fellowships and hackathons open to freshmen and sophomores (Class of 2029 & 2030), with text alerts before deadlines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        {children}
      </body>
    </html>
  );
}
