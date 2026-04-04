"use client";

import { GameActionResult } from "@/actions/admin/games";
import Link from "next/link";
import {
  CalendarIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ClockIcon,
  UserGroupIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  useActionState,
  useState,
  useRef,
  useMemo,
  useTransition,
} from "react";
import { ConfirmationModal } from "@/components/admin/ConfirmationModal";

interface GameFormProps {
  action: (
    prevState: GameActionResult | null,
    formData: FormData
  ) => Promise<GameActionResult>;
  initialData?: {
    platform: string;
    startsAt: Date;
    endsAt: Date;
    ticketsOpenAt: Date | null;
    tierPrices: number[];
    roundBreakSec: number;
    maxPlayers: number;
  };
  isEdit?: boolean;
}

/** Format a Date to `YYYY-MM-DDTHH:mm` for datetime-local inputs */
function toDatetimeLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function GameForm({
  action,
  initialData,
  isEdit = false,
}: GameFormProps) {
  const [state, formAction] = useActionState<GameActionResult | null, FormData>(
    action,
    null
  );

  // Form state
  const [platform, setPlatform] = useState(initialData?.platform || "FARCASTER");
  const [createOnMultiplePlatforms, setCreateOnMultiplePlatforms] = useState(false);
  const [ticketPrice, setTicketPrice] = useState(
    initialData?.tierPrices?.[0]?.toString() || "1"
  );

  const [roundDuration, setRoundDuration] = useState(
    initialData?.roundBreakSec?.toString() || "15"
  );
  const [maxPlayers, setMaxPlayers] = useState(
    initialData?.maxPlayers?.toString() || "100"
  );
  const [skipQuestions, setSkipQuestions] = useState(false);
  const [startsAt, setStartsAt] = useState(() => {
    const d = initialData?.startsAt
      ? new Date(initialData.startsAt)
      : new Date(Date.now() + 2 * 60 * 1000);
    return toDatetimeLocal(d);
  });
  // Calculate initial duration if editing
  const initialDuration = initialData?.startsAt && initialData?.endsAt
    ? Math.round((new Date(initialData.endsAt).getTime() - new Date(initialData.startsAt).getTime()) / 60000)
    : 30;
  const [durationMinutes, setDurationMinutes] = useState(initialDuration.toString());

  // Tickets open scheduling
  const [enableTicketsOpen, setEnableTicketsOpen] = useState(!!initialData?.ticketsOpenAt);
  const [ticketsOpenAt, setTicketsOpenAt] = useState(() => {
    if (!initialData?.ticketsOpenAt) return "";
    return toDatetimeLocal(new Date(initialData.ticketsOpenAt));
  });

  // UI state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  // Calculate end time from start + duration
  // IMPORTANT: Keep in local datetime-local format (YYYY-MM-DDTHH:mm)
  // Do NOT use toISOString() as it converts to UTC and breaks timezone handling
  const calculatedEndsAt = useMemo(() => {
    if (!startsAt || !durationMinutes) return "";
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + parseInt(durationMinutes) * 60000);
    return toDatetimeLocal(end);
  }, [startsAt, durationMinutes]);

  // Display duration text
  const durationDisplay = useMemo(() => {
    const mins = parseInt(durationMinutes);
    if (!mins) return null;
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }, [durationMinutes]);

  /**
   * Converts a datetime-local string to ISO 8601 format with timezone info.
   * This ensures consistent timezone handling between client and server.
   * datetime-local gives "2025-01-13T14:00" - we need to add timezone offset.
   */
  const toISOWithTimezone = (datetimeLocalValue: string): string => {
    if (!datetimeLocalValue) return "";
    // Create date from local value - JavaScript parses this in local timezone
    const date = new Date(datetimeLocalValue);
    // Return ISO string (always in UTC with 'Z' suffix)
    return date.toISOString();
  };

  // Form submission handler
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validation
    if (!startsAt) {
      setValidationError("Please set a start time");
      return;
    }
    if (!durationMinutes) {
      setValidationError("Please select a duration");
      return;
    }

    setValidationError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("platform", platform);
    formData.set(
      "createOnMultiplePlatforms",
      createOnMultiplePlatforms ? "true" : "false"
    );

    // CRITICAL: Convert datetime-local values to UTC ISO strings
    // This fixes timezone inconsistency between local and production servers
    formData.set("startsAt", toISOWithTimezone(startsAt));
    formData.set("endsAt", toISOWithTimezone(calculatedEndsAt));
    formData.set(
      "ticketsOpenAt",
      enableTicketsOpen && ticketsOpenAt ? toISOWithTimezone(ticketsOpenAt) : "",
    );
    formData.set("skipQuestions", skipQuestions ? "true" : "false");

    // For edit mode, submit directly
    if (isEdit) {
      startTransition(async () => {
        try {
          const result = await action(null, formData);
          if (result?.success) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          }
        } catch (err) {
          console.error("Update failed:", err);
        }
      });
      return;
    }

    // For create mode, show confirmation
    setPendingFormData(formData);
    setShowConfirmation(true);
  };

  // Confirm game creation
  const handleConfirmCreate = () => {
    if (!pendingFormData) return;

    startTransition(async () => {
      try {
        await formAction(pendingFormData);
      } finally {
        setShowConfirmation(false);
        setPendingFormData(null);
      }
    });
  };

  // Get preview items for confirmation
  const getPreviewItems = () => {
    if (!pendingFormData) return [];
    const platformValue = pendingFormData.get("platform");
    const isMultiPlatform = pendingFormData.get("createOnMultiplePlatforms") === "true";
    const platformLabel = isMultiPlatform
      ? "Farcaster + MiniPay"
      : platformValue === "MINIPAY"
        ? "MiniPay"
        : "Farcaster";
    return [
      { label: "Platform", value: platformLabel },
      { label: "Title", value: "Waffles#00" },
      { label: "Theme", value: "Movies" },
      { label: "Starts", value: startsAt ? new Date(startsAt).toLocaleString() : "—" },
      ...(enableTicketsOpen && ticketsOpenAt
        ? [{ label: "Tickets Open", value: new Date(ticketsOpenAt).toLocaleString() }]
        : [{ label: "Tickets Open", value: "Immediately" }]),
      { label: "Ticket Price", value: `$${pendingFormData.get("ticketPrice")} USDC` },
    ];
  };

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleFormSubmit}
        className="max-w-3xl mx-auto space-y-8 font-display"
      >
        {/* Error Display */}
        {((state && !state.success && "error" in state) || validationError) && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
            <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              {validationError || (state && "error" in state ? state.error : "")}
            </p>
          </div>
        )}

        {/* Success Display */}
        {showSuccess && (
          <div className="p-4 bg-[#14B985]/10 border border-[#14B985]/30 rounded-xl flex items-center gap-3 text-[#14B985]">
            <CheckIcon className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Game updated successfully!</p>
          </div>
        )}

        {/* 1. Platform Selection */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-[#14B985]/15">
              <CalendarIcon className="h-5 w-5 text-[#14B985]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Choose Platform</h3>
              <p className="text-sm text-white/50">Pick where this game will run.</p>
            </div>
          </div>

          {!isEdit && (
            <div className="mb-4 rounded-2xl border border-[#14B985]/20 bg-[#14B985]/10 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={createOnMultiplePlatforms}
                  onChange={(e) => setCreateOnMultiplePlatforms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-[#14B985] focus:ring-[#14B985]/50"
                />
                <span>
                  <span className="block font-medium text-white">
                    Create on both platforms
                  </span>
                  <span className="mt-1 block text-sm text-white/55">
                    This creates separate Farcaster and MiniPay game records linked under one launch group.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                value: "FARCASTER",
                label: "Farcaster",
                description: "Use the Farcaster audience and flow.",
              },
              {
                value: "MINIPAY",
                label: "MiniPay",
                description: "Use the MiniPay audience and flow.",
              },
            ].map((option) => {
              const isSelected = platform === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPlatform(option.value)}
                  disabled={!isEdit && createOnMultiplePlatforms}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-[#FFC931] bg-[#FFC931]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  } ${!isEdit && createOnMultiplePlatforms ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-white">{option.label}</div>
                      <p className="mt-1 text-sm text-white/55">{option.description}</p>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC931]">
                        <CheckIcon className="h-3.5 w-3.5 text-black" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="platform" value={platform} />
        </section>

        {/* 3. Schedule - World Class UX */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-[#14B985]/15">
              <ClockIcon className="h-5 w-5 text-[#14B985]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Schedule</h3>
              <p className="text-sm text-white/50">When should the game run?</p>
            </div>
          </div>

          {/* Quick Start Presets */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
              Quick Start
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "In 2 min", minutes: 2 },
                { label: "In 5 min", minutes: 5 },
                { label: "In 30 min", minutes: 30 },
                { label: "In 1 hour", minutes: 60 },
                { label: "Tomorrow 3pm", tomorrow: true },
              ].map((preset) => {
                const getPresetTime = () => {
                  const now = new Date();
                  if (preset.tomorrow) {
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(15, 0, 0, 0);
                    return tomorrow;
                  }
                  return new Date(now.getTime() + (preset.minutes || 0) * 60000);
                };
                const presetDate = getPresetTime();
                const presetValue = toDatetimeLocal(presetDate);
                const isActive = startsAt === presetValue;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setStartsAt(presetValue)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                      ? "bg-[#14B985] text-white shadow-lg shadow-[#14B985]/25"
                      : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                      }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Time (collapsible or always visible) */}
          <div className="mb-6">
            <label htmlFor="startsAt" className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
              Or choose custom time
            </label>
            <input
              type="datetime-local"
              id="startsAt"
              name="startsAt"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#14B985]/50 focus:border-[#14B985] transition-all"
            />
          </div>

          {/* Duration Pills */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
              Duration
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "15 min", value: "15" },
                { label: "30 min", value: "30" },
                { label: "45 min", value: "45" },
                { label: "1 hour", value: "60" },
                { label: "2 hours", value: "120" },
                { label: "4 hours", value: "240" },
              ].map((duration) => (
                <button
                  key={duration.value}
                  type="button"
                  onClick={() => setDurationMinutes(duration.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${durationMinutes === duration.value
                    ? "bg-[#FFC931] text-[#0a0a0b] shadow-lg shadow-[#FFC931]/25"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                    }`}
                >
                  {duration.label}
                </button>
              ))}
              {/* Custom duration input */}
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="Custom"
                  value={!["15", "30", "45", "60", "120", "240"].includes(durationMinutes) ? durationMinutes : ""}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                />
                <span className="text-white/40 text-sm">min</span>
              </div>
            </div>
          </div>

          {/* Live Preview Bar */}
          {startsAt && durationMinutes && (
            <div className="p-4 bg-linear-to-r from-[#14B985]/10 to-[#FFC931]/10 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#14B985] animate-pulse" />
                  <span className="text-white/60 text-sm">Game runs:</span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-white">
                    {new Date(startsAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })}
                    {" → "}
                    {new Date(calculatedEndsAt).toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })}
                  </div>
                  <div className="text-xs text-white/50">
                    {durationDisplay} duration
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hidden input for endsAt */}
          <input type="hidden" name="endsAt" value={calculatedEndsAt} />
        </section>

        {/* Ticket Open Schedule */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FFC931]/15">
                <ClockIcon className="h-5 w-5 text-[#FFC931]" />
              </div>
              <div>
                <h3 className="font-bold text-white">Ticket Sales Window</h3>
                <p className="text-sm text-white/50">Schedule when tickets become available</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableTicketsOpen}
                onChange={(e) => {
                  setEnableTicketsOpen(e.target.checked);
                  if (!e.target.checked) setTicketsOpenAt("");
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#14B985]" />
            </label>
          </div>

          {enableTicketsOpen && (
            <>
              {/* Quick Presets - relative to game start */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                  Open tickets before game starts
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "6h before", hours: 6 },
                    { label: "12h before", hours: 12 },
                    { label: "24h before", hours: 24 },
                    { label: "48h before", hours: 48 },
                    { label: "1 week", hours: 168 },
                  ].map((preset) => {
                    const getPresetValue = () => {
                      if (!startsAt) return "";
                      const start = new Date(startsAt);
                      return toDatetimeLocal(new Date(start.getTime() - preset.hours * 3600000));
                    };
                    const presetValue = getPresetValue();
                    const isActive = ticketsOpenAt === presetValue;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={!startsAt}
                        onClick={() => setTicketsOpenAt(presetValue)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[#FFC931] text-[#0a0a0b] shadow-lg shadow-[#FFC931]/25"
                            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom time picker */}
              <div className="mb-4">
                <label htmlFor="ticketsOpenAt" className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                  Or set a custom time
                </label>
                <input
                  type="datetime-local"
                  id="ticketsOpenAt"
                  value={ticketsOpenAt}
                  onChange={(e) => setTicketsOpenAt(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                />
              </div>

              {/* Preview */}
              {ticketsOpenAt && (
                <div className="p-4 bg-linear-to-r from-[#FFC931]/10 to-[#14B985]/10 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FFC931] animate-pulse" />
                    <span className="text-white/60 text-sm">Tickets open:</span>
                    <span className="font-medium text-white">
                      {new Date(ticketsOpenAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {startsAt && ticketsOpenAt && (
                    <p className="text-xs text-white/40 mt-1 ml-5">
                      {(() => {
                        const diff = new Date(startsAt).getTime() - new Date(ticketsOpenAt).getTime();
                        const hours = Math.floor(diff / 3600000);
                        const mins = Math.floor((diff % 3600000) / 60000);
                        if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m ` : ""}before game starts`;
                        return `${mins}m before game starts`;
                      })()}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <input type="hidden" name="ticketsOpenAt" value={enableTicketsOpen ? ticketsOpenAt : ""} />
        </section>

        {/* 4. Pricing & Gameplay - Combined */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-[#FFC931]/15">
              <CurrencyDollarIcon className="h-5 w-5 text-[#FFC931]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Pricing & Settings</h3>
              <p className="text-sm text-white/50">Single-ticket pricing and game limits</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Ticket Price */}
            <div>
              <label htmlFor="ticketPrice" className="block text-sm font-medium text-white/70 mb-2">
                Ticket Price (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                <input
                  type="number"
                  id="ticketPrice"
                  name="ticketPrice"
                  required
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  min={0}
                  step="0.01"
                  className="w-full pl-7 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                />
              </div>
            </div>
            {/* Prize Pool Info (v5 - Dynamic) */}
            <div className="col-span-1 md:col-span-3">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Prize Pool
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-[#14B985]/10 border border-[#14B985]/30 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[#14B985]/20 flex items-center justify-center shrink-0">
                  <SparklesIcon className="h-4 w-4 text-[#14B985]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#14B985]">Dynamic</p>
                  <p className="text-xs text-white/50">Auto from tickets + sponsors</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gameplay Settings */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <label htmlFor="roundBreakSec" className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <ClockIcon className="h-4 w-4 text-white/40" />
                Round Break <span className="text-white/40">(sec)</span>
              </label>
              <input
                type="number"
                id="roundBreakSec"
                name="roundBreakSec"
                required
                value={roundDuration}
                onChange={(e) => setRoundDuration(e.target.value)}
                min={5}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
              />
            </div>

            <div>
              <label htmlFor="maxPlayers" className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <UserGroupIcon className="h-4 w-4 text-white/40" />
                Max Players
              </label>
              <input
                type="number"
                id="maxPlayers"
                name="maxPlayers"
                required
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                min={2}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
              />
            </div>
          </div>

          {/* Skip Auto-Questions (create only) */}
          {!isEdit && (
            <div className="pt-4 border-t border-white/10">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipQuestions}
                  onChange={(e) => setSkipQuestions(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-[#FFC931] focus:ring-[#FFC931]/50"
                />
                <span>
                  <span className="block font-medium text-white text-sm">
                    Create without questions
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    Skip auto-filling questions. You can add them manually later from the game detail page.
                  </span>
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Link
            href="/admin/games"
            className="px-6 py-3 text-white/60 font-medium hover:text-white transition-colors"
          >
            ← Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-[#FFC931] hover:bg-[#FFD966] text-black font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[#FFC931] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                {isEdit ? "Save Changes" : "Create Game"}
                <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => {
          if (!isPending) {
            setShowConfirmation(false);
            setPendingFormData(null);
          }
        }}
        onConfirm={handleConfirmCreate}
        title="Create New Game?"
        description="This will create a new trivia game. Players can join once it goes live."
        confirmText="Create Game"
        cancelText="Go Back"
        variant="warning"
        isLoading={isPending}
        previewItems={getPreviewItems()}
      />
    </>
  );
}
