import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShellLayout } from "@/layouts/AppShellLayout";
import { HomePage } from "@/pages/HomePage";
import { ListingPage } from "@/pages/ListingPage";
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
      { path: "entrar", element: <SignInPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
