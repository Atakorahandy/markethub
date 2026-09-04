import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { parseStringArray } from "@/lib/json";

export type ProductCardData = {
  slug: string;
  name: string;
  price: number;
  discountPrice: number | null;
  images: string;
  stock: number;
  isFeatured?: boolean;
  flashSalePrice?: number | null;
  vendor: { businessName: string; slug: string };
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = parseStringArray(product.images)[0];
  const outOfStock = product.stock <= 0;
  const normalPrice = product.discountPrice ?? product.price;
  const onFlashSale = product.flashSalePrice != null && product.flashSalePrice < normalPrice;
  const displayPrice = onFlashSale ? product.flashSalePrice! : normalPrice;
  const wasPrice = onFlashSale ? normalPrice : product.discountPrice != null ? product.price : null;

  return (
    <Link href={`/product/${product.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="relative aspect-square bg-black/5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🛍️</div>
        )}
        {onFlashSale && <span className="badge absolute left-2 top-2 bg-red-600 text-white">⚡ Flash sale</span>}
        {!onFlashSale && product.isFeatured && <span className="badge absolute left-2 top-2 bg-accent-500 text-white">Featured</span>}
        {outOfStock && <span className="badge absolute right-2 top-2 bg-zinc-800 text-white">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="muted text-xs">{product.vendor.businessName}</p>
        <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className={`font-bold ${onFlashSale ? "text-red-600" : "text-brand-700"}`}>{formatMoney(displayPrice)}</span>
          {wasPrice != null && <span className="muted text-xs line-through">{formatMoney(wasPrice)}</span>}
        </div>
      </div>
    </Link>
  );
}
