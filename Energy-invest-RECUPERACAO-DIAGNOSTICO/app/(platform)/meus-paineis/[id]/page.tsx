import { HoldingDetails } from "@/components/profile";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HoldingDetails id={id} />;
}
