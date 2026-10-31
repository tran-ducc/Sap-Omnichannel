import type { Metadata } from "next";
import { PosView } from "./pos-view";

export const metadata: Metadata = { title: "Bán tại quầy" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function PosPage() {
  return <PosView />;
}
