"use client";

import { GameActionResult } from "@/actions/admin/games";
import Link from "next/link";
import {
  CalendarIcon,
  CurrencyDollarIcon,
  PuzzlePieceIcon,
  PhotoIcon,
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
import { MediaPicker } from "@/components/admin/MediaPicker";
import { ConfirmationModal } from "@/components/admin/ConfirmationModal";
import { THEMES } from "@/lib/constants";

interface GameFormProps {
  action: (
    prevState: GameActionResult | null,
    formData: FormData
  ) => Promise<GameActionResult>;
  initialData?: {
    platform: string;
    title: string;
    description?: string | null;
    theme: string;
    coverUrl?: string | null;
    startsAt: Date;
    endsAt: Date;
    tierPrices: number[];
    roundBreakSec: number;
    maxPlayers: number;
  };
  isEdit?: boolean;
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
  const [selectedTheme, setSelectedTheme] = useState(initialData?.theme || "");
  const [coverUrl, setCoverUrl] = useState(initialData?.coverUrl || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [ticketPrice, setTicketPrice] = useState(
    initialData?.tierPrices?.[0]?.toString() || "1"
  );

  const [roundDuration, setRoundDuration] = useState(
    initialData?.roundBreakSec?.toString() || "15"
  );
  const [maxPlayers, setMaxPlayers] = useState(
    initialData?.maxPlayers?.toString() || "100"
  );
  const [startsAt, setStartsAt] = useState(() => {
    if (!initialData?.startsAt) return "";
    const d = new Date(initialData.startsAt);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  // Calculate initial duration if editing
  const initialDuration = initialData?.startsAt && initialData?.endsAt
    ? Math.round((new Date(initialData.endsAt).getTime() - new Date(initialData.startsAt).getTime()) / 60000)
    : 30;
  const [durationMinutes, setDurationMinutes] = useState(initialDuration.toString());

  // UI state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const currentTheme = useMemo(
    () => THEMES.find((t) => t.id === selectedTheme),
    [selectedTheme]
  );

  // Calculate end time from start + duration
  // IMPORTANT: Keep in local datetime-local format (YYYY-MM-DDTHH:mm)
  // Do NOT use toISOString() as it converts to UTC and breaks timezone handling
  const calculatedEndsAt = useMemo(() => {
    if (!startsAt || !durationMinutes) return "";
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + parseInt(durationMinutes) * 60000);
    // Format as local datetime-local string (same format as input)
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, "0");
    const day = String(end.getDate()).padStart(2, "0");
    const hours = String(end.getHours()).padStart(2, "0");
    const minutes = String(end.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    if (!selectedTheme) {
      setValidationError("Please select a theme");
      return;
    }
    if (!title.trim()) {
      setValidationError("Please enter a game title");
      return;
    }
    if (!coverUrl) {
      setValidationError("Please add a cover image");
      return;
    }
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

    // CRITICAL: Convert datetime-local values to UTC ISO strings
    // This fixes timezone inconsistency between local and production servers
    formData.set("startsAt", toISOWithTimezone(startsAt));
    formData.set("endsAt", toISOWithTimezone(calculatedEndsAt));

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
    const themeData = THEMES.find((t) => t.id === pendingFormData.get("theme"));
    return [
      { label: "Title", value: pendingFormData.get("title")?.toString() || "Untitled" },
      { label: "Theme", value: themeData ? `${themeData.icon} ${themeData.label}` : "—" },
      { label: "Starts", value: startsAt ? new Date(startsAt).toLocaleString() : "—" },
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

        {/* 1. Theme Selection */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-[#FFC931]/15">
              <SparklesIcon className="h-5 w-5 text-[#FFC931]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Choose Theme</h3>
              <p className="text-sm text-white/50">What&apos;s this game about?</p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  setSelectedTheme(theme.id);
                  setValidationError(null);
                }}
                className={`relative group p-4 rounded-xl border-2 transition-all text-center ${selectedTheme === theme.id
                  ? "border-[#FFC931] bg-[#FFC931]/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  }`}
              >
                {selectedTheme === theme.id && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FFC931] flex items-center justify-center">
                    <CheckIcon className="h-3 w-3 text-black" />
                  </div>
                )}
                <div className="text-2xl mb-1">{theme.icon}</div>
                <div className="text-xs font-medium text-white">{theme.label}</div>
              </button>
            ))}
          </div>
          <input type="hidden" name="theme" value={selectedTheme} />
        </section>

        {/* 2. Basic Info */}
        <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-[#00CFF2]/15">
              <PuzzlePieceIcon className="h-5 w-5 text-[#00CFF2]" />
            </div>
            <div>
              <h3 className="font-bold text-white">Basic Info</h3>
              <p className="text-sm text-white/50">Name and description</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="platform" className="block text-sm font-medium text-white/70 mb-2">
                Platform <span className="text-red-400">*</span>
              </label>
              <select
                id="platform"
                name="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
              >
                <option value="FARCASTER" className="bg-[#0a0a0b]">Farcaster</option>
                <option value="MINIPAY" className="bg-[#0a0a0b]">MiniPay</option>
              </select>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-white/70 mb-2">
                Game Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                placeholder="Friday Night Football Trivia"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-white/70 mb-2">
                Description <span className="text-white/30">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all resize-none"
                placeholder="Brief description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Cover Image <span className="text-red-400">*</span>
              </label>
              <MediaPicker
                label=""
                name="coverUrl"
                accept="image"
                onSelect={setCoverUrl}
                selectedUrl={coverUrl}
              />
            </div>
          </div>
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
                const presetValue = `${presetDate.getFullYear()}-${String(presetDate.getMonth() + 1).padStart(2, "0")}-${String(presetDate.getDate()).padStart(2, "0")}T${String(presetDate.getHours()).padStart(2, "0")}:${String(presetDate.getMinutes()).padStart(2, "0")}`;
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
