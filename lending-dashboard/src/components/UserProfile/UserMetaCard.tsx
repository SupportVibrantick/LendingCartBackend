import { useEffect, useState } from "react";
import { Pencil, X, Camera } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  organizationName: string;
  roles: string[];
  profileImage?: string;
};

type EditableField = "firstName" | "lastName" | null;

export default function UserProfileCard() {
  const [user, setUser] = useState<SessionUser | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<EditableField>(null);
  const [saving, setSaving] = useState(false);

  // ================= LOAD USER =================
  useEffect(() => {
    const raw = sessionStorage.getItem("lender_user");
    if (!raw) return;

    const parsed: SessionUser = JSON.parse(raw);
    setUser(parsed);

    const parts = parsed.name.split(" ");
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
  }, []);

  if (!user) return null;

  const roleLabel =
    user.roles?.[0]?.split("_").join(" ") || "User";

  const displayName = `${firstName} ${lastName}`.trim();

  function capitalizeName(name: string) {
    return name
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }

  // ================= IMAGE =================
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setProfileImage(e.target.files[0]);
    }
  }

  // ================= EDIT CONTROL =================
  function startEdit(field: EditableField) {
    if (field === "firstName") setOriginalFirstName(firstName);
    if (field === "lastName") setOriginalLastName(lastName);
    setEditing(field);
  }

  function cancelEdit() {
    if (editing === "firstName") setFirstName(originalFirstName);
    if (editing === "lastName") setLastName(originalLastName);
    setEditing(null);
  }

  // ================= SAVE =================
  async function handleSave() {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    if (profileImage) formData.append("profileImage", profileImage);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/lender/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("lender_token")}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Profile update failed");
      }

      if (!user) return;

      const updatedUser: SessionUser = {
        id: user.id,
        email: user.email,
        organizationName: user.organizationName,
        roles: user.roles,
        name: displayName,
        profileImage: json.data?.profileImage || user.profileImage,
      };

      sessionStorage.setItem("lender_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setEditing(null);
      setProfileImage(null);

      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // ================= UI =================
  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8">

      {/* ================= PROFILE IMAGE ================= */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-full overflow-hidden border dark:border-gray-700">
            <img
              src={
                profileImage
                  ? URL.createObjectURL(profileImage)
                  : user.profileImage || "/images/user/owner.jpg"
              }
              alt="profile"
              className="h-full w-full object-cover"
            />
          </div>

          <label className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full cursor-pointer shadow hover:bg-blue-700">
            <Camera size={16} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
        </div>

        <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">
          {capitalizeName(displayName)}
        </h3>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {roleLabel} · {user.organizationName}
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {user.email}
        </p>
      </div>

      {/* ================= DETAILS ================= */}
      <div className="mt-8 space-y-5">

        {/* First Name */}
        <ProfileRow
          label="First Name"
          value={firstName}
          editing={editing === "firstName"}
          onEdit={() =>
            editing === "firstName"
              ? cancelEdit()
              : startEdit("firstName")
          }
          onChange={setFirstName}
        />

        {/* Last Name */}
        <ProfileRow
          label="Last Name"
          value={lastName}
          editing={editing === "lastName"}
          onEdit={() =>
            editing === "lastName"
              ? cancelEdit()
              : startEdit("lastName")
          }
          onChange={setLastName}
        />
      </div>

      {/* ================= ACTION ================= */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ================= REUSABLE ROW ================= */

function ProfileRow({
  label,
  value,
  editing,
  onEdit,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
      <div className="w-full">
        <p className="text-sm text-gray-500">{label}</p>

        {editing ? (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full max-w-xs border rounded px-2 py-1 text-sm
            dark:bg-gray-800 dark:border-gray-700"
          />
        ) : (
          <p className="font-medium text-gray-800 dark:text-white">
            {value || "-"}
          </p>
        )}
      </div>

      <button onClick={onEdit} className="ml-4">
        {editing ? (
          <X size={18} className="text-red-500" />
        ) : (
          <Pencil size={18} className="text-blue-600" />
        )}
      </button>
    </div>
  );
}
