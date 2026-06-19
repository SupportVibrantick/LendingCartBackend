import type { ReactNode, RefObject } from "react";
import {
  displayAgreementText,
  displayBrokerName,
  displayClientEntityLabel,
  displayExclusivityMonths,
  displayFeeAmount,
  displayFeePercent,
  displayGoverningLaw,
  formatIssuerPartyName,
  hasFeeTerms,
} from "../lib/feeAgreementDisplayUtils";

type Props = {
  data: any;
  pdfRef?: RefObject<HTMLDivElement | null>;
  currencySymbol?: string;
  children?: ReactNode;
};

export default function FeeAgreementDocument({
  data,
  pdfRef,
  currencySymbol = "$",
  children,
}: Props) {
  const brokerName = displayBrokerName(data.brokerName, data.brokerCompany);
  const brokerCompany = displayAgreementText(data.brokerCompany, "Not provided");
  const feeTermsPending = !hasFeeTerms(data);
  const logoSrc = data.brokerLogoUrl || "/loanAutomation.jpeg";
  const logoAlt =
    data.brokerBrandName || data.brokerCompany || "Broker Logo";

  return (
    <div
      ref={pdfRef}
      className="p-6 space-y-6 text-sm text-gray-700 leading-relaxed dark:text-slate-300"
    >
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <img
            src={logoSrc}
            alt={logoAlt}
            className={`object-contain ${
              data.brokerLogoUrl
                ? "h-24 max-w-[220px]"
                : "h-24 w-24 rounded-full"
            }`}
          />
        </div>

        <h1 className="text-xl font-bold">FINDER & FINANCIAL AGREEMENT</h1>

        <p className="text-xs text-gray-500">
          Date: {new Date(data.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div>
        <p>
          This Finder & Financial Agreement is made and entered into on{" "}
          <b>{new Date(data.createdAt).toLocaleDateString()}</b> by and between{" "}
          <b>
            {formatIssuerPartyName(data.clientName, data.clientEntityName)}
          </b>
          , whose address is{" "}
          <b>{displayAgreementText(data.clientAddress)}</b> ("Issuer"), and{" "}
          <b>
            {brokerName} ({brokerCompany})
          </b>
          , whose address is{" "}
          <b>{displayAgreementText(data.brokerAddress)}</b> ("Finder").
        </p>
      </div>

      <div>
        <p>
          <b>Subject Property / Business Address:</b>{" "}
          {displayAgreementText(data.subjectAddress)}
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          1. THE AGREEMENT
        </h2>

        <ul className="list-disc pl-5 space-y-2 marker:text-slate-400 dark:marker:text-slate-500">
          <li>
            Issuer agrees to engage in financial transactions including loan,
            equity investment, lease, credit facility, or similar.
          </li>
          <li>Finder acts solely as an intermediary.</li>
          <li>All fees payable at closing.</li>
          <li>
            Issuer shall not directly approach lenders introduced by Finder for
            36 months.
          </li>
          <li>
            Agreement remains valid for{" "}
            {feeTermsPending
              ? "the exclusivity period defined in Section 4"
              : displayExclusivityMonths(data.exclusivityMonths)}
            .
          </li>
        </ul>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          2. THE FEE
        </h2>

        {feeTermsPending && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Fee terms are pending. Your broker will update broker fee, upfront
            fee, and exclusivity period before signing.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Broker Fee
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {displayFeePercent(data.brokerPoints)}
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upfront Fee
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {displayFeeAmount(data.upfrontFee, currencySymbol)}
            </p>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exclusivity Period
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {displayExclusivityMonths(data.exclusivityMonths)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2">3. GOVERNING LAW</h2>
        <p>{displayGoverningLaw(data.brokerState, data.brokerCounty)}</p>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2">4. EXCLUSIVITY</h2>
        <p>
          Finder will act as exclusive advisor for{" "}
          <b>{displayExclusivityMonths(data.exclusivityMonths)}</b> for the above
          transactions.
        </p>
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className="font-semibold mb-2">Broker / Finder Details</h3>
        <p>
          <b>Name:</b> {brokerName}
        </p>
        <p>
          <b>Company:</b> {brokerCompany}
        </p>
        <p>
          <b>Email:</b> {displayAgreementText(data.brokerEmail)}
        </p>
        <p>
          <b>Phone:</b> {displayAgreementText(data.brokerPhone)}
        </p>
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className="font-semibold mb-2">Borrower / Client Details</h3>
        <p>
          <b>Name:</b> {displayAgreementText(data.clientName)}
        </p>
        <p>
          <b>Entity:</b>{" "}
          {displayClientEntityLabel(
            data.clientEntityName,
            data.loanApplication?.client?.entityType,
          )}
        </p>
        <p>
          <b>Email:</b> {displayAgreementText(data.clientEmail)}
        </p>
        <p>
          <b>Phone:</b> {displayAgreementText(data.clientPhone)}
        </p>
        <p>
          <b>Address:</b> {displayAgreementText(data.clientAddress)}
        </p>
      </div>

      {children}
    </div>
  );
}
