export default function handler(req, res) {
  // 1. Force the strict OPDS Content-Type header with UTF-8 encoding
  res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
  
  // 2. Set permissive CORS headers directly within the function response as a backup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS requests smoothly
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Dynamically capture your absolute server domain URL
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  // 4. Generate the fully valid, standard-compliant OPDS Atom XML structure
  const xmlFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" 
      xmlns:dc="http://purl.org/dc/elements/1.1/" 
      xmlns:opds="http://opds-spec.org/2010/catalog">

  <id>urn:uuid:opds-server-root</id>
  <title>My Personal OPDS Book Catalog</title>
  <updated>${new Date().toISOString()}</updated>
  <icon>/favicon.ico</icon>
  
  <link rel="self" 
        href="${baseUrl}/opds" 
        type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" 
        href="${baseUrl}/opds" 
        type="application/atom+xml;profile=opds-catalog;kind=navigation"/>

  <entry>
    <title>Sample Book Title</title>
    <id>urn:uuid:sample-book-1</id>
    <dc:identifier>urn:isbn:1234567890</dc:identifier>
    <updated>${new Date().toISOString()}</updated>
    <dc:creator>Author Name</dc:creator>
    <dc:language>en</dc:language>
    <content type="text">A brief description or synopsis of your awesome ebook goes right here.</content>
    
    <link rel="http://opds-spec.org/image" 
          href="https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400" 
          type="image/jpeg"/>
    <link rel="http://opds-spec.org/image/thumbnail" 
          href="https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100" 
          type="image/jpeg"/>
          
    <link rel="http://opds-spec.org/acquisition" 
          href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" 
          type="application/pdf" 
          title="Download PDF"/>
  </entry>

</feed>`;

  // 5. Send the raw XML text string back to Readest with a 200 OK status
  res.status(200).send(xmlFeed);
}
