"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import {
  getAppRuntime,
  isMiniPayRuntime,
  setMiniPayTestnetCookie,
} from "@/lib/client/runtime";

interface MiniPayTestnetToggleProps {
  initialShowTestnet: boolean;
}

export function MiniPayTestnetToggle({
  initialShowTestnet,
}: MiniPayTestnetToggleProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();
  const [showTestnet, setShowTestnet] = useState(initialShowTestnet);
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getAppRuntime()
      .then((runtime) => {
        if (!cancelled) {
          setIsMiniPay(runtime === "minipay" || isMiniPayRuntime());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsMiniPay(isMiniPayRuntime());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isMiniPay) {
    return null;
  }

  const buttonLabel = showTestnet ? "Testnet on" : "Mainnet only";

  return (
    <button
      type="button"
      onClick={() => {
        const nextValue = !showTestnet;
        setShowTestnet(nextValue);
        setMiniPayTestnetCookie(nextValue);
        startTransition(() => {
          void mutate(
            (key) => typeof key === "string" && key.startsWith("/api/v1/"),
            undefined,
            { revalidate: true },
          );
          router.refresh();
        });
      }}
      className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-[#FFC931]/25 hover:bg-[#FFC931]/10 hover:text-[#FFC931] disabled:cursor-wait disabled:opacity-60"
      aria-pressed={showTestnet}
      disabled={isPending}
    >
      {buttonLabel}
    </button>
  );
}
