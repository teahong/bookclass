const ALADIN_SEARCH_URL = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const query = new URLSearchParams();
  const ttbkey = process.env.ALADIN_API_KEY || process.env.VITE_ALADIN_API_KEY || req.query.ttbkey;

  if (!ttbkey) {
    return res.status(500).json({ error: 'Aladin API key is not configured.' });
  }

  query.set('ttbkey', ttbkey);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'ttbkey' || value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else {
      query.set(key, value);
    }
  }

  try {
    const response = await fetch(`${ALADIN_SEARCH_URL}?${query.toString()}`);
    const body = await response.text();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(response.status).send(body);
  } catch (error) {
    console.error('Aladin proxy request failed:', error);
    return res.status(502).json({ error: 'Failed to fetch from Aladin API.' });
  }
}
