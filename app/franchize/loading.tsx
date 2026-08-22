// FIX: Return null instead of a visible loading screen.
// The goldish "Загружаем каталог..." text and "Вернуться в каталог" link
// were flashing during client-side <Link> navigations between franchize
// pages, breaking the SPA feel. Returning null keeps the previous page
// visible until the new one hydrates, matching the SPA transition the
// owner expects. Direct (hard) navigations still get an instant render
// from the server.
export default function FranchizeLoading() {
  return null;
}
