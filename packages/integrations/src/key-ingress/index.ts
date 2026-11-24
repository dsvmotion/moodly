// El alta de la clave de una integración con clave del cliente (ADR 0055): el
// sobre que cifra la web y que abre el worker. Subruta propia para que la web
// no cargue el resto de la capa de integraciones.
export {
  SUBMITTED_KEY_MAX,
  SUBMITTED_KEY_MIN,
  SubmissionRejectedError,
  createLocalIngressKeyring,
  isAcceptableSubmittedKey,
  openSubmission,
  sealSubmission,
  submissionAad,
} from "./sealed-key.js";
export type { IngressKeyring, IngressPublicKey, SealedSubmission, SubmissionContext } from "./sealed-key.js";
