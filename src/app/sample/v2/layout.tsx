import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Waffles · v2 Prototype",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Archivo+Black&display=swap"
      />
      {children}
    </>
  );
}
