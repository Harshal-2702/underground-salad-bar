import { useEffect, useState, useRef } from "react";
import { API_URL } from "../src/config.ts";

const audio = new Audio("/notification.mp3");


export default function OrdersPage() {
  const previousCount = useRef(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const dateFilter = "TODAY";
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

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

const filteredOrders = orders.filter((order) => {

  const matchesSearch =
    order.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    order.customer.phone.includes(search) ||
    order.invoiceNumber.toLowerCase().includes(search.toLowerCase());

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
      <h1
style={{
fontSize:34,
fontWeight:700,
marginBottom:25
}}
>
🥗 USB Kitchen Dashboard
</h1>

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

{order.customer.name}

</span>

<span>

{order.customer.area}

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

