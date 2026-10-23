"use client";

import { useEffect, useRef, useState } from "react";
import { authApi, ApiError, AuthUser } from "@obiren/api-client";

/**
 * Google Identity Services button.
 *
 * Renders only when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, so an
 * environment without a Google OAuth client shows nothing instead of a
 * button that cannot work. The ID token returned by Google is exchanged at
 * POST /auth/google, which verifies it server-side; no profile data is sent
 * from the browser.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number | boolean>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (user: AuthUser) => void;
  onError: (message: string) => void;
}

const SCRIPT_ID = "google-identity-services";

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Keep the latest callbacks without re-initialising Google on every render.
  const callbacks = useRef({ onSuccess, onError });
  useEffect(() => {
    callbacks.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        callbacks.current.onError("Google did not return a credential. Please try again.");
        return;
      }
      try {
        const result = await authApi.googleSignIn(response.credential);
        if ("mfaRequired" in result) {
          callbacks.current.onError(
            "This account uses two-factor authentication. Sign in with your email and password to complete the second step.",
          );
          return;
        }
        callbacks.current.onSuccess(result.user);
      } catch (err) {
        callbacks.current.onError(
          err instanceof ApiError ? err.message : "Unable to sign in with Google right now. Please try again.",
        );
      }
    };

    const render = () => {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
      setReady(true);
    };

    if (window.google) {
      render();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", () =>
      callbacks.current.onError("Google sign-in could not be loaded. Check your connection and try again."),
    );

    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
    };
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px flex-1 bg-[#E8DFFF]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">or</span>
        <span className="h-px flex-1 bg-[#E8DFFF]" />
      </div>
      <div ref={containerRef} className="flex justify-center min-h-[40px]" />
      {!ready && <p className="text-center text-xs text-[#666666]">Loading Google sign-in…</p>}
    </div>
  );
}
