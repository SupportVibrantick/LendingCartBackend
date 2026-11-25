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
    <nav
      aria-label="Loan application progress"
      className="mb-1 w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950 sm:px-4"
    >
      <ol className="flex min-w-[640px] w-full items-start sm:min-w-0">
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
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isCompleted
                      ? "bg-[#4C78F5] text-white"
                      : isActive
                        ? "bg-[#4C78F5] text-white ring-4 ring-[#4C78F5]/15"
                        : "border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={`max-w-[5.5rem] text-center text-[11px] font-semibold leading-tight sm:max-w-[7rem] ${
                    isActive
                      ? "text-[#4C78F5]"
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
                  className={`mx-1 mt-4 h-0.5 min-w-3 flex-1 rounded-full ${
                    index < currentStep
                      ? "bg-[#4C78F5]"
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
