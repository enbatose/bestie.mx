import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { ContactPage } from "@/pages/ContactPage";
import { FaqPage } from "@/pages/FaqPage";
import { HomePage } from "@/pages/HomePage";
import { LegalPage } from "@/pages/LegalPage";
import { ListingPage } from "@/pages/ListingPage";
import { MyListingsPage } from "@/pages/MyListingsPage";
import { PublishWizardPage } from "@/pages/PublishWizardPage";
import { SearchPage } from "@/pages/SearchPage";
import { SignInPage } from "@/pages/SignInPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "buscar", element: <SearchPage /> },
      { path: "anuncio/:id", element: <ListingPage /> },
      { path: "publicar", element: <PublishWizardPage /> },
      { path: "mis-anuncios", element: <MyListingsPage /> },
      { path: "contacto", element: <ContactPage /> },
      { path: "faq", element: <FaqPage /> },
      { path: "legal", element: <LegalPage /> },
      { path: "entrar", element: <SignInPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
