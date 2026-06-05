import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth0";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Opened in a new tab from the dashboard. Runs server-side with the Auth0
// session, fetches the signed Instagram authorize URL from the backend and
// 302-redirects the tab to Instagram's consent screen.
export async function GET(request: Request) {
  const dashboardUrl = new URL("/dashboard/instagram-connect", request.url);

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      dashboardUrl.searchParams.set("status", "error");
      dashboardUrl.searchParams.set("reason", "not_authenticated");
      return NextResponse.redirect(dashboardUrl);
    }

    const response = await fetch(`${API_URL}/messaging/instagram/authorize`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      dashboardUrl.searchParams.set("status", "error");
      dashboardUrl.searchParams.set("reason", "authorize_failed");
      return NextResponse.redirect(dashboardUrl);
    }

    const json = await response.json();
    const authorizeUrl = json?.data?.authorize_url;
    if (!authorizeUrl) {
      dashboardUrl.searchParams.set("status", "error");
      dashboardUrl.searchParams.set("reason", "no_authorize_url");
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("Error starting Instagram consent:", error);
    dashboardUrl.searchParams.set("status", "error");
    dashboardUrl.searchParams.set("reason", "unexpected");
    return NextResponse.redirect(dashboardUrl);
  }
}
