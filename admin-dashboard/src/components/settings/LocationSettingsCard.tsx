import { MapPin, Navigation, Building, Globe, Hash, Map } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const LocationSettingsCard = () => {
  const [autoDetect, setAutoDetect] = useState(false);

  const [location, setLocation] = useState({
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocation({ ...location, [e.target.name]: e.target.value });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        );

        const data = await res.json();

        setLocation({
          address: data.display_name || "",
          city: data.address?.city || data.address?.town || "",
          state: data.address?.state || "",
          postalCode: data.address?.postcode || "",
          country: data.address?.country || "",
        });

        toast.success("Location detected successfully");
      } catch {
        toast.error("Failed to detect location");
      }
    });
  };

  const saveLocation = () => {
    localStorage.setItem("user_location", JSON.stringify(location));
    toast.success("Location saved successfully");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Location Settings
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your address and location preferences for accurate services.
          </p>
        </div>
      </div>

      {/* Auto Detect Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <button
          onClick={detectLocation}
          className="flex text-xs items-center gap-2 px-4 py-2 bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow"
        >
          <Navigation size={16} />
          Detect My Location
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 dark:text-gray-300">
            Auto-detect on page load
          </span>

          <button
            onClick={() => setAutoDetect(!autoDetect)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition
    ${autoDetect ? "bg-[#13538A]" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition
      ${autoDetect ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-5">
        {/* Address */}
        <div className="col-span-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Street Address
          </label>

          <div className="relative mt-1">
            <MapPin size={14} className="absolute left-3 top-3 text-gray-400" />

            <input
              name="address"
              value={location.address}
              onChange={handleChange}
              placeholder="123 Main Street, Building A"
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-[#13538A]"
            />
          </div>
        </div>

        {/* City */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            City
          </label>

          <div className="relative mt-1">
            <Building
              size={14}
              className="absolute left-3 top-3 text-gray-400"
            />

            <input
              name="city"
              value={location.city}
              onChange={handleChange}
              placeholder="Mumbai"
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-[#13538A]"
            />
          </div>
        </div>

        {/* State */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            State / Province
          </label>

          <div className="relative mt-1">
            <Map size={14} className="absolute left-3 top-3 text-gray-400" />

            <input
              name="state"
              value={location.state}
              onChange={handleChange}
              placeholder="Maharashtra"
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-[#13538A]"
            />
          </div>
        </div>

        {/* Postal Code */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Postal Code
          </label>

          <div className="relative mt-1">
            <Hash size={14} className="absolute left-3 top-3 text-gray-400" />

            <input
              name="postalCode"
              value={location.postalCode}
              onChange={handleChange}
              placeholder="400001"
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-[#13538A]"
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Country
          </label>

          <div className="relative mt-1">
            <Globe size={14} className="absolute left-3 top-3 text-gray-400" />

            <input
              name="country"
              value={location.country}
              onChange={handleChange}
              placeholder="India"
              className="w-full text-sm pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-[#13538A]"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={saveLocation}
          className="px-6 text-sm py-2.5 bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow font-medium"
        >
          Save Location
        </button>
      </div>
    </div>
  );
};

export default LocationSettingsCard;
