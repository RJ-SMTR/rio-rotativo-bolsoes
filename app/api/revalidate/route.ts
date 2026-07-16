import { revalidatePath } from "next/cache";

export async function POST() {
  try {
    revalidatePath("/", "layout");
    return new Response(
      JSON.stringify({ 
        revalidated: true, 
        message: "Cache do bolsoes revalidado com sucesso" 
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ 
        error: "Erro ao revalidar",
        message: err instanceof Error ? err.message : "Desconhecido"
      }),
      { status: 500 }
    );
  }
}
