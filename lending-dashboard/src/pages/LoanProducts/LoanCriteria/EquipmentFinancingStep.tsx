import { Settings, CheckCircle } from "lucide-react";

const equipmentOptions = [
  "Heavy Machinery",
  "Construction Equipment",
  "Medical Equipment",
  "Restaurant Equipment",
  "IT / Technology Equipment",
  "Manufacturing Equipment",
  "Office Equipment",
  "Vehicles / Fleet",
  "Agricultural Equipment",
  "Industrial Equipment",
];

const getColor = (name: string) => {
  const colors = [
    "bg-orange-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-brand-500",
    "bg-red-500",
    "bg-cyan-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const EquipmentFinancingStep = ({ value = [], setValue }: any) => {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (item: string) => {
    const updated = selected.includes(item)
      ? selected.filter((i) => i !== item)
      : [...selected, item];

    setValue(updated);
  };

  const selectAll = () => {
    setValue(equipmentOptions);
  };

  const clearAll = () => {
    setValue([]);
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Settings size={16} />
            Equipment Types
            {selected.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                {selected.length} selected
              </span>
            )}
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Select equipment types this lender finances.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-4 text-sm mt-1">
          <button
            onClick={selectAll}
            className="text-blue-600 font-medium hover:underline"
          >
            Select All
          </button>

          <button
            onClick={clearAll}
            className="text-red-500 font-medium hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {equipmentOptions.map((item) => {
          const isChecked = selected.includes(item);

          return (
            <label
              key={item}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 border
              ${
                isChecked
                  ? "border-blue-500 bg-blue-50 shadow-sm scale-[1.02]"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(item)}
                className="cursor-pointer accent-blue-600"
              />

              {/* COLOR DOT */}
              <span
                className={`w-2.5 h-2.5 rounded-full ${getColor(
                  item,
                )} shadow-sm ring-2 ring-white`}
              />

              <span className="text-sm font-medium flex-1">{item}</span>

              {/* CHECK ICON */}
              {isChecked && <CheckCircle size={16} className="text-blue-600" />}
            </label>
          );
        })}
      </div>

      {/* FOOTER INFO */}
      {selected.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          {selected.length} equipment type(s) selected
        </div>
      )}
    </div>
  );
};

export default EquipmentFinancingStep;
