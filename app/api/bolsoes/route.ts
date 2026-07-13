import { BigQuery } from "@google-cloud/bigquery";
import { unstable_cache } from "next/cache";

const CACHE_TTL_SECONDS = 86400;

const BOLSOES_QUERY = `
  SELECT
    ae.nome,
    ae.logradouro,
    ANY_VALUE(ST_ASGEOJSON(ae.geometry)) AS geometry,
    ae.quantidade_vaga_total,
    ae.quantidade_vaga_idoso,
    ae.quantidade_vaga_pcd,
    ae.quantidade_vaga_moto,
    ae.tempo_permanencia_hora,
    ARRAY_AGG(DISTINCT pf.nome IGNORE NULLS) AS perfis_funcionamento
  FROM \`rj-smtr-dev.riorotativo.area_estacionamento\` ae
  INNER JOIN \`rj-smtr-dev.riorotativo.perfil_funcionamento\` pf
    ON pf.id_perfil_funcionamento IN UNNEST(ae.id_perfil_funcionamento)
  GROUP BY
    ae.nome,
    ae.logradouro,
    ae.quantidade_vaga_total,
    ae.quantidade_vaga_idoso,
    ae.quantidade_vaga_pcd,
    ae.quantidade_vaga_moto,
    ae.tempo_permanencia_hora
  LIMIT 1000
`;

type BigQueryRow = {
  nome: string;
  logradouro: string | null;
  geometry: string;
  quantidade_vaga_total: number | null;
  quantidade_vaga_idoso: number | null;
  quantidade_vaga_pcd: number | null;
  quantidade_vaga_moto: number | null;
  tempo_permanencia_hora: number | null;
  perfis_funcionamento?: string[] | null;
};

function getCredentials() {
  const serviceAccountJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as {
      client_email?: string;
      private_key?: string;
    };

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }

  const googleClientApiJson = process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL
    ? {
        type: process.env.GOOGLE_CLIENT_API_TYPE,
        project_id: process.env.GOOGLE_CLIENT_API_PROJECT_ID,
        private_key_id: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_CLIENT_API_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_API_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_API_CLIENT_ID,
        auth_uri: process.env.GOOGLE_CLIENT_API_AUTH_URI,
        token_uri: process.env.GOOGLE_CLIENT_API_TOKEN_URI,
        auth_provider_x509_cert_url:
          process.env.GOOGLE_CLIENT_API_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLIENT_API_CLIENT_X509_CERT_URL,
        universe_domain: process.env.GOOGLE_CLIENT_API_UNIVERSE_DOMAIN,
      }
    : null;

  if (googleClientApiJson?.client_email && googleClientApiJson?.private_key) {
    return {
      client_email: googleClientApiJson.client_email,
      private_key: googleClientApiJson.private_key,
    };
  }

  return {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

function getBigQueryClient() {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.GOOGLE_CLIENT_API_PROJECT_ID;
  const credentials = getCredentials();

  if (!projectId || !credentials.client_email || !credentials.private_key) {
    throw new Error(
      "Configure GOOGLE_CLOUD_PROJECT_ID e as credenciais da service account do Google"
    );
  }

  return new BigQuery({
    projectId,
    credentials,
  });
}

const getBolsoes = unstable_cache(
  async () => {
    const bigQuery = getBigQueryClient();

    const [job] = await bigQuery.createQueryJob({
      query: BOLSOES_QUERY,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "US",
    });

    const [rows] = await job.getQueryResults();

    return {
      type: "FeatureCollection",
      features: (rows as BigQueryRow[]).map((row) => ({
        type: "Feature",
        geometry: JSON.parse(row.geometry),
        properties: {
          name: row.nome,
          logradouro: row.logradouro,
          quantidade_vaga_total: row.quantidade_vaga_total,
          quantidade_vaga_idoso: row.quantidade_vaga_idoso,
          quantidade_vaga_pcd: row.quantidade_vaga_pcd,
          quantidade_vaga_moto: row.quantidade_vaga_moto,
          tempo_permanencia_hora: row.tempo_permanencia_hora,
          perfis_funcionamento: row.perfis_funcionamento ?? [],
          description: null,
        },
      })),
    };
  },
  ["bolsoes-bigquery"],
  {
    revalidate: CACHE_TTL_SECONDS,
    tags: ["bolsoes"],
  }
);

export async function GET() {
  try {
    const json = await getBolsoes();

    return Response.json(json, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar BigQuery";
    return Response.json({ error: message }, { status: 500 });
  }
}
