import { CustomerOrder } from "./customer-order";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  const table = (await searchParams).table;
  const initialTableCode = (Array.isArray(table) ? table[0] : table)?.trim().slice(0, 20) ?? "";

  return <CustomerOrder initialTableCode={initialTableCode} />;
}
