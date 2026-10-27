// template (в отличие от layout) пересоздаётся при каждом переходе —
// даёт плавное появление каждой страницы дашборда (anim-page-in из theme.css).
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page-in">{children}</div>;
}
