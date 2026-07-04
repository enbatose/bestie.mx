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
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PostExperienceMockupsPage } from "@/pages/PostExperienceMockupsPage";
import { PropertyPage } from "@/pages/PropertyPage";
import { PublishPreviewPage } from "@/pages/PublishPreviewPage";
import { PublishWizardPage } from "@/pages/PublishWizardPage";
import { EmailVerifyPage } from "@/pages/EmailVerifyPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SavedSearchesPage } from "@/pages/SavedSearchesPage";
import { SearchPage } from "@/pages/SearchPage";
import { SignInPage } from "@/pages/SignInPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "buscar", element: <SearchPage /> },
      { path: "buscar/:cityCode", element: <SearchPage /> },
      { path: "anuncio/:id", element: <ListingPage /> },
      { path: "propiedad/:id", element: <PropertyPage /> },
      { path: "publicar", element: <PublishWizardPage /> },
      { path: "publicar/vista-previa", element: <PublishPreviewPage /> },
      { path: "mockups/post-proposals", element: <PostExperienceMockupsPage /> },
      { path: "mis-anuncios", element: <MyListingsPage /> },
      { path: "mis-busquedas", element: <SavedSearchesPage /> },
      { path: "perfil", element: <ProfilePage /> },
      { path: "perfil/editar", element: <AccountEditPage /> },
      { path: "mensajes", element: <MessagesPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "contacto", element: <ContactPage /> },
      { path: "faq", element: <FaqPage /> },
      { path: "legal", element: <LegalPage /> },
      { path: "entrar", element: <SignInPage /> },
      { path: "registro", element: <RegisterPage /> },
      { path: "verificar-correo", element: <EmailVerifyPage /> },
      { path: "grupos", element: <GroupsPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
