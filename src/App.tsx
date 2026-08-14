import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AccountTabsLayout } from "@/layouts/AccountTabsLayout";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { AccountEditPage } from "@/pages/AccountEditPage";
import { AdminPage } from "@/pages/AdminPage";
import { ContactPage } from "@/pages/ContactPage";
import { FaqPage } from "@/pages/FaqPage";
import { HomePage } from "@/pages/HomePage";
import { GuadalajaraLandingPage } from "@/pages/GuadalajaraLandingPage";
import { LegalPage } from "@/pages/LegalPage";
import { TermsPage } from "@/pages/legal/TermsPage";
import { PrivacyPage } from "@/pages/legal/PrivacyPage";
import { ListingPage } from "@/pages/ListingPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { MyListingsPage } from "@/pages/MyListingsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { NosotrosPage } from "@/pages/NosotrosPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PostExperienceMockupsPage } from "@/pages/PostExperienceMockupsPage";
import { MyListingsProposalMockupsPage } from "@/pages/MyListingsProposalMockupsPage";
import { PropertyPage } from "@/pages/PropertyPage";
import { PublishPreviewPage } from "@/pages/PublishPreviewPage";
import { PublishWizardPage } from "@/pages/PublishWizardPage";
import { AssistedDraftClaimPage } from "@/pages/AssistedDraftClaimPage";
import { EmailVerifyPage } from "@/pages/EmailVerifyPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SavedSearchesPage } from "@/pages/SavedSearchesPage";
import { SearchPage } from "@/pages/SearchPage";
import { PostLoginRedirectPage } from "@/pages/PostLoginRedirectPage";
import { SignInPage } from "@/pages/SignInPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "guadalajara", element: <GuadalajaraLandingPage /> },
      { path: "gdl", element: <Navigate to="/guadalajara" replace /> },
      { path: "buscar", element: <SearchPage /> },
      { path: "buscar/:cityCode", element: <SearchPage /> },
      { path: "anuncio/:id", element: <ListingPage /> },
      { path: "propiedad/:id", element: <PropertyPage /> },
      { path: "publicar", element: <PublishWizardPage /> },
      { path: "publicar/vista-previa", element: <PublishPreviewPage /> },
      { path: "borrador/:token", element: <AssistedDraftClaimPage /> },
      { path: "mockups/post-proposals", element: <PostExperienceMockupsPage /> },
      { path: "mockups/mis-anuncios-proposal", element: <MyListingsProposalMockupsPage /> },
      {
        element: <AccountTabsLayout />,
        children: [
          { path: "mis-anuncios", element: <MyListingsPage /> },
          { path: "mis-busquedas", element: <SavedSearchesPage /> },
          { path: "mensajes", element: <MessagesPage /> },
          { path: "contacto", element: <ContactPage /> },
          { path: "perfil", element: <ProfilePage /> },
          { path: "perfil/editar", element: <AccountEditPage /> },
        ],
      },
      { path: "despues-de-entrar", element: <PostLoginRedirectPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "notificaciones", element: <Navigate to="/notifications" replace /> },
      { path: "faq", element: <FaqPage /> },
      { path: "nosotros", element: <NosotrosPage /> },
      { path: "legal", element: <LegalPage /> },
      { path: "legal/terminos", element: <TermsPage /> },
      { path: "legal/privacidad", element: <PrivacyPage /> },
      { path: "entrar", element: <SignInPage /> },
      { path: "recuperar-contrasena", element: <ForgotPasswordPage /> },
      { path: "registro", element: <RegisterPage /> },
      { path: "verificar-correo", element: <EmailVerifyPage /> },
      { path: "grupos", element: <Navigate to="/" replace /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
