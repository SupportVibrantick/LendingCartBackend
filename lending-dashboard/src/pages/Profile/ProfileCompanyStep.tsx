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
  "w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-[#183b57] focus:border-[#183b57] outline-none transition dark:border-slate-700 dark:bg-slate-800";

export default function ProfileCompanyStep({
  form,
  setForm,
  errors = {},
}: ProfileCompanyStepProps) {
  const handle = (key: keyof CompanyForm, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white">
          Company Information
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Basic company and contact details visible to brokers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Company Name <span className="text-red-500">*</span>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Lender Type
          </label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            First Name <span className="text-red-500">*</span>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Last Name <span className="text-red-500">*</span>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Contact Email <span className="text-red-500">*</span>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Phone
          </label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Website
          </label>
          <input
            placeholder="https://company.com"
            value={form.website}
            onChange={(event) => handle("website", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            NMLS Number
          </label>
          <input
            placeholder="NMLS #"
            value={form.nmls}
            onChange={(event) => handle("nmls", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Address
          </label>
          <input
            placeholder="Street address"
            value={form.address}
            onChange={(event) => handle("address", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            City
          </label>
          <input
            value={form.city}
            onChange={(event) => handle("city", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            State
          </label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            ZIP
          </label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Typical Funding Speed (days)
          </label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Notes / Business Summary{" "}
            <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </label>
          <textarea
            rows={4}
            placeholder="Describe your lending company, focus, and value proposition..."
            value={form.summary}
            onChange={(event) => handle("summary", event.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
}

export type { CompanyForm };
