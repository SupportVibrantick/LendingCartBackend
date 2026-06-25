import { Check } from "lucide-react";

type LoanApplicationStepperProps = {
  steps: string[];
  currentStep: number;
  onStepClick: (index: number) => void;
};

export default function LoanApplicationStepper({
  steps,
  currentStep,
  onStepClick,
}: LoanApplicationStepperProps) {
  return (
    <nav aria-label="Loan application progress" className="mb-4 w-full">
      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={`${step}-${index}`}
              className={`flex items-start ${isLast ? "shrink-0" : "min-w-0 flex-1"}`}
            >
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className="group flex shrink-0 flex-col items-center gap-1.5 focus:outline-none"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isCompleted || isActive
                      ? "bg-[#2C92D5] text-white shadow-sm"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={`max-w-[5.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-[7rem] sm:text-xs ${
                    isActive
                      ? "text-[#2C92D5]"
                      : isCompleted
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {step}
                </span>
              </button>

              {!isLast && (
                <div
                  aria-hidden
                  className={`mx-1 mt-[18px] h-0.5 min-w-3 flex-1 rounded-full ${
                    index < currentStep
                      ? "bg-[#2C92D5]"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
