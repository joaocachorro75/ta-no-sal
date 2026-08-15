export function localLoginPath(returnTo = "/") {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/entrar?retorno=${encodeURIComponent(safeReturnTo)}`;
}
