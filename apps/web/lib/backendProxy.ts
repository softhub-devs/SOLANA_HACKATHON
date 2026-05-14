import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

function getProxyTarget(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error("API_BASE_URL is not configured.");
  }

  return `${apiBaseUrl}${path}`;
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  return headers;
}

export async function proxyBackendRequest(
  request: NextRequest,
  path: string
) {
  const upstream = await fetch(getProxyTarget(path), {
    method: request.method,
    headers: buildProxyHeaders(request),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
    cache: "no-store",
  });

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
  });

  const contentType = upstream.headers.get("content-type");
  const setCookie = upstream.headers.get("set-cookie");

  if (contentType) {
    response.headers.set("content-type", contentType);
  }

  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
