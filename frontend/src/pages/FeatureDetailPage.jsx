import { ArrowLeft, Lightbulb } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { FEATURES } from "../data/features";

const FeatureDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const feature = FEATURES.find((f) => f.id === id);

  if (!feature) {
    return (
      <div className="container min-h-screen max-w-2xl px-4 pt-20 pb-12 mx-auto text-center"
           style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
        <button
          onClick={() => navigate("/settings/features")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-base-200"
        >
          <ArrowLeft size={16} /> Back to features
        </button>
        <p className="mt-6 text-sm opacity-60">That feature doesn't exist.</p>
      </div>
    );
  }

  const Icon = feature.icon;

  return (
    <div className="container min-h-screen max-w-2xl px-4 pt-20 pb-12 mx-auto"
         style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <Icon size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{feature.title}</h1>
              <p className="text-xs opacity-60">{feature.tagline}</p>
            </div>
          </div>
        </div>

        {/* What it does */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            What it does
          </span>
          <div className="overflow-hidden rounded-2xl"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            <div className="p-4 text-sm leading-relaxed opacity-80">{feature.summary}</div>
          </div>
        </div>

        {/* How to use it */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1">
            How to use it
          </span>
          <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
               style={{ backgroundColor: "var(--color-base-200)/40" }}>
            {feature.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                <span className="grid rounded-full size-6 shrink-0 place-items-center bg-primary/15 text-[11px] font-semibold text-primary mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed opacity-85 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tip */}
        {feature.tip && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
               style={{ backgroundColor: "var(--color-primary)/10" }}>
            <Lightbulb size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed opacity-85">
              <span className="font-semibold text-primary">Tip: </span>
              {feature.tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureDetailPage;
