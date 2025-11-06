import {Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from "react-router-dom";
import HomePage from './pages/Homepage';
import MainLayout from './layout/MainLayout';
import NotFoundPage from './components/NotFoundPage';
import PricingPage from './pages/PricingPage';
function App() {
    const router = createBrowserRouter(
      createRoutesFromElements(
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} /> 
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="*" element={<NotFoundPage />} />         
        </Route>
      ) 
    );

  return (
    <RouterProvider router={router} />
  )
}

export default App
