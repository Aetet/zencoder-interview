import '@reatom/core'

declare module '@reatom/core' {
  interface RouteChild extends React.JSX.Element {}
}

declare global {
  // eslint-disable-next-line no-var
  var LOG: typeof import('@reatom/core').log
}
