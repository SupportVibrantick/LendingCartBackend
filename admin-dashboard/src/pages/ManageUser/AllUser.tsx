// src/pages/ManageUser/AllUser.tsx
import React, { useState } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  role: "admin" | "broker" | "lender";
  phone: string;
};

const dummyUsers: User[] = [
  {
    id: 1,
    firstName: "Rohit",
    lastName: "Sharma",
    role: "admin",
    phone: "+91 98765 43210",
  },
  {
    id: 2,
    firstName: "Aabhas",
    lastName: "Jena",
    role: "broker",
    phone: "+91 91234 56789",
  },
  {
    id: 3,
    firstName: "Simran",
    lastName: "Kaur",
    role: "lender",
    phone: "+91 99887 77665",
  },
];

const roleLabel: Record<User["role"], string> = {
  admin: "Admin",
  broker: "Broker",
  lender: "Lender",
};

const AllUser: React.FC = () => {
  const [users, setUsers] = useState<User[]>(dummyUsers);
  const [rowLoadingId, setRowLoadingId] = useState<number | null>(null);

  const handleEdit = (user: User) => {
    // Later: open modal or navigate to edit page
    console.log("Edit user", user.id);
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.firstName} ${user.lastName}"?`)) {
      return;
    }

    try {
      setRowLoadingId(user.id);
      // TODO: call API DELETE /foliomax/users/delete/:id when backend is ready
      await new Promise((resolve) => setTimeout(resolve, 600)); // fake delay
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } finally {
      setRowLoadingId(null);
    }
  };

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all users, their roles, and contact details.
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {users.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-2 pr-4 text-left">Full Name</th>
                  <th className="py-2 pr-4 text-left">Role</th>
                  <th className="py-2 pr-4 text-left">Phone Number</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isLoading = rowLoadingId === user.id;
                  const fullName = `${user.firstName} ${user.lastName}`;
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40"
                    >
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                        {fullName}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                        {roleLabel[user.role]}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                        {user.phone}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            disabled={isLoading}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Edit user"
                          >
                            <MdModeEdit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete user"
                          >
                            {isLoading ? (
                              <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : (
                              <MdDelete className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllUser;
