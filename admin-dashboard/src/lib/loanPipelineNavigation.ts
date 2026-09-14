export const LOAN_PIPELINE_DETAIL_PATH = "/loan-pipeline/detail";

const STORAGE_KEY = "admin_loan_pipeline_application_id";

export function setLoanPipelineApplicationId(applicationId: string) {
  sessionStorage.setItem(STORAGE_KEY, applicationId);
}

export function getLoanPipelineApplicationId(
  state?: { applicationId?: string } | null,
): string | null {
  if (state?.applicationId) return state.applicationId;
  return sessionStorage.getItem(STORAGE_KEY) || null;
}

export function openLoanPipelineDetail(
  navigate: (
    path: string,
    options?: { state?: { applicationId: string } },
  ) => void,
  applicationId: string,
) {
  setLoanPipelineApplicationId(applicationId);
  navigate(LOAN_PIPELINE_DETAIL_PATH, { state: { applicationId } });
}
