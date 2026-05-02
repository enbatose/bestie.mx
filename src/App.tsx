import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { AccountEditPage } from "@/pages/AccountEditPage";
import { AdminPage } from "@/pages/AdminPage";
import { ContactPage } from "@/pages/ContactPage";
import { FaqPage } from "@/pages/FaqPage";
import { GroupsPage } from "@/pages/GroupsPage";
import { HomePage } from "@/pages/HomePage";
import { LegalPage } from "@/pages/LegalPage";
import { ListingPage } from "@/pages/ListingPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { MyListingsPage } from "@/pages/MyListingsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PropertyPage } from "@/pages/PropertyPage";
import { PublishWizardPage } from "@/pages/PublishWizardPage";
import { RegisterPage } from "@/pages/RegisterPage";
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
      { path: "propiedad/:id", element: <PropertyPage /> },
      { path: "publicar", element: <PublishWizardPage /> },
      { path: "mis-anuncios", element: <MyListingsPage /> },
      { path: "perfil", element: <ProfilePage /> },
      { path: "perfil/editar", element: <AccountEditPage /> },
      { path: "mensajes", element: <MessagesPage /> },
      { path: "contacto", element: <ContactPage /> },
      { path: "faq", element: <FaqPage /> },
      { path: "legal", element: <LegalPage /> },
      { path: "entrar", element: <SignInPage /> },
      { path: "registro", element: <RegisterPage /> },
      { path: "grupos", element: <GroupsPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
