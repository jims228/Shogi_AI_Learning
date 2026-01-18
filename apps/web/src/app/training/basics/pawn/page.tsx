import { PawnTrainingClient } from "./PawnTrainingClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    mobile?: string;
    noai?: string;
    lid?: string;
  }> | {
    mobile?: string;
    noai?: string;
    lid?: string;
  };
};

export default async function PawnTrainingPage({ searchParams }: PageProps) {
  const sp = await Promise.resolve(searchParams);
  const isMobile = sp?.mobile === "1" || sp?.noai === "1" || !!sp?.lid;
  return <PawnTrainingClient mobile={isMobile} />;
}
