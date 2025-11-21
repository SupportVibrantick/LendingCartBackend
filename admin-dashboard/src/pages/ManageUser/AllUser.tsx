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

  // NEW — Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<User | null>(null);

  const handleEdit = (user: User) => {
    setEditUserData({ ...user });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.firstName} ${user.lastName}"?`)) {
      return;
    }

    try {
      setRowLoadingId(user.id);
      await new Promise((resolve) => setTimeout(resolve, 600)); // fake delay
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } finally {
      setRowLoadingId(null);
    }
  };

  const handleSaveChanges = () => {
    if (!editUserData) return;

    setUsers((prev) =>
      prev.map((u) => (u.id === editUserData.id ? editUserData : u))
    );

    setIsEditModalOpen(false);
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40"
                          >
                            <MdModeEdit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                          >
                            {isLoading ? (
                              <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  className="opacity-25"
                                  fill="none"
                                ></circle>
                                <path
                                  fill="currentColor"
                                  className="opacity-75"
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

      {/* ------------------------  
           ✨ EDIT USER MODAL  
      ------------------------ */}
      {isEditModalOpen && editUserData && (
        <div className="fixed inset-0 z-5000000 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg animate-slideUp">
            <h2 className="text-lg font-semibold mb-4">Edit User</h2>

            {/* First Name */}
            <label className="block mb-3">
              <span className="text-sm text-gray-700">First Name</span>
              <input
                type="text"
                value={editUserData.firstName}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, firstName: e.target.value })
                }
                className="w-full px-3 py-2 mt-1 border rounded-md"
              />
            </label>

            {/* Last Name */}
            <label className="block mb-3">
              <span className="text-sm text-gray-700">Last Name</span>
              <input
                type="text"
                value={editUserData.lastName}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, lastName: e.target.value })
                }
                className="w-full px-3 py-2 mt-1 border rounded-md"
              />
            </label>

            {/* Role */}
            <label className="block mb-3">
              <span className="text-sm text-gray-700">Role</span>
              <select
                value={editUserData.role}
                onChange={(e) =>
                  setEditUserData({
                    ...editUserData,
                    role: e.target.value as User["role"],
                  })
                }
                className="w-full px-3 py-2 mt-1 border rounded-md"
              >
                <option value="admin">Admin</option>
                <option value="broker">Broker</option>
                <option value="lender">Lender</option>
              </select>
            </label>

            {/* Phone */}
            <label className="block mb-4">
              <span className="text-sm text-gray-700">Phone Number</span>
              <input
                type="text"
                value={editUserData.phone}
                onChange={(e) =>
                  setEditUserData({ ...editUserData, phone: e.target.value })
                }
                className="w-full px-3 py-2 mt-1 border rounded-md"
              />
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllUser;
