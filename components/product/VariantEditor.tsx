// components/product/VariantEditor.tsx

export default function VariantEditor({ variants, setVariants }: any) {
  const updateVariant = (index: number, key: string, value: any) => {
    setVariants((prev: any[]) =>
      prev.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      )
    );
  };

  return (
    <div className="space-y-2">
      {variants.map((v: any, i: number) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          <input
            value={v.optionValue}
            onChange={(e) =>
              updateVariant(i, "optionValue", e.target.value)
            }
          />
        </div>
      ))}
    </div>
  );
}
