import { useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

type RegisterPayload = {
  organizationName: string;
  organizationEmail: string;
  organizationPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export default function SignUpForm() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<RegisterPayload>({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  /* ---------------- VALIDATION ---------------- */
  const validateForm = () => {
    if (!form.organizationName.trim()) {
      toast.error("Organization name is required");
      return false;
    }

    if (!form.organizationEmail.includes("@")) {
      toast.error("Valid organization email is required");
      return false;
    }

    if (form.organizationPhone.length < 10) {
      toast.error("Valid organization phone is required");
      return false;
    }

    if (!form.firstName.trim()) {
      toast.error("First name is required");
      return false;
    }

    if (!form.lastName.trim()) {
      toast.error("Last name is required");
      return false;
    }

    if (!form.email.includes("@")) {
      toast.error("Valid email is required");
      return false;
    }

    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }

    if (!/[A-Z]/.test(form.password)) {
      toast.error("Password must contain at least 1 capital letter");
      return false;
    }

    if (!/[0-9]/.test(form.password)) {
      toast.error("Password must contain at least 1 number");
      return false;
    }

    if (!isChecked) {
      toast.error("Please accept Terms & Conditions");
      return false;
    }

    return true;
  };

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("broker_token");
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

  const resetForm = () => {
    setForm({
      organizationName: "",
      organizationEmail: "",
      organizationPhone: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    });
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    const toastId = toast.loading("Creating account...");
    try {
      const res = await fetch(`${API_BASE}/broker/auth/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        console.error("Failed to signup:", json.message || res.status);
        toast.error(json.message || "Failed to signup");
        return;
      }

      resetForm();
      toast.success("Account created successfully!", { id: toastId });
      navigate("/signin");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full lg:w-1/2 justify-center">
      <div className="w-full max-w-md mx-auto">

        <Link to="/" className="inline-flex items-center text-sm text-gray-500 mb-4">
          <ChevronLeftIcon className="size-5" />
          Back
        </Link>

        <h1 className="mb-4 font-semibold text-gray-800 text-title-sm dark:text-white">
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-3">

          <div className="grid grid-cols-2 gap-3">
            <Input name="organizationName" placeholder="Organization Name" value={form.organizationName} onChange={handleChange} />
            <Input name="organizationPhone" placeholder="Org Phone" value={form.organizationPhone} onChange={handleChange} />
          </div>

          <Input name="organizationEmail" placeholder="Organization Email" value={form.organizationEmail} onChange={handleChange} />

          <div className="grid grid-cols-2 gap-3">
            <Input name="firstName" placeholder="First Name" value={form.firstName} onChange={handleChange} />
            <Input name="lastName" placeholder="Last Name" value={form.lastName} onChange={handleChange} />
          </div>

          <Input name="email" placeholder="Your Email" value={form.email} onChange={handleChange} />

          <div className="relative">
            <Input
              name="password"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
            />

            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute cursor-pointer right-4 top-1/2 -translate-y-1/2"
            >
              {showPassword ? (
                <EyeIcon className="fill-gray-500 size-5" />
              ) : (
                <EyeCloseIcon className="fill-gray-500 size-5" />
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={isChecked} onChange={setIsChecked} />
            <p className="text-xs text-gray-500">I agree to Terms & Privacy Policy</p>
          </div>

          <button
            disabled={loading}
            className="w-full py-2.5 text-white rounded bg-brand-500 hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

        </form>
      </div>
    </div>
  );
}
