import privacy from '../../../../Backend/auth-service/internal/auth/legal_documents/privacy.json';
import personalData from '../../../../Backend/auth-service/internal/auth/legal_documents/personal_data.json';
import marketing from '../../../../Backend/auth-service/internal/auth/legal_documents/marketing.json';

// The frontend and backend consume the same approved editions. Public legal
// content must remain available when the authentication API is unavailable.
const documents = [privacy, personalData, marketing];

export function useLegalDocuments() {
  return {documents, error: '', retry: () => {}};
}
