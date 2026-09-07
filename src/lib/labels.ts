import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface LabelRow {
  id: string;
  name: string;
  quantity: number;
}

export const fetchLabels = async (): Promise<LabelRow[]> => {
  const { data } = await db.from("labels").select("id, name, quantity").order("name");
  return (data || []) as LabelRow[];
};

/** Ensure a label row exists for a product name and return it. */
export const ensureLabel = async (name: string): Promise<LabelRow | null> => {
  const { data } = await db.from("labels").select("id, name, quantity").eq("name", name).maybeSingle();
  if (data) return data as LabelRow;
  const { data: created } = await db
    .from("labels")
    .insert([{ name, quantity: 0 }])
    .select("id, name, quantity")
    .maybeSingle();
  return (created as LabelRow) || null;
};

/** Set a label quantity manually (no automatic warehouse effect). */
export const setLabelQuantity = async (name: string, quantity: number) => {
  const label = await ensureLabel(name);
  if (!label) return;
  const delta = quantity - label.quantity;
  await db.from("labels").update({ quantity: Math.max(0, quantity), updated_at: new Date().toISOString() }).eq("id", label.id);
  if (delta !== 0) {
    await db.from("label_transactions").insert([{
      label_id: label.id,
      label_name: name,
      change_quantity: delta,
      reason: "correction",
      comment: "ხელით ჩასწორება საწყობის გვერდიდან",
    }]);
  }
};

/** Return labels when stock is manually removed from the main warehouse. */
export const returnLabels = async (name: string, quantity: number, comment = "ხელით შემცირება") => {
  if (quantity <= 0) return;
  const label = await ensureLabel(name);
  if (!label) return;
  await db.from("labels").update({ quantity: label.quantity + quantity, updated_at: new Date().toISOString() }).eq("id", label.id);
  await db.from("label_transactions").insert([{
    label_id: label.id,
    label_name: name,
    change_quantity: quantity,
    reason: "warehouse_reduce",
    comment,
  }]);
};

/**
 * Consume labels when stock is ADDED to the main warehouse.
 * Never increases label quantity.
 */
export const consumeLabels = async (name: string, quantity: number, comment = "საწყობში შეტანა") => {
  if (quantity <= 0) return;
  const label = await ensureLabel(name);
  if (!label) return;
  const used = Math.min(label.quantity, quantity);
  if (used <= 0) return;
  await db.from("labels").update({ quantity: label.quantity - used, updated_at: new Date().toISOString() }).eq("id", label.id);
  await db.from("label_transactions").insert([{
    label_id: label.id,
    label_name: name,
    change_quantity: -used,
    reason: "warehouse_intake",
    comment,
  }]);
};
