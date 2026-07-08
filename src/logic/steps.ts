export const STEP_COLOR_CLASSES = {
  neutral: "step-neutral",
  primary: "step-primary",
  secondary: "step-secondary",
  accent: "step-accent",
  info: "step-info",
  success: "step-success",
  warning: "step-warning",
  error: "step-error",
} as const;

export type StepColor = keyof typeof STEP_COLOR_CLASSES;

export interface StepItem {
  label: string;
  marker?: string;
  color?: StepColor;
  class?: string;
}

export interface ResolvedStepItem extends StepItem {
  colorClass: (typeof STEP_COLOR_CLASSES)[StepColor] | undefined;
  isCurrent: boolean;
}

export function resolveStepItems(
  items: StepItem[],
  currentStep: number | undefined,
  activeColor: StepColor,
): ResolvedStepItem[] {
  if (items.length === 0) {
    throw new Error("Steps requires at least one item.");
  }

  if (
    currentStep !== undefined &&
    (!Number.isInteger(currentStep) ||
      currentStep < 1 ||
      currentStep > items.length)
  ) {
    throw new Error(
      `Steps currentStep must be an integer between 1 and ${items.length}.`,
    );
  }

  return items.map((item, index) => {
    const position = index + 1;
    const color =
      item.color ??
      (currentStep !== undefined && position <= currentStep
        ? activeColor
        : undefined);

    return {
      ...item,
      colorClass: color ? STEP_COLOR_CLASSES[color] : undefined,
      isCurrent: position === currentStep,
    };
  });
}
