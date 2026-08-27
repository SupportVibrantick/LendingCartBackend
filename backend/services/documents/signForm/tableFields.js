function slugKey(value, fallback) {
  const base = String(value || fallback)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "t_$1");
  return (base || fallback).slice(0, 48);
}

/**
 * Expand a table definition into overlay fields.
 * originRect is the PDF bottom-left of row 1 / column 1.
 * Later rows go down the page (decreasing y).
 */
function expandTableToFields(table) {
  const columns = table.columns || [];
  const rows = Math.max(1, Number(table.rows) || 1);
  const origin = table.originRect || { x: 72, y: 400, width: 80, height: 18 };
  const cellWidth =
    Number(table.cellWidth) ||
    Math.max(36, origin.width || 80);
  const cellHeight = Number(table.cellHeight) || Math.max(14, origin.height || 18);
  const gapX = 4;
  const gapY = 3;
  const tableId = slugKey(table.id, "table");
  const fields = [];

  for (let row = 0; row < rows; row += 1) {
    columns.forEach((column, colIndex) => {
      const colKey = slugKey(column.key, `col_${colIndex + 1}`);
      const x = origin.x + colIndex * (cellWidth + gapX);
      const y = origin.y - row * (cellHeight + gapY);
      fields.push({
        id: `fld_${tableId}_r${row + 1}_${colKey}`,
        key: `${tableId}_r${row + 1}_${colKey}`,
        label: `${table.label || "Table"} ${row + 1} · ${column.label || colKey}`,
        type: column.type || "text",
        page: table.page || 1,
        rect: {
          x,
          y: Math.max(0, y),
          width: cellWidth,
          height: cellHeight,
        },
        required: false,
        fillRole: "either",
        group: {
          id: tableId,
          label: table.label || "Table",
        },
        meta: {
          source: "manual",
          tableId,
          rowIndex: row,
          columnKey: colKey,
        },
      });
    });
  }

  return fields;
}

function fieldsWithoutTable(fields, tableId) {
  return (fields || []).filter(
    (field) =>
      field.group?.id !== tableId && field.meta?.tableId !== tableId,
  );
}

module.exports = {
  slugKey,
  expandTableToFields,
  fieldsWithoutTable,
};
