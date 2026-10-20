const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}let relative=pathname.replace(/^\/a\/chart\/?/,'/');if(relative.endsWith('/'))relative+='index.html';const file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});});
server.listen(3000,'0.0.0.0',()=>console.log('YOHAKU Local: http://localhost:3000'));
