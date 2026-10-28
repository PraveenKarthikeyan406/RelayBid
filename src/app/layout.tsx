import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelayBid — Pass it on, bid it forward",
  description: "A campus auction where seniors pass useful things to juniors.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
