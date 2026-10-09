import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import AdminUserForm from "./AdminUserForm";
import {
  fetchAdminById,
  isFullAccess,
  updateAdmin,
  type AdminUser,
  type AdminUserForm as FormState,
} from "./adminUserShared";

const EditSuperAdmin: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusPermissions = searchParams.get("tab") === "permissions";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAdminById(id);
        if (!cancelled) setAdmin(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load admin");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const initial = useMemo(() => {
    if (!admin) return undefined;
    const full = isFullAccess(admin);
    return {
      firstName: admin.firstName || "",
      lastName: admin.lastName || "",
      email: admin.email || "",
      password: "",
      accessLevel: full ? ("FULL" as const) : ("CUSTOM" as const),
      permissions: full ? [] : admin.permissions || [],
    };
  }, [admin]);

  useEffect(() => {
    if (!focusPermissions || loading) return;
    const timer = setTimeout(() => {
      document
        .getElementById("admin-permissions-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timer);
  }, [focusPermissions, loading]);

  const handleSubmit = async (form: FormState) => {
    if (!id || submitting) return;
    try {
      setSubmitting(true);
      await updateAdmin(id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        accessLevel: form.accessLevel,
        permissions: form.permissions,
      });
      toast.success("Admin updated successfully");
      navigate("/all-super-admins");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin");
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
              <span className="text-white">Edit Admin</span>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight">
              Edit Admin User
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Update profile details, access level and module permissions.
            </p>
          </div>
          <Link
            to="/all-super-admins"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/25 bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Users
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
        </div>
      ) : error || !admin || !initial ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-700 dark:text-red-300">
            {error || "Admin user not found"}
          </p>
          <Link
            to="/all-super-admins"
            className="mt-3 inline-flex text-sm font-semibold text-[#13538A]"
          >
            Return to list
          </Link>
        </div>
      ) : (
        <div id="admin-permissions-section">
          <AdminUserForm
            mode="edit"
            initial={initial}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/all-super-admins")}
          />
        </div>
      )}
    </div>
  );
};

export default EditSuperAdmin;
