import index_css from "../static/index.css";
import index_js from "../static/index.js";

export async function handleRequest(request: Request, env: Bindings) {
  // Match route against pattern /:name/*action
  const url = new URL(request.url);

  if (url.pathname === "/index.css") {
    return new Response(index_css, { headers: { "content-type": "text/css" } });
  } else if (url.pathname === "/index.js") {
    return new Response(index_js, {
      headers: { "content-type": "text/javascript" },
    });
  }

  const match = /\/(?<name>[^/]+)(?<action>.*)/.exec(url.pathname);
  if (!match?.groups) {
    // Give a random tunnel/socket uuid if not specified
    
    return Response.redirect(`${url.origin}/${crypto.randomUUID()}`, 302);
  }

  // Forward the request to the named Durable Object...
  const { WEBSOCKET } = env;
  const id = WEBSOCKET.idFromName(match.groups.name);
  const stub = WEBSOCKET.get(id);
  url.pathname = match.groups.action;
  return stub.fetch(request);
}

const worker: ExportedHandler<Bindings> = { fetch: handleRequest };

// Make sure we export the Counter Durable Object class
export { Websocket } from "./websocket";
export default worker;
