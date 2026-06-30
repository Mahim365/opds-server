export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const url = new URL(req.url, `http://${host}`);
  const query = url.searchParams.get('q') || '';
  const source = url.searchParams.get('source') || 'all';

  if (!query) { 
    res.status(200).send(rootCatalog(baseUrl)); 
    return; 
  }

  try {
    let books = [];
    if (source === 'annas') books = await searchAnnasArchive(query);
    else if (source === 'zlib') books = await searchZLibrary(query);
    else {
      const [a, z] = await Promise.allSettled([searchAnnasArchive(query), searchZLibrary(query)]);
      if (a.status === 'fulfilled') books.push(...a.value);
      if (z.status === 'fulfilled') books.push(...z.value);
    }
    res.status(200).send(buildFeed(books, query, source, baseUrl));
  } catch (e) {
    res.status(500).send(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Error</title><entry><title>${esc(e.message)}</title><id>urn:error</id><updated>${now()}</updated></entry></feed>`);
  }
}

// --- HELPER FUNCTIONS ---

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function now() { return new Date().toISOString(); }

async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
        'Accept': 'text/html,application/xhtml+xml' 
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return '';
    return await response.text();
  } catch (e) { return ''; }
}

function rootCatalog(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:opds-catalog:root</id>
  <title>Free Books Library</title>
  <updated>${now()}</updated>
  <link rel="self" href="${baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <!-- THIS ENABLES THE SEARCH BAR IN READEST -->
  <link rel="search" href="${baseUrl}/search.xml" type="application/opensearchdescription+xml" title="Search Books"/>
  
  <entry>
    <title>Search Anna's Archive</title>
    <id>urn:opds:annas-archive</id>
    <updated>${now()}</updated>
    <content type="text">Search millions of books on Anna's Archive</content>
    <link rel="subsection" href="${baseUrl}/opds?source=annas&amp;q=fiction" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>
  
  <entry>
    <title>Search Z-Library</title>
    <id>urn:opds:zlibrary</id>
    <updated>${now()}</updated>
    <content type="text">Search Z-Library's collection</content>
    <link rel="subsection" href="${baseUrl}/opds?source=zlib&amp;q=science" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>
</feed>`;
}

async function searchAnnasArchive(query) {
  try {
    const url = `https://annas-archive.org/search?q=${encodeURIComponent(query)}&ext=epub&ext=pdf`;
    const body = await fetchUrl(url);
    const books = [];
    const blockRegex = /href="(\/md5\/[a-f0-9]{32})"[\s\S]*?(?=href="\/md5\/|<\/main>)/g;
    let match;
    const seen = new Set();
    
    while ((match = blockRegex.exec(body)) !== null && books.length < 15) {
      const md5 = match[1].replace('/md5/', '');
      if (seen.has(md5)) continue;
      seen.add(md5);
      const block = match[0].substring(0, 800);
      let title = '';
      const tMatch = block.match(/class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || block.match(/font-bold[^>]*>([\s\S]*?)<\//i);
      if (tMatch) title = tMatch[1].replace(/<[^>]+>/g, '').trim();
      if (!title || title.length < 2) title = `Book ${md5.substring(0, 8)}`;
      let author = 'Unknown';
      const aMatch = block.match(/italic[^>]*>([\s\S]*?)<\//i);
      if (aMatch) author = aMatch[1].replace(/<[^>]+>/g, '').trim();
      let format = block.toLowerCase().includes('pdf') ? 'pdf' : 'epub';
      books.push({ id: md5, title: title.substring(0, 120), author, format, downloadUrl: `https://annas-archive.org/md5/${md5}`, source: "Anna's Archive" });
    }
    return books;
  } catch (e) { return []; }
}

async function searchZLibrary(query) {
  try {
    const mirrors = [
      `https://z-library.sk/s/${encodeURIComponent(query)}/?extension[]=epub&extension[]=pdf`,
      `https://z-lib.id/s/${encodeURIComponent(query)}/`
    ];
    let body = '';
    for (const url of mirrors) {
      const resText = await fetchUrl(url); 
      if (resText.length > 1000) { body = resText; break; } 
    }
    if (!body) return [];
    
    const books = [];
    const bookIdRegex = /href="\/book\/(\d+)\/([a-z0-9]+)\/?"/gi;
    const seen = new Set();
    let match;
    
    while ((match = bookIdRegex.exec(body)) !== null && books.length < 12) {
      const bookId = match[1];
      if (seen.has(bookId)) continue;
      seen.add(bookId);
      const block = body.substring(Math.max(0, match.index - 200), match.index + 400);
      let title = '';
      const tMatch = block.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/(?:h2|h3|div|a)>/i) || block.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
      if (tMatch) title = tMatch[1].replace(/<[^>]+>/g, '').trim();
      if (!title || title.length < 2) title = `${query} - Book ${bookId}`;
      let author = 'Unknown';
      const aMatch = block.match(/author[^>]*>([\s\S]*?)<\//i);
      if (aMatch) author = aMatch[1].replace(/<[^>]+>/g, '').trim();
      books.push({ id: `zlib-${bookId}`, title: title.substring(0, 120), author, format: 'epub', downloadUrl: `https://z-library.sk/book/${bookId}/${match[2]}/`, source: 'Z-Library' });
    }
    return books;
  } catch (e) { return []; }
}

function buildFeed(books, query, source, baseUrl) {
  const label = source === 'annas' ? "Anna's Archive" : source === 'zlib' ? 'Z-Library' : 'All Sources';
  const entries = books.map(b => {
    const mime = b.format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    return `<entry>
    <title>${esc(b.title)}</title>
    <id>urn:opds:${esc(b.id)}</id>
    <updated>${now()}</updated>
    <author><name>${esc(b.author)}</name></author>
    <content type="text">Source: ${esc(b.source)} | Format: ${b.format.toUpperCase()}</content>
    <link rel="http://opds-spec.org/acquisition" href="${esc(b.downloadUrl)}" type="${mime}" title="Download ${b.format.toUpperCase()}"/>
  </entry>`;
  }).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:opds:search:${esc(query)}</id>
  <title>Results for "${esc(query)}" — ${esc(label)}</title>
  <updated>${now()}</updated>
  <link rel="start" href="${baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" href="${baseUrl}/search.xml" type="application/opensearchdescription+xml" title="Search Books"/>
  ${books.length === 0 ? '<entry><title>No results found</title><id>urn:noresults</id><updated>' + now() + '</updated><content type="text">Try a different search term.</content></entry>' : entries}
</feed>`;
}
