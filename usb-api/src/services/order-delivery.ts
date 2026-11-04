export type CheckoutDeliveryInput = {
  customerName: string;
  phone: string;
  address: string;
  area: string;
};

export type OrderDeliverySnapshot = {
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  deliveryArea: string;
  deliveryCity: string;
};

/** Build the order's delivery snapshot from the validated checkout payload. */
export function createOrderDeliverySnapshot(
  input: CheckoutDeliveryInput,
): OrderDeliverySnapshot {
  return {
    deliveryName: input.customerName.trim(),
    deliveryPhone: input.phone.trim(),
    deliveryAddress: input.address.trim(),
    deliveryArea: input.area.trim(),
    deliveryCity: "Pune",
  };
}
