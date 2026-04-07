"use client";

import { useEffect, useState, useRef, useActionState, startTransition, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, useAnimation, AnimatePresence } from "framer-motion";

import { useUser } from "@/hooks/useUser";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { redeemInviteCodeAction, type ValidateReferralResult } from "@/actions/invite";
import posthog from "posthog-js";
import {
  shakeX,
  triggerShake,
} from "@/lib/animations";
import { playSound } from "@/lib/sounds";

import { InvitePageHeader } from "./_components/InviteHeader";
import { InviteInput } from "./_components/InviteInput";
import { StatusMessage } from "./_components/StatusMessage";

// ============================================
// TYPES
// ============================================
type Status = "idle" | "validating" | "success" | "failed";

// ============================================
// CONSTANTS
// ============================================
const SPRING = { type: "spring" as const, stiffness: 200, damping: 20 };
const CODE_LENGTH = 6;

// ============================================
// COMPONENT
// ============================================
export default function InvitePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refetch } = useUser();

  // Form state
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoValidated = useRef(false);

  // Animation controls
  const inputControls = useAnimation();
  const keyControls = useAnimation();
  const buttonControls = useAnimation();

  // Server action
  const [result, submitAction, isPending] = useActionState<ValidateReferralResult | null, FormData>(
    redeemInviteCodeAction,
    null
  );

  // Get initial code from URL
  const initialCode = searchParams.get("code") || searchParams.get("ref") || "";
  const userId = user?.id;

  // ============================================
  // EFFECTS
  // ============================================

  // Set initial code from URL
  useEffect(() => {
    if (initialCode && !code) {
      setCode(initialCode.toUpperCase());
    }
  }, [initialCode, code]);

  // Auto-validate URL code on mount
  useEffect(() => {
    if (initialCode.length === CODE_LENGTH && userId && !hasAutoValidated.current) {
      hasAutoValidated.current = true;
      handleSubmit(initialCode.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, userId]);

  // Handle server action result
  useEffect(() => {
    if (!result) return;

    if (result.valid) {
      setStatus("success");
      setError(null);
      playSound("codeValid");

      posthog.capture("referral_redeemed", {
        code: code.trim().toUpperCase(),
        source: initialCode ? "url" : "manual",
      });

      // Celebration animation on key
      keyControls.start({
        scale: [1, 1.2, 1],
        rotate: [0, 10, -10, 0],
        transition: { duration: 0.5 },
      });

      (async () => {
        await refetch();
        router.replace("/game");
      })();
    } else {
      setStatus("failed");
      setError(result.error);
      playSound("codeInvalid");

      // Shake the input on error
      triggerShake(inputControls);
      // Wiggle the key
      keyControls.start({
        x: [-5, 5, -5, 5, 0],
        transition: { duration: 0.3 },
      });
    }
  }, [result, refetch, router, inputControls, keyControls]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSubmit = useCallback((codeToSubmit?: string) => {
    const submitCode = (codeToSubmit || code).trim().toUpperCase();

    // Validate code length
    if (submitCode.length !== CODE_LENGTH) {
      setError("Code must be 6 characters");
      setStatus("failed");
      triggerShake(inputControls);
      return;
    }

    // Validate user is identified
    if (!userId) {
      setError("User not identified");
      setStatus("failed");
      return;
    }

    // Submit to server action
    setStatus("validating");
    inputRef.current?.blur();

    // Pulse the button while validating
    buttonControls.start({
      scale: [1, 1.02, 1],
      transition: { duration: 0.8, repeat: Infinity },
    });

    const formData = new FormData();
    formData.append("inviteCode", submitCode);
    formData.append("userId", userId);

    startTransition(() => {
      submitAction(formData);
    });
  }, [code, userId, inputControls, buttonControls, submitAction]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value.toUpperCase();
    setCode(newCode);

    // Clear error when typing
    if (error) {
      setError(null);
      setStatus("idle");
    }

    // Auto-submit when code is complete
    if (newCode.length === CODE_LENGTH && userId) {
      setTimeout(() => handleSubmit(newCode), 300);
    }
  };

  // ============================================
  // COMPUTED
  // ============================================
  const isDisabled = code.length !== CODE_LENGTH || isPending || status === "validating";
  const buttonText = isPending || status === "validating" ? "CHECKING..." : "GET IN";

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="flex flex-col h-full">
      <InvitePageHeader />

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-safe">
        {/* Floating Key Illustration */}
        <motion.div
          className="flex justify-center w-[95px] h-[113px] mx-auto my-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <motion.div
            animate={keyControls}
            initial={{ y: 0 }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Image
                src="/images/illustrations/invite-key.png"
                alt="Invite Key"
                width={95}
                height={113}
                priority
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-center font-normal font-body text-[44px] leading-[0.92] tracking-[-0.03em]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
        >
          ENTER YOUR <br /> INVITE CODE
        </motion.h2>

        {/* Form */}
        <form
          onSubmit={handleFormSubmit}
          className="w-full flex flex-col items-center gap-6"
          autoComplete="off"
        >
          <label htmlFor="inviteCodeInput" className="sr-only">
            Invite Code
          </label>

          {/* Input with shake animation */}
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.15 }}
          >
            <motion.div
              animate={inputControls}
              variants={shakeX}
            >
              <InviteInput
                ref={inputRef}
                id="inviteCodeInput"
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="INVITE CODE"
                maxLength={CODE_LENGTH}
                autoFocus={!initialCode}
                style={{ textTransform: "uppercase" }}
                inputMode="text"
                autoCapitalize="characters"
              />
            </motion.div>
          </motion.div>

          {/* Submit Button with tap animation */}
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.2 }}
          >
            <motion.div
              animate={buttonControls}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onAnimationComplete={() => {
                if (status !== "validating") {
                  buttonControls.stop();
                }
              }}
            >
              <WaffleButton disabled={isDisabled}>
                {buttonText}
              </WaffleButton>
            </motion.div>
          </motion.div>

          {/* Status Message */}
          <StatusMessage status={status} error={error} />
        </form>
      </div>
    </div>
  );
}
