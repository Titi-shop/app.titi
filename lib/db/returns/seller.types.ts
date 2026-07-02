/* =====================================================
   TYPES
===================================================== */

export type ReturnStatus =
  | "pending"
  | "approved"
  | "shipping_back"
  | "received"
  | "refunded"
  | "rejected";

export type TimelineItem = {
  key: string;
  label: string;
  time: string;
};

export type ReturnItem = {
  product_name: string;
  thumbnail: string;
  quantity: number;
  unit_price: number;
};

export type SellerReturnDetail = {
  id: string;
  return_number: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  evidence_images: string[];
  timeline: TimelineItem[];
  items: ReturnItem[];
};
