// components/product/ShippingRates.tsx

export default function ShippingRates({ shippingRates, setShippingRates }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.keys(shippingRates).map((key) => (
        <input
          key={key}
          type="number"
          value={shippingRates[key]}
          onChange={(e) =>
            setShippingRates((prev: any) => ({
              ...prev,
              [key]: e.target.value ? Number(e.target.value) : "",
            }))
          }
        />
      ))}
    </div>
  );
}
