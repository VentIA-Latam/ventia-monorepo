/**
 * Facebook SDK utilities for WhatsApp Embedded Signup
 * Adapted from Chatwoot's whatsapp/utils.js
 */

declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FBLoginResponse) => void,
        options: FBLoginOptions
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface FBLoginResponse {
  authResponse?: {
    code: string;
  };
  error?: string;
}

interface FBLoginOptions {
  config_id: string;
  response_type: string;
  override_default_response_type: boolean;
  extras: {
    setup: Record<string, never>;
    featureType: string;
    sessionInfoVersion: string;
  };
}

export interface EmbeddedSignupData {
  type: string;
  event: string;
  data?: {
    business_id?: string;
    waba_id?: string;
    phone_number_id?: string;
  };
  error_message?: string;
}

export interface BusinessData {
  business_id: string;
  waba_id: string;
  phone_number_id?: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadFacebookSdk(): Promise<void> {
  return loadScript('https://connect.facebook.net/en_US/sdk.js');
}

export function initializeFacebook(appId: string, version: string): Promise<void> {
  return new Promise((resolve) => {
    const init = () => {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version,
      });
      resolve();
    };

    if (window.FB) {
      init();
    } else {
      window.fbAsyncInit = init;
    }
  });
}

export async function setupFacebookSdk(
  appId: string,
  apiVersion: string = 'v22.0'
): Promise<void> {
  await loadFacebookSdk();
  await initializeFacebook(appId, apiVersion);
}

export function initWhatsAppEmbeddedSignup(configId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          resolve(response.authResponse.code);
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          reject(new Error('Login cancelled'));
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
  });
}

export function isValidBusinessData(
  data: EmbeddedSignupData['data']
): data is BusinessData {
  return Boolean(data?.business_id && data?.waba_id);
}

export function createMessageHandler(
  onEmbeddedSignupData: (data: EmbeddedSignupData) => void
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    if (!event.origin.endsWith('facebook.com')) return;

    try {
      const data: EmbeddedSignupData =
        typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      if (data?.type === 'WA_EMBEDDED_SIGNUP') {
        onEmbeddedSignupData(data);
      }
    } catch {
      // Ignore non-JSON or irrelevant messages
    }
  };
}
