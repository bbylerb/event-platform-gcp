import { BigQuery } from '@google-cloud/bigquery';

// บน Cloud Run จะใช้ Application Default Credentials ของ service account อัตโนมัติ
// รันในเครื่อง: gcloud auth application-default login
const bigquery = new BigQuery(
  process.env.GCP_PROJECT_ID ? { projectId: process.env.GCP_PROJECT_ID } : undefined
);

const DATASET = process.env.BQ_DATASET || 'eventwise';

export function table(name) {
  return `\`${bigquery.projectId}.${DATASET}.${name}\``;
}

export async function query(sql, params) {
  const options = { query: sql };
  if (params) options.params = params;
  const [job] = await bigquery.createQueryJob(options);
  const [rows] = await job.getQueryResults();
  // BigQuery คืนค่า DATE/TIMESTAMP เป็น object {value} — แปลงเป็น string
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v && typeof v === 'object' && 'value' in v ? v.value : v;
    }
    return out;
  });
}
