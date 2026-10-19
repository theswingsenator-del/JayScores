import MatchClient from "./MatchClient";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchClient id={Number(id)} />;
}
