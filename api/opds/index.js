export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const baseUrl = `${proto}://${host}`;
  
  // Vercel standardizes the URL differently than raw Node, so we parse it safely
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

// --- Helper Functions ---

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function now() { return new Date().toISOString(); }

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; OPDS-Catalog/1.0)', 
      'Accept': 'application/json, text/html, */*' 
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.text();
}

function rootCatalog(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:opds-catalog:root</id>
  <title>Free Books OPDS Catalog</title>
  <updated>${now()}</updated>
  <link rel="self" href="${baseUrl}/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${baseUrl}/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" href="${baseUrl}/api/opds/search.xml" type="application/opensearchdescription+xml" title="Search Free Books"/>
  <entry>
    <title>Search Anna's Archive</title>
    <id>urn:opds:annas-archive</id>
    <updated>${now()}</updated>
    <content type="text">Search millions of books on Anna's Archive</content>
    <link rel="subsection" href="${baseUrl}/api/opds?source=annas&amp;q=fiction" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>
  <entry>
    <title>Search Z-Library</title>
    <id>urn:opds:zlibrary</id>
    <updated>${now()}</updated>
    <content type="text">Search Z-Library's collection</content>
    <link rel="subsection" href="${baseUrl}/api/opds?source=zlib&amp;q=science" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>
  <entry>
    <title>Search All Sources</title>
    <id>urn:opds:all</id>
    <updated>${now()}</updated>
    <content type="text">Search both sources at once</content>
    <link rel="subsection" href="${baseUrl}/api/opds?source=all&amp;q=textbook" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
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
  } catch (e) { 
    console.error('Annas error:', e.message); 
    return []; 
  }
}

async function searchZLibrary(query) {
  try {
    const mirrors = [
      `https://z-library.sk/s/${encodeURIComponent(query)}/?extension[]=epub&extension[]=pdf`,
      `https://z-lib.id/s/${encodeURIComponent(query)}/`
    ];
    let body = '';
    for (const url of mirrors) {
      try { 
        const resText = await fetchUrl(url); 
        if (resText.length > 1000) { body = resText; break; } 
      } catch (e) { continue; }
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
  } catch (e) { 
    console.error('ZLib error:', e.message); 
    return []; 
  }
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
    <link rel="http://opds-spec.org/acquisition" href="${esc(b.downloadUrl)}" type="${mime}"/>
    <link rel="alternate" href="${esc(b.downloadUrl)}" type="text/html"/>
  </entry>`;
  }).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:opds:search:${esc(query)}</id>
  <title>Results for "${esc(query)}" — ${esc(label)}</title>
  <updated>${now()}</updated>
  <link rel="start" href="${baseUrl}/api/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  ${books.length === 0 ? '<entry><title>No results found</title><id>urn:noresults</id><updated>' + now() + '</updated><content type="text">Try a different search term.</content></entry>' : entries}
</feed>`;
}
