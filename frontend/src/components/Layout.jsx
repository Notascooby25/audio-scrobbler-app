import { Outlet } from "react-router-dom";
import HeaderNav from "./HeaderNav";
import Footer from "./Footer";
import Slot from "../skins/Slot";
import UpdateBanner from "./UpdateBanner";

export default function Layout() {
  return (
    <main className="app-shell">
      <UpdateBanner />
      <Slot name="appNav" fallback={<HeaderNav />} />
      <div className="app-content">
        <Outlet />
      </div>
      <Footer />
    </main>
  );
}
