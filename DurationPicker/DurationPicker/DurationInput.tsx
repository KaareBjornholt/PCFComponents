import * as React from "react";
import { Combobox, Field, Option, makeStyles } from "@fluentui/react-components";
import { NumberFormat, Unit, describeAllowed, formatDuration, getPresets, parseDuration } from "./duration";

export interface DurationInputProps {
    value: number | null;
    allowed: Unit[];
    numberFormat: NumberFormat;
    min: number;
    max: number;
    disabled: boolean;
    masked: boolean;
    onChange: (minutes: number | null) => void;
}

const useStyles = makeStyles({
    combobox: { width: "100%", minWidth: "unset" },
});

export const DurationInput: React.FC<DurationInputProps> = ({ value, allowed, numberFormat, min, max, disabled, masked, onChange }) => {
    const styles = useStyles();
    const format = (minutes: number | null) => (minutes === null ? "" : formatDuration(minutes, allowed, numberFormat));

    const [text, setText] = React.useState(() => format(value));
    const [error, setError] = React.useState<string>();
    const [open, setOpen] = React.useState(false);
    // True while the text holds typed input. Fluent selects the highlighted option on Tab/Enter even in
    // freeform mode; like the built-in control, typed text wins unless the user arrows to or clicks an option.
    const typed = React.useRef(false);

    const allowedKey = allowed.join(",");
    const formatKey = `${numberFormat.decimalSeparator}|${numberFormat.groupSeparator}|${numberFormat.groupSize}`;
    const presets = React.useMemo(() => getPresets(allowed, numberFormat), [allowedKey, formatKey]);

    // Re-sync when the bound value or the configuration changes from outside.
    React.useEffect(() => {
        typed.current = false;
        setText(format(value));
        setError(undefined);
    }, [value, allowedKey, formatKey]);

    const commit = (minutes: number | null) => {
        typed.current = false;
        setText(format(minutes));
        setError(undefined);
        if (minutes !== value) {
            onChange(minutes);
        }
    };

    const commitText = () => {
        // Untouched text is the rounded display value; re-parsing it could silently change the stored minutes.
        if (!typed.current) {
            return;
        }
        const result = parseDuration(text, allowed, numberFormat);
        if (result !== null && "error" in result) {
            setError(result.error);
        } else if (result !== null && (result.minutes < min || result.minutes > max)) {
            setError(min > 0 ? `Enter a duration between ${format(min)} and ${format(max)}.` : `Enter a duration up to ${format(max)}.`);
        } else {
            commit(result?.minutes ?? null);
        }
    };

    if (masked) {
        return <Combobox className={styles.combobox} appearance="filled-darker" value="***" disabled />;
    }

    return (
        <Field hint={describeAllowed(allowed)} validationState={error ? "error" : "none"} validationMessage={error}>
            <Combobox
                className={styles.combobox}
                appearance="filled-darker"
                freeform
                disabled={disabled}
                value={text}
                selectedOptions={value !== null && presets.some((p) => p.minutes === value) ? [String(value)] : []}
                open={open}
                onOpenChange={(_, data) => setOpen(data.open)}
                onChange={(e) => {
                    typed.current = true;
                    setText(e.target.value);
                }}
                onOptionSelect={(e, data) => {
                    if (data.optionValue !== undefined && !(e.type === "keydown" && typed.current)) {
                        commit(Number(data.optionValue));
                    }
                }}
                onBlur={commitText}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        typed.current = false;
                    } else if (e.key === "Enter" && (typed.current || !open)) {
                        setOpen(false);
                        commitText();
                    }
                }}
            >
                {presets.map((p) => (
                    <Option key={p.minutes} value={String(p.minutes)}>
                        {p.label}
                    </Option>
                ))}
            </Combobox>
        </Field>
    );
};
