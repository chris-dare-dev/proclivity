/**
 * Augment React's HTMLAttributes to include the `inert` attribute.
 *
 * React 18.3's `@types/react` still doesn't declare `inert` despite it
 * being a well-supported HTML global attribute (Chrome 102+, Firefox 112+,
 * Safari 15.5+). React 19+'s types include it natively; this augmentation
 * is a forward-compat shim that can be deleted on the React 19 upgrade.
 *
 * Added for m4-s11 (UPL-2 cross-dissolve) where each tabpanel needs
 * `inert={leavingTab === id ? true : undefined}` during the 220 ms
 * fade-out window to block Tab-key escape into the visually-present-but-
 * leaving panel. `pointer-events: none` blocks mouse but NOT Tab; `inert`
 * removes the element from focus order + a11y tree atomically.
 *
 * MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert
 */

import "react";

declare module "react" {
  interface HTMLAttributes<T> {
    // React 19's declaration is `boolean | undefined`; matching that shape
    // (no empty-string member) discourages the `inert=""` antipattern at
    // call sites (m4 rect L2).
    inert?: boolean | undefined;
  }
}
