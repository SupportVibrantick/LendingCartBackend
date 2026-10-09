import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, ShieldPlus, UserPlus } from "lucide-react";
import AdminUserForm from "./AdminUserForm";
import { createAdmin, type AdminUserForm as FormState } from "./adminUserShared";

const CreateSuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (form: FormState) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const result = await createAdmin({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        accessLevel: form.accessLevel,
        permissions: form.permissions,
      });
      toast.success(
        result?.message ||
          "Admin created successfully. Login credentials have been emailed.",
      );
      navigate("/all-super-admins");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 text-gray-900 dark:text-gray-100">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f3d66] via-[#13538A] to-[#1a6aad] p-5 text-white shadow-lg sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.22), transparent 42%), radial-gradient(circle at 82% 0%, rgba(24,182,180,0.35), transparent 40%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-white/70">
              <Link to="/" className="hover:text-white">
                Dashboard
              </Link>
              <span>/</span>
              <Link to="/all-super-admins" className="hover:text-white">
                Super Admin Users
              </Link>
              <span>/</span>
              <span className="text-white">Add Admin</span>
            </nav>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Add Admin User
                </h1>
                <p className="mt-1 max-w-xl text-sm text-white/80">
                  Create a platform administrator and choose full access or
                  module-level permissions that match the admin sidebar.
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/all-super-admins"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Users
          </Link>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Profile",
              desc: "Name, email & password",
              icon: UserPlus,
            },
            {
              step: "2",
              title: "Access level",
              desc: "Full or custom access",
              icon: ShieldPlus,
            },
            {
              step: "3",
              title: "Credentials",
              desc: "Login emailed on create",
              icon: Mail,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-xs font-bold">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon className="h-3.5 w-3.5 opacity-80" />
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-white/70">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AdminUserForm
        mode="create"
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/all-super-admins")}
      />
    </div>
  );
};

export default CreateSuperAdmin;
