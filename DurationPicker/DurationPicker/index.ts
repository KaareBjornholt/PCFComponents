import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { DurationInput, DurationInputProps } from "./DurationInput";
import { ALL_UNITS, Unit } from "./duration";
import * as React from "react";

export class DurationPicker implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private currentValue: number | null = null;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const { value, allowMinutes, allowHours, allowDays, allowWeeks } = context.parameters;
        // Empty can arrive as null, undefined or NaN depending on the host (the test harness sends NaN).
        this.currentValue = Number.isFinite(value.raw) ? value.raw : null;

        const flags: Record<Unit, boolean> = {
            minute: allowMinutes.raw === "1",
            hour: allowHours.raw === "1",
            day: allowDays.raw === "1",
            week: allowWeeks.raw === "1",
        };
        let allowed = ALL_UNITS.filter((u) => flags[u]);
        if (allowed.length === 0) {
            console.warn("DurationPicker: no units are allowed in the control configuration; allowing all units.");
            allowed = ALL_UNITS;
        }

        const nf = context.userSettings.numberFormattingInfo;
        const props: DurationInputProps = {
            value: this.currentValue,
            allowed,
            numberFormat: {
                decimalSeparator: nf.numberDecimalSeparator,
                groupSeparator: nf.numberGroupSeparator,
                groupSize: nf.numberGroupSizes?.[0] || 3,
            },
            // Column range; durations are never negative, and the max fallback is the whole number limit.
            min: Math.max(0, value.attributes?.MinValue ?? 0),
            max: value.attributes?.MaxValue ?? 2147483647,
            disabled: context.mode.isControlDisabled || value.security?.editable === false,
            masked: value.security?.readable === false,
            onChange: (minutes) => {
                this.currentValue = minutes;
                this.notifyOutputChanged();
            },
        };
        return React.createElement(DurationInput, props);
    }

    public getOutputs(): IOutputs {
        return { value: this.currentValue ?? undefined };
    }

    public destroy(): void {
        // Nothing to clean up
    }
}
