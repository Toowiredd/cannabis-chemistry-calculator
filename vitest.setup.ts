/**
 * Vitest setup file. Loaded BEFORE any test imports, so the
 * IS_REACT_ACT_ENVIRONMENT flag is set before React 19's test-utils
 * captures its `act` reference.
 *
 * Without this, every `<Component />` render() inside @testing-library/react
 * throws "React.act is not a function" because the production build of
 * react-dom-test-utils is loaded and `act` is gated on this flag.
 *
 * See: https://github.com/testing-library/react-testing-library/issues/1102
 *      https://react.dev/reference/react/act
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true
