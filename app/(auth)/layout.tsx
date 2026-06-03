// Auth pages share a centered, cinematic background layout
import "./auth-layout.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  );
}
