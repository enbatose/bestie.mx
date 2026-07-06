import { Link } from "react-router-dom";

const linkClass = "text-primary underline underline-offset-2 hover:brightness-110";

export function PublishReviewDisclaimer() {
  return (
    <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted">
      Al publicar, confirmas que la información proporcionada es veraz y asumes la responsabilidad sobre las
      condiciones del espacio. Consulta nuestros{" "}
      <Link to="/legal" className={linkClass}>
        Términos y Condiciones
      </Link>{" "}
      y la{" "}
      <Link to="/legal" className={linkClass}>
        Política de Privacidad
      </Link>{" "}
      para más detalles.
    </p>
  );
}
