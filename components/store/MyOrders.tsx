"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { ORDER_COLUMNS, formatIDR, statusLabel, type Order } from "@/lib/store";

/** Member's own Loca Store orders (RLS limits the query to the signed-in member). Hidden when empty or when store.sql is not installed yet. */
export default function MyOrders({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;
    getSupabaseClient().from("store_orders").select(ORDER_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
      .then(({ data, error }) => { if (active && !error) setOrders((data ?? []) as unknown as Order[]); });
    return () => { active = false; };
  }, [userId]);

  if (orders.length === 0) return null;
  return (
    <section className="card aside-card" aria-labelledby="aside-orders">
      <header className="aside-head"><h2 id="aside-orders">Pesanan Loca Store</h2><span>{orders.length} TERAKHIR</span></header>
      <ul className="aside-list">
        {orders.map((order) => (
          <li key={order.id}>
            <strong>#{order.id} · {formatIDR(order.total)}</strong>
            <small>{statusLabel(order.status)} · {order.store_order_items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</small>
          </li>
        ))}
      </ul>
      <p className="showcase-note"><a href="/store">Belanja lagi di Loca Store →</a></p>
    </section>
  );
}
