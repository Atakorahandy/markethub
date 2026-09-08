// eslint-config-next@16 ships a native flat-config array (dist/core-web-vitals.js
// exports the config directly), so this imports it straight rather than going
// through the legacy FlatCompat("next/core-web-vitals") shim — that shim
// crashed here with "Converting circular structure to JSON" while validating
// eslint-plugin-react's flat config through the old-style config-array
// validator, which isn't built for flat-shaped configs.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  // eslint-plugin-react-hooks v7 (pulled in by eslint-config-next@16) adds
  // two new React-Compiler-readiness rules that this codebase doesn't
  // conform to: `set-state-in-effect` flags the standard "fetch on mount"
  // pattern (`useEffect(() => { load() }, [])`) used throughout every
  // client-fetched page in this app — a correct, working pattern under
  // React 19 without the Compiler, just one the Compiler's stricter model
  // would rather see written differently. `purity` flags `Date.now()` calls
  // during render (one spot, a status-badge computation with no correctness
  // impact). Neither is a bug; both are downgraded to warnings rather than
  // either silently ignored or used to justify a broad, risk-laden refactor
  // of the app's core data-loading pattern as a side effect of a version
  // bump. Revisit for real if this app ever adopts the React Compiler.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
