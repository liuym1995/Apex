import { createEntityId, nowIso } from "@apex/shared-types";
import { recordAudit } from "./core.js";

export interface CronExpression {
  minute: number[];
  hour: number[];
  day_of_month: number[];
  month: number[];
  day_of_week: number[];
  original: string;
}

export interface CronNextFireResult {
  expression: string;
  from_time: string;
  next_fire_time: string;
  delay_ms: number;
}

export function parseCronExpression(expression: string): CronExpression {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}: "${expression}"`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59, "minute"),
    hour: parseCronField(parts[1], 0, 23, "hour"),
    day_of_month: parseCronField(parts[2], 1, 31, "day_of_month"),
    month: parseCronField(parts[3], 1, 12, "month"),
    day_of_week: parseCronField(parts[4], 0, 6, "day_of_week"),
    original: expression
  };
}

function parseCronField(field: string, min: number, max: number, fieldName: string): number[] {
  if (field === "*") {
    return range(min, max);
  }

  const values: number[] = [];
  const segments = field.split(",");

  for (const segment of segments) {
    if (segment.includes("/")) {
      const [rangePart, stepPart] = segment.split("/");
      const step = parseInt(stepPart, 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step in ${fieldName}: "${stepPart}"`);
      }

      let rangeStart = min;
      let rangeEnd = max;

      if (rangePart !== "*") {
        if (rangePart.includes("-")) {
          const [start, end] = rangePart.split("-").map(Number);
          rangeStart = start;
          rangeEnd = end;
        } else {
          rangeStart = parseInt(rangePart, 10);
        }
      }

      for (let i = rangeStart; i <= rangeEnd; i += step) {
        values.push(i);
      }
    } else if (segment.includes("-")) {
      const [start, end] = segment.split("-").map(Number);
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range in ${fieldName}: "${segment}"`);
      }
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
    } else {
      const value = parseInt(segment, 10);
      if (isNaN(value)) {
        throw new Error(`Invalid value in ${fieldName}: "${segment}"`);
      }
      values.push(value);
    }
  }

  const filtered = [...new Set(values)].filter(v => v >= min && v <= max).sort((a, b) => a - b);
  if (filtered.length === 0) {
    throw new Error(`No valid values in ${fieldName} for field "${field}"`);
  }

  return filtered;
}

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

export function getNextCronFireTime(expression: string | CronExpression, fromTime?: Date): CronNextFireResult {
  const cron = typeof expression === "string" ? parseCronExpression(expression) : expression;
  const from = fromTime ?? new Date();
  const fromStr = from.toISOString();

  const searchFrom = new Date(from.getTime());
  searchFrom.setSeconds(0, 0);
  searchFrom.setMinutes(searchFrom.getMinutes() + 1);

  for (let i = 0; i < 525960; i++) {
    if (cron.month.includes(searchFrom.getMonth() + 1) &&
        cron.day_of_month.includes(searchFrom.getDate()) &&
        cron.day_of_week.includes(searchFrom.getDay()) &&
        cron.hour.includes(searchFrom.getHours()) &&
        cron.minute.includes(searchFrom.getMinutes())) {
      const nextFireTime = searchFrom.toISOString();
      const delayMs = searchFrom.getTime() - from.getTime();
      return {
        expression: cron.original,
        from_time: fromStr,
        next_fire_time: nextFireTime,
        delay_ms: Math.max(0, delayMs)
      };
    }
    searchFrom.setMinutes(searchFrom.getMinutes() + 1);
  }

  throw new Error(`No matching fire time found within 1 year for cron: "${cron.original}"`);
}

export function getNextNCronFireTimes(expression: string | CronExpression, n: number, fromTime?: Date): CronNextFireResult[] {
  const results: CronNextFireResult[] = [];
  let currentFrom = fromTime ?? new Date();

  for (let i = 0; i < n; i++) {
    const result = getNextCronFireTime(expression, currentFrom);
    results.push(result);
    currentFrom = new Date(result.next_fire_time);
  }

  return results;
}

export function isValidCronExpression(expression: string): { valid: boolean; error?: string } {
  try {
    parseCronExpression(expression);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function describeCronExpression(expression: string): string {
  const cron = parseCronExpression(expression);
  const parts: string[] = [];

  if (cron.minute.length === 60 && cron.hour.length === 24) {
    parts.push("Every minute");
  } else if (cron.hour.length === 24) {
    parts.push(`Every hour at minute(s) ${cron.minute.join(", ")}`);
  } else if (cron.minute.length === 60) {
    parts.push(`Every minute during hour(s) ${cron.hour.join(", ")}`);
  } else {
    parts.push(`At minute(s) ${cron.minute.join(", ")} of hour(s) ${cron.hour.join(", ")}`);
  }

  if (cron.day_of_week.length < 7) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    parts.push(`on ${cron.day_of_week.map(d => dayNames[d]).join(", ")}`);
  } else if (cron.day_of_month.length < 31) {
    parts.push(`on day(s) ${cron.day_of_month.join(", ")} of the month`);
  }

  if (cron.month.length < 12) {
    const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    parts.push(`in ${cron.month.map(m => monthNames[m]).join(", ")}`);
  }

  return parts.join(", ");
}
