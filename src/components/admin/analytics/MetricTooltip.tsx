import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface MetricTooltipProps {
  content: string;
}

export function MetricTooltip({ content }: MetricTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white/30 transition hover:text-white/70 focus:outline-none"
        aria-label={content}
      >
        <InformationCircleIcon className="h-4 w-4" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111214] px-3 py-2 text-left text-xs leading-5 text-white/75 shadow-2xl group-hover:block group-focus-within:block">
        {content}
      </span>
    </span>
  );
}
