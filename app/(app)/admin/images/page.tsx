import ImagesClient from "./ImagesClient";

export default async function AdminImagesPage({
  searchParams
}: {
  searchParams: Promise<{ userId?: string; email?: string }>;
}) {
  const params = await searchParams;
  return <ImagesClient initialUserId={params.userId} initialEmail={params.email} />;
}
