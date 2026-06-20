"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { isDeploymentSkewError, reloadForDeploymentSkew } from "@/components/DeploymentSkewReloader";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GameErrorPage({ error, reset }: ErrorPageProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // A post-deploy server-action mismatch can only be fixed by loading the new
    // build — auto-reload instead of stranding the user on an error screen.
    if (isDeploymentSkewError(error.message)) {
      reloadForDeploymentSkew();
      return;
    }
    console.error("Game Segment Error:", error);
  }, [error]);

  return (
    <div
      className="
        flex flex-col items-center justify-center
        min-h-[80dvh]
        w-full px-4
        text-center
      "
    >
      {/* Error X Icon */}
      <Image
        src="/images/icons/error-x.svg"
        alt="Error"
        width={68}
        height={68}
        className="mb-8"
      />

      {/* Error Container */}
      <div className="flex flex-col items-center gap-3 max-w-[350px]">
        {/* Title */}
        <h1 className="font-body text-[32px] leading-none text-white uppercase tracking-wide">
          Unhandled Error
        </h1>

        {/* Error Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-white/60 font-body font-medium tracking-tight hover:text-white/80 transition-colors"
        >
          {showDetails ? "Hide details" : "Error details"}
        </button>

        {/* Expandable Error Details */}
        {showDetails && error?.message && (
          <div
            className="
              mt-2 p-3 w-full
              text-xs text-red-300
              bg-red-900/20
              rounded-lg
              font-mono text-left
              max-h-[200px] overflow-auto
            "
          >
            <p className="wrap-break-word">{error.message}</p>
            {error.digest && (
              <p className="mt-2 text-white/40">Digest: {error.digest}</p>
            )}
          </div>
        )}

        {/* Try Again Button */}
        <div className="w-full flex justify-center mt-6">
          <WaffleButton
            onClick={reset}
            className="w-full max-w-[280px] py-3 px-5 text-base"
          >
            Try Again
          </WaffleButton>
        </div>
      </div>
    </div>
  );
}
