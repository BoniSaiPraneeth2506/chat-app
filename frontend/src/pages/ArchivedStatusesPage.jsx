import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Archive } from "lucide-react";
import { toast } from "react-hot-toast";
import { useStatusStore } from "../store/useStatusStore";
import ManagedStatusList from "../components/status/ManagedStatusList";

/**
 * A separate screen for statuses kept after their 24h window.
 *
 * Reached from the Updates three-dot menu. Archived statuses are not live, so
 * this page is the only place they can be restored or deleted.
 */
const ArchivedStatusesPage = () => {
  const navigate = useNavigate();
  const { archivedStatuses, isLoadingManaged, fetchManagedStatuses, restoreArchivedStatus, deleteStatus } =
    useStatusStore();
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchManagedStatuses();
  }, [fetchManagedStatuses]);

  const handleRestore = async (statusId) => {
    setBusyId(statusId);
    try {
      await restoreArchivedStatus(statusId);
      toast.success("Status is live again");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not restore that status");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (statusId) => {
    setBusyId(statusId);
    try {
      await deleteStatus(statusId);
      await fetchManagedStatuses();
      toast.success("Deleted");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete that status");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="container min-h-screen max-w-5xl px-4 pt-6 pb-12 mx-auto"
      style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <Archive size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Archived statuses</h1>
              <p className="text-xs opacity-60">Kept after their 24 hours</p>
            </div>
          </div>
        </div>

        <ManagedStatusList
          tab="archived"
          statuses={archivedStatuses}
          loading={isLoadingManaged}
          busyId={busyId}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};

export default ArchivedStatusesPage;