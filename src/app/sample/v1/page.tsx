"use client";

/**
 * Sample page: v1 (pre-migration) onboarding
 *
 * Visit /sample/v1 to preview the original movie-trivia onboarding overlay
 * (OnboardingOverlay) that converted browsers into paying players — restored
 * from git history for side-by-side comparison with the current v2 flow.
 *
 * Pitch → interactive demo question → branching money payoff. Fed a mock demo
 * question here (the live flow uses getDemoQuestion()); completing the flow
 * loops it back to the start so the whole sequence can be replayed.
 */

import { useState } from "react";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import type { DemoQuestion } from "@/actions/onboarding";

// Stand-in for the real fixed demo template, so the preview is self-contained
// (no DB / auth). Movie-themed to match v1's "guess the scene" framing.
const SAMPLE_DEMO: DemoQuestion = {
  content: "Which heist movie ends with the crew blowing open a vault under a casino?",
  mediaUrl: null,
  options: ["Ocean's Eleven", "The Italian Job", "Inception", "Now You See Me"],
  correctIndex: 0,
};

export default function V1OnboardingPreview() {
  // Re-mount key — completing the flow bumps this to restart from slide one, so
  // the preview is an endless loop you can step through repeatedly.
  const [run, setRun] = useState(0);

  return (
    <div className="app-background" style={{ minHeight: "100dvh" }}>
      <OnboardingOverlay
        key={run}
        demoQuestion={SAMPLE_DEMO}
        onComplete={() => setRun((r) => r + 1)}
      />
    </div>
  );
}
