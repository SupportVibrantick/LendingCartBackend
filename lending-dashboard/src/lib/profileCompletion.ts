export type LenderProfileCompletionInput = {
  summary?: string | null;
  loanTypes?: string[] | null;
  minFunding?: string | number | null;
  maxFunding?: string | number | null;
  statesSupported?: string | null;
  profileStatus?: string | null;
};

export function isLenderProfileComplete(status?: string | null) {
  return status === "COMPLETED";
}

/** Fields required before a profile can be marked complete. */
export function getProfileCompletionGaps(
  profile: LenderProfileCompletionInput,
) {
  const gaps: string[] = [];

  if (!Array.isArray(profile.loanTypes) || profile.loanTypes.length === 0) {
    gaps.push("At least one loan program");
  }
  if (!profile.minFunding) {
    gaps.push("Minimum loan amount");
  }
  if (!profile.maxFunding) {
    gaps.push("Maximum loan amount");
  }
  if (!String(profile.statesSupported || "").trim()) {
    gaps.push("States served");
  }

  if (gaps.length === 0 && profile.profileStatus !== "COMPLETED") {
    gaps.push(
      "Finish all steps in Edit Full Profile and submit on the last step",
    );
  }

  return gaps;
}
