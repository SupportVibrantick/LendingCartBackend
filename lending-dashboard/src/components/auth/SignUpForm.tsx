import React, { useState } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

type SignUpForm = {
  organizationName: string;
  organizationEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  password: string;
};

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("lender_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SignUpForm>({
    organizationName: "",
    organizationEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    password: "",
  })

  const resetForm = () => {
    setForm({
      organizationName: "",
      organizationEmail: "",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      password: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(form)
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/lender/auth/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organizationName: form.organizationName,
          organizationEmail: form.organizationEmail,
          adminFirstName: form.adminFirstName,
          adminLastName: form.adminLastName,
          adminEmail: form.adminEmail,
          password: form.password,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("Failed to signup:", json.message || res.status);
        toast.error(json.message || "Failed to signup");
        return;
      }
      resetForm();
      toast.success("Signup Successfully")
    } catch (error) {
      console.log("Error saving signup form: ", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* <!-- Admin First Name --> */}
              <div className="sm:col-span-1">
                <Label>
                  Admin First Name<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  id="adminfname"
                  name="adminfname"
                  placeholder="Enter admin first name"
                  value={form.adminFirstName}
                  onChange={(e) => setForm((f) => ({ ...f, adminFirstName: e.target.value }))}
                  disabled={saving}
                />
              </div>
              {/* <!-- Admin Last Name --> */}
              <div className="sm:col-span-1">
                <Label>
                  Admin Last Name<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  id="adminlname"
                  name="adminlname"
                  placeholder="Enter admin last name"
                  value={form.adminLastName}
                  onChange={(e) => setForm((f) => ({ ...f, adminLastName: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>
            {/* <!-- Organization Name --> */}
            <div>
              <Label>
                Organization Name<span className="text-error-500">*</span>
              </Label>
              <Input
                type="text"
                id="oname"
                name="oname"
                placeholder="Enter organization name"
                value={form.organizationName}
                onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
                disabled={saving}
              />
            </div>
            {/* <!-- Organization Email --> */}
            <div>
              <Label>
                Organization Email<span className="text-error-500">*</span>
              </Label>
              <Input
                type="email"
                id="oemail"
                name="oemail"
                placeholder="Enter organization email"
                value={form.organizationEmail}
                onChange={(e) => setForm((f) => ({ ...f, organizationEmail: e.target.value }))}
                disabled={saving}
              />
            </div>
            {/* <!-- Admin Email --> */}
            <div>
              <Label>
                Admin Email<span className="text-error-500">*</span>
              </Label>
              <Input
                type="email"
                id="adminemail"
                name="adminemail"
                placeholder="Enter admin email"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                disabled={saving}
              />
            </div>
            {/* <!-- Password --> */}
            <div>
              <Label>
                Password<span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={saving}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>
            {/* <!-- Checkbox --> */}
            <div className="flex items-center gap-3">
              <Checkbox
                className="w-5 h-5"
                checked={isChecked}
                onChange={setIsChecked}
              />
              <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                By creating an account means you agree to the{" "}
                <span className="text-gray-800 dark:text-white/90">
                  Terms and Conditions,
                </span>{" "}
                and our{" "}
                <span className="text-gray-800 dark:text-white">
                  Privacy Policy
                </span>
              </p>
            </div>
            {/* <!-- Button --> */}
            <div>
              <button className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600">
                Sign Up
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Already have an account? {""}
            <Link
              to="/signin"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
