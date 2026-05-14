import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backendProxy";

export async function PATCH(request: NextRequest) {
  return proxyBackendRequest(request, "/auth/profile");
}
