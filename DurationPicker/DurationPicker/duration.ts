export type Unit = "minute" | "hour" | "day" | "week";

export const ALL_UNITS: Unit[] = ["minute", "hour", "day", "week"];

const MINUTES_PER: Record<Unit, number> = { minute: 1, hour: 60, day: 1440, week: 10080 };

const LABELS: Record<Unit, [singular: string, plural: string]> = {
    minute: ["minute", "minutes"],
    hour: ["hour", "hours"],
    day: ["day", "days"],
    week: ["week", "weeks"],
};

const ALIASES: Record<string, Unit> = {
    m: "minute", min: "minute", mins: "minute", minute: "minute", minutes: "minute",
    h: "hour", hr: "hour", hrs: "hour", hour: "hour", hours: "hour",
    d: "day", day: "day", days: "day",
    w: "week", wk: "week", wks: "week", week: "week", weeks: "week",
};

// Same presets as the built-in Duration control, plus weeks.
const PRESETS: Record<Unit, number[]> = {
    minute: [1, 15, 30, 45],
    hour: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8],
    day: [1, 2, 3],
    week: [1, 2, 3, 4],
};

const MAX_DECIMALS = 2;

/** The user's number format, taken from context.userSettings.numberFormattingInfo. */
export interface NumberFormat {
    decimalSeparator: string;
    groupSeparator: string;
    groupSize: number;
}

export interface Preset {
    minutes: number;
    label: string;
}

export type ParseResult = { minutes: number } | { error: string } | null;

/** Allowed units are expected in ALL_UNITS order (smallest first). */
export function formatDuration(minutes: number, allowed: Unit[], fmt: NumberFormat): string {
    const unit = [...allowed].reverse().find((u) => minutes >= MINUTES_PER[u]) ?? allowed[0];
    return formatAmount(minutes / MINUTES_PER[unit], unit, fmt);
}

export function parseDuration(text: string, allowed: Unit[], fmt: NumberFormat): ParseResult {
    const trimmed = text.trim();
    if (trimmed === "") {
        return null;
    }

    const match = numberPattern(fmt).exec(trimmed);
    if (!match) {
        return { error: invalidMessage(allowed, fmt) };
    }

    const amount = parseNumber(match[1], fmt);
    const unitText = match[2].toLowerCase();
    const unit = unitText === "" ? allowed[0] : ALIASES[unitText];
    if (!unit) {
        return { error: invalidMessage(allowed, fmt) };
    }
    if (!allowed.includes(unit)) {
        return { error: `${capitalize(LABELS[unit][1])} aren't allowed. Use ${joinOr(allowed.map((u) => LABELS[u][1]))}.` };
    }
    return { minutes: Math.round(amount * MINUTES_PER[unit]) };
}

export function getPresets(allowed: Unit[], fmt: NumberFormat): Preset[] {
    return allowed.flatMap((unit) =>
        PRESETS[unit].map((amount) => ({
            minutes: amount * MINUTES_PER[unit],
            label: formatAmount(amount, unit, fmt),
        }))
    );
}

export function describeAllowed(allowed: Unit[]): string {
    return `Allowed units: ${allowed.map((u) => LABELS[u][1]).join(", ")}`;
}

function formatAmount(amount: number, unit: Unit, fmt: NumberFormat): string {
    const rounded = Math.round(amount * 10 ** MAX_DECIMALS) / 10 ** MAX_DECIMALS;
    const [intPart, fracPart] = rounded.toFixed(MAX_DECIMALS).split(".");
    const grouped = intPart.replace(new RegExp(`\\B(?=(\\d{${fmt.groupSize}})+(?!\\d))`, "g"), fmt.groupSeparator);
    const fraction = fracPart.replace(/0+$/, "");
    const number = fraction ? `${grouped}${fmt.decimalSeparator}${fraction}` : grouped;
    return `${number} ${LABELS[unit][rounded === 1 ? 0 : 1]}`;
}

// Matches "<number>[ ]<unit letters>" where <number> uses the user's separators. Group separators
// are only accepted in valid positions, so in a locale like da-DK "1.5" is rejected rather than read as 15.
function numberPattern(fmt: NumberFormat): RegExp {
    const dec = escapeSeparator(fmt.decimalSeparator);
    const grp = escapeSeparator(fmt.groupSeparator);
    const n = fmt.groupSize;
    return new RegExp(`^((?:\\d{1,${n}}(?:${grp}\\d{${n}})+|\\d+)(?:${dec}\\d+)?)\\s*([a-z]*)$`, "i");
}

function parseNumber(text: string, fmt: NumberFormat): number {
    const grp = new RegExp(escapeSeparator(fmt.groupSeparator), "g");
    return Number(text.replace(grp, "").replace(fmt.decimalSeparator, "."));
}

// Locales with a space group separator often use a non-breaking space; accept any whitespace for it.
function escapeSeparator(sep: string): string {
    return sep.trim() === "" ? "\\s" : sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function invalidMessage(allowed: Unit[], fmt: NumberFormat): string {
    const unit = allowed.includes("hour") ? "hour" : allowed[0];
    return `Enter a duration such as ${formatAmount(1.5, unit, fmt)}.`;
}

function joinOr(items: string[]): string {
    return items.length > 1 ? `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}` : items[0];
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
