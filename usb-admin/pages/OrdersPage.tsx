import { useEffect, useState, useRef } from "react";
import { API_URL } from "../src/config.ts";

const audio = new Audio("/notification.mp3");


export default function OrdersPage() {
    const previousCount = useRef(0);
  const [orders, setOrders] = useState<any[]>([]);

  const loadOrders = () => {
  fetch(`${API_URL}/orders`)
    .then((res) => res.json())
    .then((data) => {

      if (data.length > previousCount.current) {
        audio.play();
      }

      previousCount.current = data.length;

      setOrders(data);
    });
};

const updateStatus = async (
  id: string,
  status: string
) => {



  await fetch(
    `${API_URL}/orders/${id}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    }
  );

  loadOrders();
};


useEffect(() => {
  loadOrders();

  const interval = setInterval(() => {
    loadOrders();
  }, 5000);

  return () => clearInterval(interval);
}, []);

  return (
    <div style={{ padding: 30 }}>
      <h1>USB Kitchen Dashboard</h1>

      <p>Total Orders: {orders.length}</p>

      {orders.map((order: any) => (
        <div
          key={order.id}
          style={{
            border: "1px solid #ccc",
            padding: 20,
            marginBottom: 20,
            borderRadius: 10,
          }}
        >
          <h3>{order.invoiceNumber}</h3>

          <p>
            <b>{order.customer.name}</b>
          </p>

          <p>{order.customer.phone}</p>

          <p>
            {order.customer.area}, {order.customer.city}
          </p>

          <p>Status: {order.status}</p>
          <div
  style={{
    display: "flex",
    gap: 10,
    marginTop: 15,
  }}
>
  {order.status === "PENDING" && (
    <button
      onClick={() => updateStatus(order.id, "CONFIRMED")}
    >
      Confirm
    </button>
  )}

  {order.status === "CONFIRMED" && (
    <button
      onClick={() => updateStatus(order.id, "PREPARING")}
    >
      Start Preparing
    </button>
  )}

  {order.status === "PREPARING" && (
    <button
      onClick={() => updateStatus(order.id, "READY")}
    >
      Ready
    </button>
  )}

  {order.status === "READY" && (
    <button
      onClick={() => updateStatus(order.id, "DELIVERED")}
    >
      Delivered
    </button>
  )}
</div>

          <p>Total ₹{order.total}</p>

          <hr />

          {order.bowls.map((bowl: any) => (
            <div key={bowl.id}>
              {bowl.quantity} × {bowl.bowlName}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

