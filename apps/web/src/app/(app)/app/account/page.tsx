import type { Metadata } from "next";
import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Tài khoản" };
// Client-rendered after session restore — see the note in ../layout.tsx.
export const instant = false;

export default function AccountPage() {
  return <AccountView />;
}
