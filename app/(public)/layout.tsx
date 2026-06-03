import NavWrapper from "@/components/nav-wrapper";
import Footer from "@/components/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavWrapper />
      <div className="nav-offset">{children}</div>
      <Footer />
    </>
  );
}
