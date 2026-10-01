/**
 * The Facebook JS SDK, loaded only when somebody actually starts connecting.
 *
 * Not in the document head: this is a third-party script that watches the page
 * it is on, and the overwhelming majority of visitors never open Embedded
 * Signup. It arrives on the first click and stays for the rest of the session.
 */

export type FacebookLoginResponse = {
  authResponse?: { code?: string } | null;
  status?: string;
};

type FacebookLoginOptions = {
  config_id: string;
  response_type: string;
  override_default_response_type: boolean;
  extras: { setup: Record<string, unknown>; sessionInfoVersion: string };
};

export type FacebookSdk = {
  init: (options: {
    appId: string;
    version: string;
    xfbml: boolean;
    cookie?: boolean;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: FacebookLoginOptions,
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SDK_ELEMENT_ID = "facebook-jssdk";

/** One load per page, shared by every caller that asks while it is in flight. */
let loading: Promise<FacebookSdk> | null = null;

export function loadFacebookSdk(
  appId: string,
  graphVersion: string,
): Promise<FacebookSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The Facebook SDK needs a browser."));
  }
  if (window.FB) {
    // Already loaded - re-init is cheap and keeps the version honest if the
    // backend's graph_version changed since the last call.
    window.FB.init({ appId, version: graphVersion, xfbml: false });
    return Promise.resolve(window.FB);
  }

  loading ??= new Promise<FacebookSdk>((resolve, reject) => {
    const settle = () => {
      const sdk = window.FB;
      if (!sdk) {
        loading = null;
        reject(new Error("The Facebook SDK could not start."));
        return;
      }
      sdk.init({ appId, version: graphVersion, xfbml: false });
      resolve(sdk);
    };

    const existing = document.getElementById(SDK_ELEMENT_ID);
    if (existing) {
      existing.addEventListener("load", settle, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SDK_ELEMENT_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = settle;
    script.onerror = () => {
      loading = null;
      script.remove();
      // A blocked script is the common case here, not a broken one: privacy
      // extensions and strict network policies both stop connect.facebook.net.
      reject(
        new Error(
          "Couldn't load Facebook. Check that your browser or network isn't blocking connect.facebook.net.",
        ),
      );
    };
    document.body.appendChild(script);
  });

  return loading;
}

/** Test seam: forget the in-flight load between cases. */
export function resetFacebookSdkForTests(): void {
  loading = null;
}
