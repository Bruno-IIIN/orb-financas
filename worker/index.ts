interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function extractText(response: any): string {
  if (typeof response?.output_text === "string") {
    return response.output_text;
  }

  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;

    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && content?.text) {
        return content.text;
      }
    }
  }

  return "Não consegui produzir uma resposta agora.";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/chat") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!env.OPENAI_API_KEY) {
      return json(
        { error: "OPENAI_API_KEY não configurada." },
        500
      );
    }

    try {
      const body = await request.json<any>();
      const message = String(body?.message ?? "").trim();

      if (!message) {
        return json({ error: "Mensagem vazia." }, 400);
      }

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: env.OPENAI_MODEL || "gpt-6-luna",

            instructions: `
Você é Orbe, um agente financeiro pessoal brasileiro.

Seu estilo:
- elegante
- direto
- amigável
- objetivo
- responda sempre em português do Brasil
- valores monetários em reais quando apropriado

Você ajuda o usuário a entender gastos, cartões, orçamento,
parcelamentos, metas e decisões financeiras.

Esta é a versão inicial do produto.
Ainda não existe persistência bancária definitiva nesta versão.

Se o usuário pedir para registrar um gasto ou cartão, confirme
que entendeu as informações e explique de forma curta o que
seria registrado.

Nunca invente saldos, cartões ou transações que o usuário
não informou.
            `.trim(),

            input: message,
            max_output_tokens: 500
          })
        }
      );

      if (!openaiResponse.ok) {
        const error = await openaiResponse.text();
        console.error(error);

        return json(
          { error: "Falha ao conversar com a Orbe." },
          502
        );
      }

      const result = await openaiResponse.json();

      return json({
        reply: extractText(result)
      });
    } catch (error) {
      console.error(error);

      return json(
        { error: "Erro interno." },
        500
      );
    }
  }
};