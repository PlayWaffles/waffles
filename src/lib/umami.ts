import { UserPlatform } from "@prisma";

type UmamiLoginResponse = {
  token: string;
};

type UmamiSeriesPoint = {
  x: string;
  y: number;
};

type UmamiPageviewsResponse = {
  pageviews: UmamiSeriesPoint[];
  sessions: UmamiSeriesPoint[];
};

type UmamiStatsResponse = {
  visitors: number;
};

type UmamiExpandedMetricRow = {
  name: string;
  visitors: number;
};

type UmamiRequestContext = {
  baseUrl: string;
  websiteId: string;
  token: string;
  timezone: string;
};

type UmamiMetricScope = {
  platform?: string | null;
};

export class UmamiAnalyticsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UmamiAnalyticsError";
  }
}

function toUmamiAnalyticsError(error: unknown) {
  if (error instanceof UmamiAnalyticsError) return error;

  const message = error instanceof Error
    ? error.message
    : "Umami analytics request failed.";

  return new UmamiAnalyticsError(message, error instanceof Error ? { cause: error } : undefined);
}

function getUmamiBaseUrl() {
  const host = process.env.UMAMI_HOST ?? process.env.NEXT_PUBLIC_UMAMI_HOST;
  if (!host) {
    throw new UmamiAnalyticsError("UMAMI_HOST or NEXT_PUBLIC_UMAMI_HOST is required for admin analytics.");
  }
  return host.replace(/\/$/, "");
}

function getUmamiWebsiteId() {
  const websiteId = process.env.UMAMI_WEBSITE_ID ?? process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId) {
    throw new UmamiAnalyticsError("UMAMI_WEBSITE_ID or NEXT_PUBLIC_UMAMI_WEBSITE_ID is required for admin analytics.");
  }
  return websiteId;
}

async function getUmamiAuthToken(baseUrl: string) {
  const apiKey = process.env.UMAMI_API_KEY;
  if (apiKey) return apiKey;

  const username = process.env.UMAMI_USERNAME ?? (process.env.NODE_ENV === "production" ? undefined : "admin");
  const password = process.env.UMAMI_PASSWORD ?? (process.env.NODE_ENV === "production" ? undefined : "umami");

  if (!username || !password) {
    throw new UmamiAnalyticsError("UMAMI_API_KEY or UMAMI_USERNAME/UMAMI_PASSWORD is required for admin analytics.");
  }

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new UmamiAnalyticsError(`Umami login failed with status ${response.status}.`);
  }

  const body = await response.json() as UmamiLoginResponse;
  if (!body.token) {
    throw new UmamiAnalyticsError("Umami login response did not include a token.");
  }

  return body.token;
}

function getAnalyticsTimezone() {
  return process.env.UMAMI_TIMEZONE
    ?? process.env.TZ
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    ?? "UTC";
}

function getHourInTimezone(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);

  return Number(hour) % 24;
}

async function getUmamiRequestContext(): Promise<UmamiRequestContext> {
  const baseUrl = getUmamiBaseUrl();
  const websiteId = getUmamiWebsiteId();
  const token = await getUmamiAuthToken(baseUrl);
  const timezone = getAnalyticsTimezone();

  return { baseUrl, websiteId, token, timezone };
}

function getPlatformTag(scope?: UmamiMetricScope) {
  if (!scope?.platform) return null;
  return Object.values(UserPlatform).includes(scope.platform as UserPlatform)
    ? scope.platform
    : null;
}

function applyMetricScope(params: URLSearchParams, scope?: UmamiMetricScope) {
  const tag = getPlatformTag(scope);
  if (tag) params.set("tag", tag);
}

async function getUmamiPageviews(
  context: UmamiRequestContext,
  start: Date,
  end: Date,
  scope?: UmamiMetricScope,
) {
  const params = new URLSearchParams({
    startAt: String(start.getTime()),
    endAt: String(end.getTime()),
    unit: "hour",
    timezone: context.timezone,
  });
  applyMetricScope(params, scope);
  const response = await fetch(`${context.baseUrl}/api/websites/${context.websiteId}/pageviews?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${context.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new UmamiAnalyticsError(`Umami pageviews request failed with status ${response.status}.`);
  }

  return await response.json() as UmamiPageviewsResponse;
}

async function getUmamiStats(
  context: UmamiRequestContext,
  start: Date,
  end: Date,
  scope?: UmamiMetricScope,
) {
  const params = new URLSearchParams({
    startAt: String(start.getTime()),
    endAt: String(end.getTime()),
  });
  applyMetricScope(params, scope);
  const response = await fetch(`${context.baseUrl}/api/websites/${context.websiteId}/stats?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${context.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new UmamiAnalyticsError(`Umami stats request failed with status ${response.status}.`);
  }

  return await response.json() as UmamiStatsResponse;
}

async function getUmamiEventMetrics(
  context: UmamiRequestContext,
  start: Date,
  end: Date,
  scope?: UmamiMetricScope,
) {
  const params = new URLSearchParams({
    startAt: String(start.getTime()),
    endAt: String(end.getTime()),
    type: "event",
    limit: "500",
  });
  applyMetricScope(params, scope);
  const response = await fetch(`${context.baseUrl}/api/websites/${context.websiteId}/metrics/expanded?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${context.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new UmamiAnalyticsError(`Umami event metrics request failed with status ${response.status}.`);
  }

  return await response.json() as UmamiExpandedMetricRow[];
}

function hourlySessionsFromPageviews(body: UmamiPageviewsResponse, timezone: string) {
  const sessionsByHour = Array.from({ length: 24 }, () => 0);

  for (const point of body.sessions ?? []) {
    const hour = getHourInTimezone(point.x, timezone);
    if (hour === null) continue;
    sessionsByHour[hour] += point.y;
  }

  return sessionsByHour;
}

export async function getHourlyUmamiActivity(start: Date, end: Date) {
  const context = await getUmamiRequestContext();
  const pageviews = await getUmamiPageviews(context, start, end);
  return hourlySessionsFromPageviews(pageviews, context.timezone);
}

export async function getUmamiOverviewMetrics(
  start: Date,
  end: Date,
  scope?: UmamiMetricScope,
) {
  try {
    const context = await getUmamiRequestContext();
    const periodMs = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodMs);
    const last24hStart = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const [pageviews, currentStats, previousStats, dailyStats, eventMetrics] = await Promise.all([
      getUmamiPageviews(context, start, end),
      getUmamiStats(context, start, end, scope),
      getUmamiStats(context, previousStart, start, scope),
      getUmamiStats(context, last24hStart, end, scope),
      getUmamiEventMetrics(context, start, end, scope),
    ]);
    const activeVisitors = currentStats.visitors ?? 0;
    const levelCompletedVisitors = eventMetrics.find((row) => row.name === "level_completed")?.visitors ?? 0;

    return {
      sessionsByHour: hourlySessionsFromPageviews(pageviews, context.timezone),
      activeVisitors,
      previousActiveVisitors: previousStats.visitors ?? 0,
      dailyVisitors: dailyStats.visitors ?? 0,
      levelCompletedVisitors,
      onboardingRate: activeVisitors > 0 ? (levelCompletedVisitors / activeVisitors) * 100 : 0,
    };
  } catch (error) {
    throw toUmamiAnalyticsError(error);
  }
}
