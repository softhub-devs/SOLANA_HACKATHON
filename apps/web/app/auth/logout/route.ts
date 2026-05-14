import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backendProxy";

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, "/auth/logout");
}
