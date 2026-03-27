import InvitePageClient from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invite Access | Waffles",
  description: "Enter your invite code to access the game.",
};

export default function InvitePage() {
  return <InvitePageClient />;
}
