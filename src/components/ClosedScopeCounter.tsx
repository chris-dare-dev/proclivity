/**
 * ClosedScopeCounter — small affordance shown below a section's task input
 * when there are closed (done) todos in that scope. Clicking dispatches the
 * NAV_CLOSED_EVENT custom event which App.tsx catches to switch to the Closed
 * tab. Pure presentational; no hooks, no state.
 *
 * Shared between TodoList (per-scope: today/long) and SprintManager (sprint
 * scope). Extracting here eliminates the duplicate inline JSX in SprintManager
 * (L3-related: keeps cross-section nav wiring in one place) and saves ~300 bytes
 * from the initial bundle by having one function body instead of two.
 */
import { NAV_CLOSED_EVENT } from "@/storage/constants";
import { Check, ArrowRight } from "lucide-react";

interface Props {
  count: number;
  /** Optional suffix for the label text, e.g. " in this sprint" */
  suffix?: string;
}

export function ClosedScopeCounter({ count, suffix = "" }: Props) {
  return (
    <button
      type="button"
      className="closed-scope-counter"
      onClick={() => window.dispatchEvent(new CustomEvent(NAV_CLOSED_EVENT))}
      aria-label={`View ${count} closed task${count === 1 ? "" : "s"}${suffix} in the Closed tab`}
    >
      <span className="closed-scope-counter-check" aria-hidden="true">
        <Check size={13} />
      </span>
      <span className="closed-scope-counter-text">
        {count} closed{suffix}
      </span>
      <span className="closed-scope-counter-arrow" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </button>
  );
}
