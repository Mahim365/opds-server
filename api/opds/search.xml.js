export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const baseUrl = `${proto}://${host}`;
  
  res.setHeader('Content-Type', 'application/opensearchdescription+xml; charset=utf-8');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Free Books</ShortName>
  <Description>Search Anna's Archive and Z-Library</Description>
  <Url type="application/atom+xml;profile=opds-catalog;kind=acquisition"
       template="${baseUrl}/api/opds?q={searchTerms}&amp;source=all"/>
</OpenSearchDescription>`);
}
