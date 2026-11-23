import type { Dispatch, SetStateAction } from "react";
import {
  formatUSPhone,
  formatUSZip,
  US_STATE_OPTIONS,
} from "../../lib/usAddressFormat";

type CompanyForm = {
  companyName: string;
  lenderType: string;
  firstName: string;
  lastName: string;
  organizationEmail: string;
  organizationPhone: string;
  website: string;
  nmls: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  summary: string;
  fundingSpeedDays: string;
};

type ProfileCompanyStepProps = {
  form: CompanyForm;
  setForm: Dispatch<SetStateAction<CompanyForm>>;
  errors?: Record<string, string>;
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const labelClass =
  "text-[13px] font-medium text-text-primary dark:text-slate-200";

export default function ProfileCompanyStep({
  form,
  setForm,
  errors = {},
}: ProfileCompanyStepProps) {
  const handle = (key: keyof CompanyForm, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
          Company Information
        </h2>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Basic company and contact details visible to brokers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>
            Company Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.companyName}
            onChange={(event) => handle("companyName", event.target.value)}
            placeholder="Enter company name"
            className={fieldClass}
          />
          {errors.companyName && (
            <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Lender Type</label>
          <select
            value={form.lenderType}
            onChange={(event) => handle("lenderType", event.target.value)}
            className={fieldClass}
          >
            <option value="">Select lender type</option>
            <option value="bank">Bank</option>
            <option value="hard_money">Hard Money</option>
            <option value="private">Private Lender</option>
            <option value="credit_union">Credit Union</option>
            <option value="nbfc">NBFC</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            First Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.firstName}
            onChange={(event) => handle("firstName", event.target.value)}
            className={fieldClass}
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>
            Last Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.lastName}
            onChange={(event) => handle("lastName", event.target.value)}
            className={fieldClass}
          />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>
            Contact Email <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            value={form.organizationEmail}
            onChange={(event) =>
              handle("organizationEmail", event.target.value)
            }
            className={fieldClass}
          />
          {errors.organizationEmail && (
            <p className="mt-1 text-xs text-red-500">
              {errors.organizationEmail}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="999-999-9999"
            maxLength={12}
            value={form.organizationPhone}
            onChange={(event) =>
              handle("organizationPhone", formatUSPhone(event.target.value))
            }
            className={fieldClass}
          />
          {errors.organizationPhone && (
            <p className="mt-1 text-xs text-red-500">
              {errors.organizationPhone}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Website</label>
          <input
            placeholder="https://company.com"
            value={form.website}
            onChange={(event) => handle("website", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>NMLS Number</label>
          <input
            placeholder="NMLS #"
            value={form.nmls}
            onChange={(event) => handle("nmls", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input
            placeholder="Street address"
            value={form.address}
            onChange={(event) => handle("address", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>City</label>
          <input
            value={form.city}
            onChange={(event) => handle("city", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>State</label>
          <select
            value={form.state}
            onChange={(event) => handle("state", event.target.value)}
            className={fieldClass}
          >
            <option value="">Select state</option>
            {US_STATE_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {errors.state && (
            <p className="mt-1 text-xs text-red-500">{errors.state}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>ZIP</label>
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="12345 or 12345-6789"
            maxLength={10}
            value={form.zip}
            onChange={(event) => handle("zip", formatUSZip(event.target.value))}
            className={fieldClass}
          />
          {errors.zip && (
            <p className="mt-1 text-xs text-red-500">{errors.zip}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Typical Funding Speed (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.fundingSpeedDays}
            onChange={(event) =>
              handle("fundingSpeedDays", event.target.value)
            }
            className={fieldClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>
            Notes / Business Summary{" "}
            <span className="text-xs font-normal text-text-secondary">
              (Optional)
            </span>
          </label>
          <textarea
            rows={4}
            placeholder="Describe your lending company, focus, and value proposition..."
            value={form.summary}
            onChange={(event) => handle("summary", event.target.value)}
            className={`${fieldClass} h-auto min-h-[96px] py-2.5`}
          />
        </div>
      </div>
    </div>
  );
}

export type { CompanyForm };
