import { useEffect, useState, useRef } from "react";
import { API_URL } from "../src/config.ts";

const audio = new Audio("/notification.mp3");

function getOrderDelivery(order: any) {
  const customer = order.customer ?? {};
  const hasSnapshot = Boolean(
    order.deliveryName &&
    order.deliveryPhone &&
    order.deliveryAddress &&
    order.deliveryArea &&
    order.deliveryCity
  );

  return {
    name: order.deliveryName ?? customer.name ?? "Unknown customer",
    phone: order.deliveryPhone ?? customer.phone ?? "—",
    address: order.deliveryAddress ?? customer.address ?? "—",
    area: order.deliveryArea ?? customer.area ?? "—",
    city: order.deliveryCity ?? customer.city ?? "—",
    hasSnapshot,
  };
}

type OrdersPageProps = {
  accessToken: string;
  signedInEmail: string;
  onSignOut: () => Promise<void>;
};

export default function OrdersPage({ accessToken, signedInEmail, onSignOut }: OrdersPageProps) {
  const previousCount = useRef(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const dateFilter = "TODAY";
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401) {
        setApiError("Your session expired. Please sign in again.");
        await onSignOut();
        return;
      }
      if (response.status === 403) {
        setApiError("This account is not authorised for kitchen access. Contact the owner.");
        return;
      }
      if (!response.ok) throw new Error(`Order request failed (${response.status}).`);

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("The server returned an unexpected order response.");

      if (data.length > previousCount.current) {
        void audio.play().catch(() => undefined);
      }
      previousCount.current = data.length;
      setOrders(data);
      setApiError("");
    } catch {
      setApiError("Unable to load orders. Check the API connection and try again.");
    }
  };

const updateStatus = async (
  id: string,
  status: string
) => {



  try {
    const response = await fetch(`${API_URL}/orders/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status }),
    });

    if (response.status === 401) {
      setApiError("Your session expired. Please sign in again.");
      await onSignOut();
      return;
    }
    if (response.status === 403) {
      setApiError("This account is not authorised to update orders.");
      return;
    }
    if (!response.ok) throw new Error(`Status update failed (${response.status}).`);

    await loadOrders();
  } catch {
    setApiError("Unable to update this order. Please try again.");
  }
};


useEffect(() => {
  loadOrders();

  const interval = setInterval(() => {
    loadOrders();
  }, 5000);

  return () => clearInterval(interval);
}, [accessToken]);

const filteredOrders = orders.filter((order) => {
  const delivery = getOrderDelivery(order);
  const query = search.toLowerCase();

  const matchesSearch =
    delivery.name.toLowerCase().includes(query) ||
    delivery.phone.includes(search) ||
    order.invoiceNumber.toLowerCase().includes(query);

  const matchesStatus =
    statusFilter === "ALL" || order.status === statusFilter;

  if (dateFilter === "TODAY") {
    const today = new Date().toDateString();
    if (new Date(order.createdAt).toDateString() !== today)
      return false;
  }

  return matchesSearch && matchesStatus;

});

const todayRevenue = filteredOrders.reduce(
  (sum, o) => sum + o.total,
  0
);

const pending = filteredOrders.filter(
  o => o.status === "PENDING"
).length;

const preparing = filteredOrders.filter(
  o => o.status === "PREPARING"
).length;



  return (

    


    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 25 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0 }}>USB Kitchen Dashboard</h1>
          <small style={{ color: "#666" }}>Signed in as {signedInEmail}</small>
        </div>
        <button onClick={() => void onSignOut()} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Sign out
        </button>
      </div>

      {apiError && (
        <div role="alert" style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "#fff1f0", color: "#9b1c1c" }}>
          {apiError}
        </div>
      )}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:15,
marginBottom:25
}}
>

<div style={{
background:"#1F3D2B",
color:"white",
padding:20,
borderRadius:12
}}>
<div>Today's Revenue</div>
<h2>₹{todayRevenue}</h2>
</div>

<div style={{
background:"#E98A15",
color:"white",
padding:20,
borderRadius:12
}}>
<div>Orders</div>
<h2>{filteredOrders.length}</h2>
</div>

<div style={{
background:"#ff9800",
color:"white",
padding:20,
borderRadius:12
}}>
<div>Pending</div>
<h2>{pending}</h2>
</div>

<div style={{
background:"#2196f3",
color:"white",
padding:20,
borderRadius:12
}}>
<div>Preparing</div>
<h2>{preparing}</h2>
</div>

</div>

<div
style={{
display:"flex",
gap:15,
marginBottom:20
}}
>

<input

placeholder="Search customer / phone / invoice"

value={search}

onChange={(e)=>setSearch(e.target.value)}

style={{
flex:1,
padding:12,
borderRadius:10,
border:"1px solid #ddd"
}}

/>

<select

value={statusFilter}

onChange={(e)=>setStatusFilter(e.target.value)}

style={{
padding:12,
borderRadius:10
}}
>

<option value="ALL">All</option>
<option value="PENDING">Pending</option>
<option value="CONFIRMED">Confirmed</option>
<option value="PREPARING">Preparing</option>
<option value="READY">Ready</option>
<option value="DELIVERED">Delivered</option>

</select>

</div>

      {filteredOrders.map((order:any)=>(
        <div
          key={order.id}
          style={{
            border:"1px solid #ddd",
            padding:12,
            marginBottom:10,
            borderRadius:10,
            background:"#fff",
            cursor:"pointer"
          }}

onClick={()=>{

if(expandedOrder===order.id)
setExpandedOrder(null);

else
setExpandedOrder(order.id);

}}
        >
          <div
style={{
display:"grid",
gridTemplateColumns:"170px 90px 1fr 140px 110px 140px",
alignItems:"center",
gap:10
}}
>

<b>{order.invoiceNumber}</b>

<span>

{new Date(order.createdAt).toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})}

</span>

<span>

{getOrderDelivery(order).name}

</span>

<span>

{getOrderDelivery(order).area}

</span>

<b>

₹{order.total}

</b>

<span>

{order.status}

</span>

</div>
{expandedOrder===order.id && (

<>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "#f8f8f8",
            }}
          >
            <strong>Delivery details</strong>
            {!getOrderDelivery(order).hasSnapshot && (
              <p style={{ color: "#9a5b00", margin: "6px 0" }}>
                Historical delivery details were not saved for this order. The customer profile below is only a reference; confirm the address with the customer before dispatch.
              </p>
            )}
            <p><b>{getOrderDelivery(order).name}</b></p>
            <p>{getOrderDelivery(order).phone}</p>
            <p>{getOrderDelivery(order).address}</p>
            <p>{getOrderDelivery(order).area}, {getOrderDelivery(order).city}</p>
          </div>

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
  </>
)}

          <p>Total ₹{order.total}</p>

          <hr />

          {order.bowls.map((bowl: any) => (
  <div
    key={bowl.id}
    style={{
      marginTop: 8,
      padding: 8,
      borderRadius: 8,
      background: "#f8f8f8",
    }}
  >
    <div style={{ fontWeight: 600 }}>
      {bowl.quantity} × {bowl.bowlName}
    </div>

    {bowl.details && (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          marginTop: 8,
          fontSize: 13,
          color: "#444",
          fontFamily: "inherit",
        }}
      >
        {bowl.details}
      </pre>
    )}
  </div>
))}
        </div>
      ))}

      
    </div>
  );
}

