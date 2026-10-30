import { type Product, yen } from "../api.ts";

export function Products({ products, onAdd }: { products: readonly Product[]; onAdd: (p: Product) => void }) {
  return (
    <ul className="products">
      {products.map((p) => (
        <li key={p.id}>
          <h2>{p.name}</h2>
          <p>{p.description}</p>
          <p className="price">{yen(p.price)}</p>
          <p className="stock">{p.stock > 0 ? `在庫 ${p.stock}` : "在庫切れ"}</p>
          <button disabled={p.stock <= 0} onClick={() => onAdd(p)}>カートに入れる</button>
        </li>
      ))}
    </ul>
  );
}
