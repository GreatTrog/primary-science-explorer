import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { listCoverage, listInvestigations } from "@/lib/data/repository";

type SearchParams = Promise<{
  yearGroup?: string;
  curriculumArea?: string;
  enquiryType?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = await searchParams;
  const [investigations, coverage] = await Promise.all([
    listInvestigations(filters),
    listCoverage(),
  ]);

  return (
    <DashboardPage
      investigations={investigations}
      coverage={coverage}
      selectedArea={filters.curriculumArea}
      selectedEnquiry={filters.enquiryType}
      selectedYear={filters.yearGroup}
    />
  );
}
