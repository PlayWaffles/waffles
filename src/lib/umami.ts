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

type UmamiRequestContext = {
  baseUrl: string;
  websiteId: string;
  token: string;
  timezone: string;
};

function getUmamiBaseUrl() {
  const host = process.env.UMAMI_HOST ?? process.env.NEXT_PUBLIC_UMAMI_HOST;
  if (!host) {
    throw new Error("UMAMI_HOST or NEXT_PUBLIC_UMAMI_HOST is required for admin analytics.");
  }
  return host.replace(/\/$/, "");
}

function getUmamiWebsiteId() {
  const websiteId = process.env.UMAMI_WEBSITE_ID ?? process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId) {
    throw new Error("UMAMI_WEBSITE_ID or NEXT_PUBLIC_UMAMI_WEBSITE_ID is required for admin analytics.");
  }
  return websiteId;
}

async function getUmamiAuthToken(baseUrl: string) {
  const apiKey = process.env.UMAMI_API_KEY;
  if (apiKey) return apiKey;

  const username = process.env.UMAMI_USERNAME ?? (process.env.NODE_ENV === "production" ? undefined : "admin");
  const password = process.env.UMAMI_PASSWORD ?? (process.env.NODE_ENV === "production" ? undefined : "umami");

  if (!username || !password) {
    throw new Error("UMAMI_API_KEY or UMAMI_USERNAME/UMAMI_PASSWORD is required for admin analytics.");
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
    throw new Error(`Umami login failed with status ${response.status}.`);
  }

  const body = await response.json() as UmamiLoginResponse;
  if (!body.token) {
    throw new Error("Umami login response did not include a token.");
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

async function getUmamiPageviews(
  context: UmamiRequestContext,
  start: Date,
  end: Date,
) {
  const params = new URLSearchParams({
    startAt: String(start.getTime()),
    endAt: String(end.getTime()),
    unit: "hour",
    timezone: context.timezone,
  });
  const response = await fetch(`${context.baseUrl}/api/websites/${context.websiteId}/pageviews?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${context.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Umami pageviews request failed with status ${response.status}.`);
  }

  return await response.json() as UmamiPageviewsResponse;
}

async function getUmamiStats(
  context: UmamiRequestContext,
  start: Date,
  end: Date,
) {
  const params = new URLSearchParams({
    startAt: String(start.getTime()),
    endAt: String(end.getTime()),
  });
  const response = await fetch(`${context.baseUrl}/api/websites/${context.websiteId}/stats?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${context.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Umami stats request failed with status ${response.status}.`);
  }

  return await response.json() as UmamiStatsResponse;
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

export async function getUmamiOverviewMetrics(start: Date, end: Date) {
  const context = await getUmamiRequestContext();
  const periodMs = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - periodMs);
  const last24hStart = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const [pageviews, currentStats, previousStats, dailyStats] = await Promise.all([
    getUmamiPageviews(context, start, end),
    getUmamiStats(context, start, end),
    getUmamiStats(context, previousStart, start),
    getUmamiStats(context, last24hStart, end),
  ]);

  return {
    sessionsByHour: hourlySessionsFromPageviews(pageviews, context.timezone),
    activeVisitors: currentStats.visitors ?? 0,
    previousActiveVisitors: previousStats.visitors ?? 0,
    dailyVisitors: dailyStats.visitors ?? 0,
  };
}
