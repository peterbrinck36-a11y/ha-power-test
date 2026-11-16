import { getSessionUser } from "@/lib/auth";
import {
  ReportError,
  buildReport,
  parseReportParams,
  reportCsv,
  reportFilename,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

function collectParams(url: URL): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const current = params[key];
    if (current === undefined) {
      params[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      params[key] = [current, value];
    }
  }
  return params;
}

/** Admin-only CSV download of a report; same parameters as the Reports page. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Not signed in", { status: 401 });
  }
  if (user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = parseReportParams(collectParams(new URL(request.url)));
  if ("error" in parsed) {
    return new Response(parsed.error, { status: 400 });
  }

  try {
    const result = buildReport(parsed.params);
    return new Response(reportCsv(result), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${reportFilename(parsed.params)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (cause) {
    const message =
      cause instanceof ReportError ? cause.message : "Could not build the report.";
    return new Response(message, { status: 400 });
  }
}
