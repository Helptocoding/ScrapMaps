import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { GeoapifyError } from "@/lib/geoapify/client";

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Solicitud invalida." }, { status: 400 });
  }

  if (error instanceof GeoapifyError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Ocurrio un error inesperado." }, { status: 500 });
}
