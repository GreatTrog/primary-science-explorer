import Link from "next/link";

import type { CurriculumCoverageEntry, InvestigationSummary } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

type DashboardPageProps = {
  investigations: InvestigationSummary[];
  coverage: CurriculumCoverageEntry[];
  selectedYear?: string;
  selectedArea?: string;
  selectedEnquiry?: string;
};

export function DashboardPage({
  investigations,
  coverage,
  selectedArea,
  selectedEnquiry,
  selectedYear,
}: DashboardPageProps) {
  const years = [...new Set(investigations.map((item) => item.yearGroup))];
  const curriculumAreas = [...new Set(investigations.map((item) => item.curriculumArea))];
  const enquiryTypes = [...new Set(investigations.map((item) => item.enquiryType))];
  const sceneFamilies = new Set(investigations.map((item) => item.sceneFamily)).size;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="glass-panel bg-dot-grid relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-72 rounded-l-full bg-[radial-gradient(circle_at_center,rgba(239,131,84,0.26),transparent_68%)] lg:block" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <p className="display-font text-sm uppercase tracking-[0.24em] text-[var(--accent-pond)]">
              Procedural KS2 science investigations
            </p>
            <h1 className="display-font max-w-3xl text-4xl leading-tight sm:text-5xl">
              Primary Science Explorer
            </h1>
            <p className="max-w-2xl text-lg text-muted">
              Upper KS2 investigations built around planning, prediction and evidence. Pupils
              test ideas inside procedural Babylon.js scenes before they record, analyse and
              evaluate what they found.
            </p>
            <div className="flex flex-wrap gap-3">
              <MetricCard label="Pilot investigations" value={String(investigations.length)} />
              <MetricCard label="Curriculum areas" value={String(coverage.length)} />
              <MetricCard label="Scene families" value={String(sceneFamilies)} />
            </div>
          </div>
          <aside className="glass-panel rounded-[1.75rem] border border-white/60 bg-white/70 p-5">
            <h2 className="display-font text-2xl">Pilot focus</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>KS2-only investigations with planning before prediction and scene testing.</li>
              <li>Lazy-loaded Babylon.js runtime families for forces, circuits, optics and mixtures.</li>
              <li>Teacher preview and notebook export remain available for classroom walkthroughs.</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
        <form className="grid gap-4 lg:grid-cols-4">
          <FilterSelect name="yearGroup" label="Year group" selected={selectedYear} options={years} />
          <FilterSelect
            name="curriculumArea"
            label="Curriculum area"
            selected={selectedArea}
            options={curriculumAreas}
          />
          <FilterSelect
            name="enquiryType"
            label="Enquiry type"
            selected={selectedEnquiry}
            options={enquiryTypes}
          />
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[var(--foreground)] px-5 font-semibold text-white"
            >
              Apply filters
            </button>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] px-5 font-semibold"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {investigations.map((investigation) => (
          <article
            key={investigation.id}
            className="glass-panel group flex h-full flex-col rounded-[1.75rem] p-5"
          >
            <div
              className="mb-5 rounded-[1.5rem] p-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${investigation.hero.accent}, rgba(20,50,61,0.88))`,
              }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                {investigation.hero.eyebrow}
              </p>
              <h2 className="display-font mt-2 text-2xl leading-tight">{investigation.title}</h2>
              <p className="mt-2 text-sm text-white/86">{investigation.hero.blurb}</p>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                <span className="font-semibold text-[var(--foreground)]">Year:</span>{" "}
                {investigation.yearGroup}
              </p>
              <p>
                <span className="font-semibold text-[var(--foreground)]">Area:</span>{" "}
                {investigation.curriculumArea}
              </p>
              <p>
                <span className="font-semibold text-[var(--foreground)]">Enquiry:</span>{" "}
                {investigation.enquiryType}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {investigation.topicKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--foreground)]"
                >
                  {keyword}
                </span>
              ))}
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <Link
                href={`/investigations/${investigation.slug}`}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[var(--accent-pond)] px-5 font-semibold text-white"
              >
                Launch investigation
              </Link>
              <Link
                href={`/teacher/preview/${investigation.slug}`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] px-5 font-semibold"
              >
                Teacher preview
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/55 bg-white/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="display-font mt-1 text-3xl">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: string[];
  selected?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
        className={cn(
          "min-h-12 rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-[var(--foreground)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
        )}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
