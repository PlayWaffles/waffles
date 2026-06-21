// Shared date range utilities - can be used on both server and client

export const DATE_PRESETS = [
  { label: "Today", value: "today", days: 0 },
  { label: "7D", value: "7d", days: 7 },
  { label: "14D", value: "14d", days: 14 },
  { label: "30D", value: "30d", days: 30 },
  { label: "90D", value: "90d", days: 90 },
  { label: "All", value: "all", days: null },
] as const;

function parseDateInput(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

export function getDateRangeFromParam(range: string, startDate?: string, endDate?: string): {
  start: Date;
  end: Date;
  label: string;
} {
  const end = new Date();

  if (range === "custom") {
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);

    if (parsedStart && parsedEnd && parsedStart <= parsedEnd) {
      return {
        start: startOfDay(parsedStart),
        end: endOfDay(parsedEnd),
        label: `${startDate} to ${endDate}`,
      };
    }

    throw new Error("Custom analytics date range requires valid startDate and endDate values in YYYY-MM-DD order.");
  }

  const preset = DATE_PRESETS.find((p) => p.value === range) ?? DATE_PRESETS.find((p) => p.value === "7d")!;

  if (preset.days === null) {
    // All time - start from Jan 1, 2024
    return {
      start: new Date("2024-01-01"),
      end,
      label: "All Time",
    };
  }

  if (preset.value === "today") {
    return {
      start: startOfDay(end),
      end,
      label: "Today",
    };
  }

  const start = new Date(end.getTime() - preset.days * 24 * 60 * 60 * 1000);
  return {
    start,
    end,
    label: `Last ${preset.days} days`,
  };
}
