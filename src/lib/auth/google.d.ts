// Minimal shape of the Google Identity Services global this app relies on.
// https://developers.google.com/identity/gsi/web/reference/js-reference
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          prompt(): void;
        };
      };
    };
  }
}
