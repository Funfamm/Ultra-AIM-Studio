import AnalyticsTabs from "./analytics-tabs";
import "./analytics.css";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="analytics-shell">
      <div className="cmd-header">
        <div>
          <h1 className="cmd-title">Studio Command Center</h1>
          <p className="analytics-sub">First-party analytics · No third-party tracking</p>
        </div>
      </div>
      <AnalyticsTabs />
      <div className="atab-content">{children}</div>
    </div>
  );
}
