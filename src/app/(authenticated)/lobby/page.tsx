"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LobbyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/game");
  }, [router]);
  return null;
}
