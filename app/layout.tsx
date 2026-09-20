import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frameflow Studio — Editor de vídeo",
  description: "Edita, subtitula y exporta vídeos desde el navegador.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
