const FEE_AGREEMENT_LIMITS = {
  brokerPointsMax: 100,
  upfrontFeeMax: 99_999_999.99,
  exclusivityMonthsMax: 360,
};

export function validateFeeAgreementForm(form: {
  brokerPoints?: unknown;
  upfrontFee?: unknown;
  exclusivityMonths?: unknown;
}): {
  brokerPoints: string;
  upfrontFee: string;
  exclusivityMonths: string;
} {
  const errors = {
    brokerPoints: "",
    upfrontFee: "",
    exclusivityMonths: "",
  };

  if (!form.brokerPoints?.toString().trim()) {
    errors.brokerPoints = "Broker fee is required";
  } else {
    const brokerPoints = Number(form.brokerPoints);
    if (!Number.isFinite(brokerPoints)) {
      errors.brokerPoints = "Enter a valid broker fee percentage";
    } else if (
      brokerPoints < 0 ||
      brokerPoints > FEE_AGREEMENT_LIMITS.brokerPointsMax
    ) {
      errors.brokerPoints = `Broker fee must be between 0 and ${FEE_AGREEMENT_LIMITS.brokerPointsMax}%`;
    }
  }

  if (!form.upfrontFee?.toString().trim()) {
    errors.upfrontFee = "Upfront fee is required";
  } else {
    const upfrontFee = Number(form.upfrontFee);
    if (!Number.isFinite(upfrontFee)) {
      errors.upfrontFee = "Enter a valid upfront fee amount";
    } else if (
      upfrontFee < 0 ||
      upfrontFee > FEE_AGREEMENT_LIMITS.upfrontFeeMax
    ) {
      errors.upfrontFee = "Upfront fee is too large";
    }
  }

  if (!form.exclusivityMonths?.toString().trim()) {
    errors.exclusivityMonths = "Exclusivity months is required";
  } else {
    const exclusivityMonths = Number(form.exclusivityMonths);
    if (!Number.isFinite(exclusivityMonths) || !Number.isInteger(exclusivityMonths)) {
      errors.exclusivityMonths = "Enter a whole number of months";
    } else if (
      exclusivityMonths < 0 ||
      exclusivityMonths > FEE_AGREEMENT_LIMITS.exclusivityMonthsMax
    ) {
      errors.exclusivityMonths = `Exclusivity must be between 0 and ${FEE_AGREEMENT_LIMITS.exclusivityMonthsMax} months`;
    }
  }

  return errors;
}
