type AttributedRow = {
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
};

/** The `AttributionFields` of a catalog response, from a row's attribution columns. */
export function attributionFields(row: AttributedRow) {
  return {
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdById,
    updatedBy: row.updatedById,
  };
}
