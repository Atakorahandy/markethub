export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Eastern",
  "Western",
  "Central",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Oti",
  "Savannah",
  "North East",
  "Western North",
] as const;

export const VEHICLE_TYPES = [
  { key: "bike", label: "Bicycle" },
  { key: "motorbike", label: "Motorbike" },
  { key: "car", label: "Car" },
  { key: "van", label: "Van" },
  { key: "on_foot", label: "On foot" },
] as const;

export const VENDOR_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};
