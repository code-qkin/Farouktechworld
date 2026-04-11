import Navbar from "../components/NavBar.jsx";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../components/Footer.jsx";

const MainLayout = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <>
        <Navbar />
        <Outlet />
        {!isAdminPath && <Footer />}
    </>
  )
}

export default MainLayout
