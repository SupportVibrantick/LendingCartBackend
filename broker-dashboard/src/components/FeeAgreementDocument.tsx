import type { ReactNode, RefObject } from "react";
import {
  displayAgreementText,
  displayBrokerBrandName,
  displayBrokerName,
  displayFeeAmount,
  displayFeePercent,
  formatIssuerPartyNameForAgreement,
  hasFeeTerms,
  resolveAgreementDate,
  resolveIssuerPropertyAddress,
} from "../lib/feeAgreementDisplayUtils";

type Props = {
  data: any;
  pdfRef?: RefObject<HTMLDivElement | null>;
  currencySymbol?: string;
  children?: ReactNode;
};

function SectionParagraph({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="mb-2.5 leading-relaxed">
      {children}
    </p>
  );
}

export default function FeeAgreementDocument({
  data,
  pdfRef,
  currencySymbol = "$",
  children,
}: Props) {
  const brokerBrand = displayBrokerBrandName(
    data.brokerBrandName,
    data.brokerCompany,
  );
  const brokerName = displayBrokerName(data.brokerName, data.brokerCompany);
  const feeTermsPending = !hasFeeTerms(data);
  const logoSrc = data.brokerLogoUrl || "/loanAutomation.jpeg";
  const logoAlt = brokerBrand;
  const agreementDate = resolveAgreementDate(data);
  const issuerPropertyAddress = resolveIssuerPropertyAddress(
    data.clientAddress,
    data.subjectAddress,
  );
  const issuerParty = formatIssuerPartyNameForAgreement(
    data.clientName,
    data.clientEntityName,
  );
  const brokerPointsDisplay = feeTermsPending
    ? "__________"
    : displayFeePercent(data.brokerPoints).replace("%", "");
  const exclusivityDisplay = feeTermsPending
    ? "_____"
    : String(data.exclusivityMonths ?? "_____");
  const signedDateDisplay = data.signedAt
    ? new Date(data.signedAt).toLocaleString()
    : "______________";

  return (
    <div className="p-6 text-sm text-gray-700 leading-relaxed dark:text-slate-300">
      <div ref={pdfRef} className="space-y-4">
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

        <h1 className="text-xl font-bold">FINDER &amp; FINANCIAL AGREEMENT</h1>

        {data.brokerBrandName && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {brokerBrand}
          </p>
        )}

        <p className="text-xs text-gray-500">Date: {agreementDate}</p>
      </div>

      {feeTermsPending && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Fee terms are pending. Your broker will update broker fee, upfront
          fee, and exclusivity period before signing.
        </p>
      )}

      <SectionParagraph>
        This Finder &amp; Financial Agreement is made and entered into this
        Date: <b>{agreementDate}</b> by and between <b>{issuerParty}</b> and
        any other entities or individuals having a 20% or greater interest in
        the borrower whose Property address is:{" "}
        <b>{issuerPropertyAddress}</b> ("Issuer"), and <b>{brokerBrand}</b> whose
        address is:{" "}
        <b>{displayAgreementText(data.brokerAddress, "____________________________")}</b>{" "}
        (the "Finder"), hereinafter collectively referred to as the "Parties."
      </SectionParagraph>

      <SectionParagraph>
        <b>Subject Property/Business:</b>{" "}
        {displayAgreementText(
          data.subjectAddress,
          "___________________________________________________",
        )}
      </SectionParagraph>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          1. THE AGREEMENT
        </h2>

        <SectionParagraph>
          <b>1.1</b> Issuer is to be part of any loan, equity investment, lease,
          asset based line of credit, credit facility, debt restructure or payoff,
          joint venture, merger or acquisition, strategic alliance, or
          real estate/asset sale, (the "Transaction"). The Transaction shall be
          on terms and conditions satisfactory to Issuer. As a result of the
          introduction made through Finder to an Investor (either a single
          investor, several investors, institutions, banks, advisory firms,
          venture capitalist or fund managers referred to herein as "Investor")
          or any related entity under Investors control, should all or any part
          of the Transaction be placed with investors, issuer shall owe Finder
          the fees described herein. Should Issuer close on any introduced
          transactions under this Agreement, that in itself shall serve as
          proof that the Transaction met the terms and conditions that were
          satisfactory to Issuer.
        </SectionParagraph>

        <SectionParagraph>
          <b>1.2</b> It is acknowledged by Issuer that: Finder has acted solely
          as a finder and not in any other capacity. Finder has not advised
          Issuer in any manner regarding the merits of this or any other
          financing arrangement; Issuer has consulted its own counsel on all
          aspects of this Transaction and has done its own due diligence to its
          satisfactions; Finder has not made any representations to Issuer to
          induce it into this Agreement.
        </SectionParagraph>

        <SectionParagraph>
          <b>1.3</b> Issuer shall be under no obligation to pay Finder where the
          introduced source has offered to purchase all or part of the
          Transaction unless accepted by Issuer. For purposes of this Agreement,
          the total amount due Finder shall be due and payable on the date of
          the closing. Issuer shall be under no obligation to consummate any such
          Transaction, except upon such terms as shall be acceptable to Issuer in
          its sole discretion.
        </SectionParagraph>

        <SectionParagraph>
          <b>1.4</b> The undersigned parties hereby irrevocably agree not to
          circumvent, avoid, bypass or obviate each other, directly or
          indirectly, to avoid payment of fees or commissions in any transaction
          with any institution, fund, corporation, partnership or individuals,
          revealed by either party, to the other (excluding those previously
          known to the other party defined with aged documentation), in
          conjunction with any Transaction (including the purchase and sale of any
          real estate or asset) or currency exchange, or any loans, or
          collateral, or funding(s), or addition, renewal, extension, rollover,
          renewal, amendment, renegotiation, new contracts, parallel contract,
          agreements, or third party assignments thereof. The Issuer agrees and
          covenants that he or she will not directly, or indirectly, or in
          conjunction with any other person, company, partnership or corporation,
          apply to the investors to whom Finder has submitted a loan application,
          except through Finder, for a period of 36 months, otherwise the Issuer
          shall be liable to Finder for the Fee described in [2.1] of this
          agreement whether or not Issuer receives capital from any introduced
          investors from Finder.
        </SectionParagraph>

        <SectionParagraph>
          <b>1.5</b> This Agreement between Issuer and Finder will expire Twelve
          Months (12) months from the date first above at which time neither
          party will have any obligations towards the other party unless
          introduced Investors are negotiating with Issuer at expiration time or
          after, then this Agreement will survive until such time as the active
          dealings either terminated or a Transaction is closed. The agreement
          does not expire or terminated after 12 months, if the sponsors use the
          lending source introduced by <b>{brokerBrand}</b>.
        </SectionParagraph>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          2. THE FEE
        </h2>

        <SectionParagraph>
          The fee from Issuer for retaining Finder to introduce various
          financial and investment sources will be a fee of{" "}
          <b>
            {feeTermsPending
              ? "$_____________"
              : displayFeeAmount(data.upfrontFee, currencySymbol)}
          </b>{" "}
          due upon the signing of this Agreement. This fee will be refunded
          except for administrative cost if Finder or sources do not approve a
          transaction with Issuer. However, if Finder or sources approve a
          transaction and Issuer receives a written Letter of Intent from Finder
          or sources and Issuer fails to honour or complete said Letter of Intent
          for any reason…all earnest money stated above will be considered earned
          income for Finder. Furthermore, if Issuer provides documents to Finder
          in consideration for a loan that contains false information or
          misrepresentation of the truth or facts, then the fee indicated above of
          this agreement is deemed non-refundable and earned by Finder. The fee
          indicated above in this agreement can not be applied to or be used
          towards any equity injection, down payment or financial projections
          required by investor.
        </SectionParagraph>

        <SectionParagraph>
          The fee for successful introductions by Finder to Issuer in the event
          of a Financial introduction either for loan, equity, lease, asset based
          line of credit, credit facility, debt restructure or payoff, joint
          venture, merger or acquisition, strategic alliance, or real
          estate/asset sale is outlined in item [2.1] below, and is to be paid by
          Issuer pursuant to this Agreement in the sum distributed and computed
          as follows:
        </SectionParagraph>

        <SectionParagraph>
          The cash fee due from Issuer shall be payable to Finder through closing
          escrow or by Issuer at the discretion of Finder for the successful
          introduction for any loan, equity, lease, asset based line of credit,
          credit facility, debt restructure or payoff, joint venture, merger or
          acquisition, strategic alliance, or real estate/asset sale. The term
          "successful introduction" is defined as any lender or investor that
          Finder introduced to Issuer, where Issuer receives capital in the form
          of a loan, lease, equity, debt restructure or payoff, merger or
          acquisition, strategic alliance, or real estate/asset sale. The
          escrow agent or Issuer shall release the fee to Finder via wire
          transfer at the same time as the balance of investor funds is released
          to Issuer.
        </SectionParagraph>

        <SectionParagraph>
          <b>2.1 – Broker Fee:</b> One Percent - <b>{brokerPointsDisplay}%</b>{" "}
          fee of the total amount invested by Investor. The fee distribution is
          defined in the formula of cash. The same Broker fee also applies for
          renewal, extension, refinance with the lending source introduced by{" "}
          <b>{brokerBrand}</b>.
        </SectionParagraph>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          3. OTHER
        </h2>

        <SectionParagraph>
          <b>3.1</b> Any arrangements made by Issuer with any broker or other
          people with whom Issuer is or may be involved are the total
          responsibility of Issuer. Upon payment made by Issuer to Finder of
          Finder's fee, Finder will hold Issuer free and harmless from any and
          all claims, liabilities, commissions, fees or expenses in connection
          with the transaction from any party who alleges a relationship with or
          through Finder and the Investors.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.2</b> This Agreement contains the entire agreement between Finder
          and Issuer concerning the introduction of Investors to Issuer and
          correctly set forth the rights and duties of each of the parties to
          each other on this matter, and if any other agreement concerning the
          subject matter herein is entered into subsequent to the date of this
          Agreement; it is likewise null and void unless otherwise agreed to by
          the Issuer and the Finder. Any agreement or representation concerning
          the subject matter of this Agreement or the duties of Finder to Issuer
          in relation thereto, not set forth in this Agreement, is null and
          void.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.3</b> This Agreement shall be governed by the laws of the State
          of <b>{displayAgreementText(data.brokerState, "____________")}</b>.
          Any dispute, action or claim under this Agreement shall be resolved, to
          the exclusion of all other forums, in Supreme Court, State of{" "}
          <b>{displayAgreementText(data.brokerState, "____________")}</b>.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.4</b> Issuer's disclosure and obligation to make true statement
          of facts to Finder and Investor(s) are set forth in Investor(s)
          application. Issuer shall provide Finder and Investor(s) all material
          facts relative to this application. Issuer agrees to save and hold
          Finder harmless from all claims, disputes, litigations and/or judgment
          arising from incorrect information supplied by Issuer or from any
          material fact known by Issuer which Issuer fails to disclose.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.5</b> Issuer understands that a Investor(s) may require a cash
          deposit prior to issuance and acceptance of a loan commitment. Any such
          deposits will be collected and retained by the Investor(s), subject
          to the Investor(s) policies and procedures.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.6</b> Issuer warrants that he or she has the authority to execute
          this Agreement. The Issuer and Finder further intend that this
          Agreement constitutes the complete and exclusive statement of its
          terms, and that no extrinsic evidence whatsoever may be introduced in
          any judicial or arbitration proceeding, if any, involving this
          Agreement.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.7</b> If required Issuer agrees to provide and pay travel
          expenses for Finder and Investor to include: Round Trip Airfare, Hotel
          Expenses, and any related transportation from and too the site visit
          destination. Travel time and dates will be subject to and agreed upon
          with an exhibit "A" attached to and made part of this agreement.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.8</b> Finder is not registered with the SEC as a broker/dealer or
          investment advisor and as a consequence, Finder will not provide any
          investment services that require registration as a broker/dealer or
          investment advisor. Finder shall act as an introducing party only.
          Finder will not advise any person or entity on the merits of lending
          money to purchasing an equity interest or purchasing assets from the
          Issuer. Finder will not advise the Issuer with regard to terms and
          conditions of a transaction with any person of entity introduced by
          Finder to the Issuer.
        </SectionParagraph>

        <SectionParagraph>
          <b>3.9</b> A facsimile of this document shall be deemed and considered
          as an original, binding and enforceable document.
        </SectionParagraph>
      </div>

      <div>
        <h2 className="font-semibold text-base mb-2 text-slate-800 dark:text-slate-200">
          4. EXCLUSIVITY
        </h2>

        <SectionParagraph>
          During the Advisory Period and any agreed extension period,{" "}
          <b>{brokerBrand}</b> will act as the exclusive advisor to the borrowers
          and any other entities or individuals having a 10% or greater interest
          in the borrower, for the Transactions mentioned above as subject
          property. From time to time <b>{brokerBrand}</b> will render such
          advisory services as required, including the services outlined in the
          Scope of Work set out in above. <b>{brokerBrand}</b> shall dedicate
          such time and resources as are customary and necessary to fulfill its
          obligations in terms of this Engagement Letter. The borrowers, and any
          other entities or individuals having a 10% or greater interest in the
          borrower, acknowledge and agree that <b>{brokerBrand}</b> exclusivity
          to act as advisor is restricted to the above Transactions and the
          counter-parties directly or indirectly introduced by{" "}
          <b>{brokerBrand}</b> to the Group. This exclusivity clause will
          supersede any other past or future engagement by the borrowers, and
          any other entities or individuals having a 10% or greater interest in
          the borrower, of the subject property, and that any further requests
          from the borrowers, and any other entities or individuals having a 10%
          or greater interest in the borrower, for <b>{brokerBrand}</b> to act as
          the exclusive financial advisor on any other transactions between the
          borrowers, and any other entities or individuals having a 10% or
          greater interest in the borrower, and <b>{brokerBrand}</b> will be
          governed by the terms of a separate engagement letter specific to that
          transaction. The Advisory Period shall be <b>{exclusivityDisplay}</b>{" "}
          month(s) unless otherwise agreed in writing.
        </SectionParagraph>
      </div>

      <p className="italic text-slate-600 dark:text-slate-400">
        IN WITNESS WHEREOF, the within Agreement has been executed by a duly
        authorized officer and representative of each party who has signed it
        after all due corporate authority has been granted to each signatory on
        the date indicated below and shall be binding upon and inure to the
        benefit of each party's respective successor and assign.
      </p>

      <div className="rounded-xl border border-slate-200 p-4 space-y-1.5 dark:border-slate-700">
        <p>
          <b>{brokerBrand}</b> ("Finder")
        </p>
        <p>
          Broker/Finder's Name: <b>{brokerName}</b>
        </p>
        <p>Title: Commercial Loan Advisor</p>
        <p>
          Email: <b>{displayAgreementText(data.brokerEmail, "______________________")}</b>
        </p>
        <p>
          Tel #: <b>{displayAgreementText(data.brokerPhone, "________________________")}</b>
        </p>
        <p>
          Broker Address:{" "}
          <b>{displayAgreementText(data.brokerAddress, "______________________________")}</b>
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 space-y-1.5 dark:border-slate-700">
        <p>
          Borrower's Name:{" "}
          <b>{displayAgreementText(data.clientName, "_________________________")}</b>
        </p>
        {data.clientSignature ? (
          <div className="py-2">
            <img
              src={data.clientSignature}
              alt="Borrower Signature"
              className="max-h-20 max-w-[220px]"
            />
          </div>
        ) : (
          <p>Borrower's Signature: _______________________</p>
        )}
        <p>
          Date: <b>{signedDateDisplay}</b>
        </p>
        <p>Title: ___________________________</p>
        <p>
          Borrower's Email:{" "}
          <b>{displayAgreementText(data.clientEmail, "_____________________")}</b>
        </p>
        <p>
          Borrower's Cell:{" "}
          <b>{displayAgreementText(data.clientPhone, "________________________")}</b>
        </p>
        <p>
          Borrower's Address:{" "}
          <b>{issuerPropertyAddress}</b>
        </p>
        <p>
          (Entity's Name "Issuer"):{" "}
          <b>{displayAgreementText(data.clientEntityName, "_________________________")}</b>
        </p>
        <p>
          Subject Property Address:{" "}
          <b>
            {displayAgreementText(
              data.subjectAddress,
              "__________________________",
            )}
          </b>
        </p>
      </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
