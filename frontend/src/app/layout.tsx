import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Huascar — Agent Creator",
  description:
    "Diseña agentes de desarrollo y operación mediante un árbol de decisiones, genera su configuración y entiende por qué fue construida así.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
