import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

const BENEFITS = [
  "Receive qualified broker submissions in one pipeline",
  "Set products, rates, and lending criteria",
  "Collaborate with brokers in real time",
  "Track decisions and funded deals end to end",
];

export default function PartnerLanding() {
  return (
    <>
      <PageMeta
        title="Become a Lending Partner | LendingCart"
        description="Join LendingCart as a lending partner and start reviewing broker submissions."
      />
      <AuthLayout>
        <div className="w-full">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Lending partners
            </p>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white sm:text-3xl">
              Become a Lending Partner
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Create your lender account in minutes. After signup you can complete
              onboarding and start reviewing loan applications from brokers.
            </p>
          </div>

          <ul className="mb-8 space-y-3">
            {BENEFITS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                  {"\u2713"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/partner/signup"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#264863] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 transition hover:bg-[#183b57] active:scale-[0.99]"
          >
            Become a Lending Partner
          </Link>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="font-semibold text-brand-800 hover:underline dark:text-brand-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
