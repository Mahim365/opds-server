export default function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  res.setHeader('Content-Type', 'application/opensearchdescription+xml; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Book Search</ShortName>
  <Description>Search Anna's Archive and Z-Library</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="application/atom+xml;profile=opds-catalog;kind=acquisition" template="${baseUrl}/opds?q={searchTerms}&amp;source=all"/>
</OpenSearchDescription>`);
}
