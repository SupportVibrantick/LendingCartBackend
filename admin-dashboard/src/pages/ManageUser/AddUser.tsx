import React, { useState } from "react";
import { Toaster, toast } from "react-hot-toast";

const roles = [
  { value: "admin", label: "Admin" },
  { value: "broker", label: "Broker" },
  { value: "lender", label: "Lender" },
];

const dummyUsers = [
  {
    id: 1,
    firstName: "Aabhas",
    lastName: "Jena",
    role: "admin",
    createdAt: "2025-01-12T10:35:00Z",
  },
  {
    id: 2,
    firstName: "Hello",
    lastName: "Kaur",
    role: "broker",
    createdAt: "2025-02-01T12:20:00Z",
  },
  {
    id: 3,
    firstName: "Rohit",
    lastName: "Sharma",
    role: "lender",
    createdAt: "2025-02-10T09:10:00Z",
  },
];

const API_BASE = import.meta.env.VITE_API_BASE || "";
const API = {
  ADD_USER: `${API_BASE}/foliomax/users/add`,
};

const AddUser: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!email.includes("@")) return "Please enter a valid email.";
    if (!phone.trim()) return "Phone number is required.";
    if (!role) return "Please select a role.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForm();
    if (error) return toast.error(error);

    try {
      setSubmitting(true);

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
      };

      const res = await fetch(API.ADD_USER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to add user.");
      }

      toast.success("User added successfully!");

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setRole("");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <Toaster
        position="top-center"
        toastOptions={{ duration: 2000 }}
        containerStyle={{ top: 80, left: "50%", transform: "translateX(-50%)" }}
      />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add User</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new user and assign a role.
        </p>
      </div>

      {/* GRID LAYOUT START (Form Left + Table Right) */}
      <div className="grid grid-cols-12 gap-6">

        {/* LEFT FORM (unchanged) */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Enter first name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter email"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a role</option>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 px-5 py-2 rounded-lg text-white text-sm shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT TABLE */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-full flex flex-col">

            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Users List
            </h2>

            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="py-2 pr-4 text-left">Full Name</th>
                    <th className="py-2 pr-4 text-left">Role</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                  </tr>
                </thead>

                <tbody>
                  {dummyUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4 text-gray-900 font-medium">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3 pr-4 capitalize">{u.role}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
      {/* GRID END */}
    </div>
  );
};

export default AddUser;
