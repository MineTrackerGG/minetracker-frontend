import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MineTracker – Minecraft Server Tracker",
  description: "MineTracker is a Minecraft server tracking application that provides real-time statistics and monitoring for Minecraft servers. Keep track of your favorite servers' status, player counts, and more with MineTracker.",
  keywords: [
    "minetracker",
    "minecraft",
    "server tracker",
    "minecraft servers",
    "server status",
    "player counts",
    "real-time monitoring",
    "minecraft stats",
    "tutorials",
    "technology",
    "development",
    "nextjs",
  ],
  authors: [{ name: "MineTracker" }],
  openGraph: {
    siteName: "MineTracker — Minecraft Server Tracker",
    images: [
      {
        url: "https://minetracker.bypixel.dev/logo/x256.png",
        width: 256,
        height: 256,
        alt: "MineTracker Logo"
      }
    ],
    title: "MineTracker – Minecraft Server Tracker",
    description: "Welcome to MineTracker, a Minecraft server tracking application that provides real-time statistics and monitoring for Minecraft servers. Keep track of your favorite servers' status, player counts, and more with MineTracker!",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MineTracker – Minecraft Server Tracker",
    description: "MineTracker is a Minecraft server tracking application that provides real-time statistics and monitoring for Minecraft servers. Keep track of your favorite servers' status, player counts, and more with MineTracker.",
    images: ["https://minetracker.bypixel.dev/logo/x256.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
