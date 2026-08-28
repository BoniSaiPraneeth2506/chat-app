import { ArrowLeft, ChevronRight, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FEATURES } from "../data/features";

const FeaturesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container min-h-screen max-w-2xl px-3 pt-20 pb-12 mx-auto"
         style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <BookOpen size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Features</h1>
              <p className="text-xs opacity-60">How to use every part of Chatty</p>
            </div>
          </div>
        </div>

        <p className="text-xs opacity-60 px-1">
          Tap a feature to see what it does and how to use it — from the things you'll use most
          down to the extras.
        </p>

        {/* Feature list, ordered by priority (most used first) */}
        <div className="overflow-hidden rounded-2xl divide-y divide-base-300/40"
             style={{ backgroundColor: "var(--color-base-200)/40" }}>
          {FEATURES.map(({ id, icon: Icon, title, tagline }) => (
            <button
              key={id}
              onClick={() => navigate(`/settings/feature/${id}`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-3.5 transition-colors hover:bg-base-200/70 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid rounded-xl place-items-center size-10 shrink-0 bg-primary/10">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-medium truncate">{title}</span>
                  <span className="block text-xs opacity-60 truncate">{tagline}</span>
                </div>
              </div>
              <ChevronRight size={18} className="opacity-40 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturesPage;
