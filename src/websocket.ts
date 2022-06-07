import index_html from "../static/index.html";

import { genericResponse } from "./genericResponse";

export class Websocket implements DurableObject {
  session: WebSocket | undefined;
  sessionKey: string | undefined;
  // This needs to be cleaned up later. It would be nice if Durable Object Storage supported TTLs like KV does, that would fit a lot better.
  // ID is UUID of request, Key is base64 of response
  pendingReplies: Map<string, Function>;
  // Store this.state for later access
  constructor(private readonly state: DurableObjectState) {
    this.session = undefined;
    this.sessionKey = undefined;
    this.pendingReplies = new Map();
  }

  async fetch(request: Request) {
    const { pathname, origin } = new URL(request.url);
    const match = /\/(?<uuid>[^\/]+)(?<path>.*)/.exec(pathname);
    if (!match?.groups) {
      console.log("No match");
      return Response.redirect(`${origin}`, 302);
    }
    const UUID = match.groups.uuid;

    const truePath = match.groups.path ?? "";
    const isApex = truePath == "";

    if (
      this.session === undefined &&
      (this.sessionKey === undefined ||
        this.sessionKey === this.getSessionCookie(request))
    ) {
      if (truePath === "/websocket") {
        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader !== "websocket") {
          return new Response("Expected websocket", { status: 400 });
        }
        const [client, server] = Object.values(new WebSocketPair());
        await this.handleSession(server);
        var SessionKey = crypto.randomUUID().replaceAll("-", "");
        this.sessionKey = SessionKey;
        return new Response(null, {
          status: 101,
          webSocket: client,
          headers: {
            "Set-Cookie": `session=${SessionKey}`,
          },
        });
      }
      if (isApex) {
        return new Response(index_html, {
          headers: { "content-type": "text/html" },
        });
      }
    }

    if (isApex && truePath != "/") {
      return Response.redirect(`${origin}/${UUID}/`, 302);
    } else {
      if (this.session === undefined) {
        return genericResponse("Not Setup to Answer Requests Yet", 503);
      }
      return this.tryGetAsset(request, truePath);
    }
  }

  // This requests for the file from the client
  // It sends the request over Websocket, and then waits for a response from the client, by waiting for the promise to be resolved. There is also a timeout of 5000ms.
  async tryGetAsset(request: Request, truePath: string) {
    // Random Request UUID
    var requestID = crypto.randomUUID();
    if (truePath?.trim() === "/") {
      truePath = "/index.html";
    }
    try {
      this.session.send(
        JSON.stringify({
          ID: requestID,
          truePath: truePath,
          fullpath: request.url,
        })
      );
    } catch (error) {
      console.log("Websocket Error");
      console.error(error);
      this.session = undefined;
      return genericResponse(
        "It looks like this session is no longer active",
        404
      );
    }

    const responsePromise = new Promise<ClientFileResponse>((resolve) => {
      this.pendingReplies.set(requestID, resolve);
    });
    const response = await this.PromiseTimeout(responsePromise, 5000);
    if (response === undefined) {
      // Clean up map
      this.pendingReplies.delete(requestID);
      return genericResponse("Request timed out", 503);
    }
    let foundResponse = response as ClientFileResponse;

    if (foundResponse.status == 1002) {
      return genericResponse(
        "1002 - The sender has not selected a folder to stream yet, or selected an empty folder.",
        404
      );
    }
    if (foundResponse.status == 404) {
      return genericResponse(
        "404 - Could not find file - Double check your directories",
        404
      );
    }
    // Just a little hacky...
    let asciiString = atob(foundResponse.DATA);
    let dataBuffer = new Uint8Array(
      [...asciiString].map((char) => char.charCodeAt(0))
    );
    return new Response(dataBuffer);
  }

  getSessionCookie(request: Request) {
    const cookies = request.headers.get("cookie");
    if (cookies === undefined || cookies === null) {
      return undefined;
    }
    const cookieArray = cookies.split(";");
    const sessionCookie = cookieArray.find((cookie) =>
      cookie.startsWith("session=")
    );
    if (sessionCookie === undefined) {
      return undefined;
    }
    return sessionCookie.split("=")[1];
  }

  PromiseTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> | Promise<any> {
    let timer: number;
    return Promise.race([
      promise,
      new Promise((_r, rej) => (timer = setTimeout(rej, timeout))),
    ]).finally(() => clearTimeout(timer));
  }

  async handleSession(websocket: WebSocket) {
    websocket.accept();
    this.session = websocket;
    websocket.addEventListener("message", async (message) => {
      var reply = JSON.parse(message.data) as ClientFileResponse;
      if (this.pendingReplies.has(reply.ID)) {
        this.pendingReplies.get(reply.ID)(reply);
        this.pendingReplies.delete(reply.ID);
      }
    });

    websocket.addEventListener("close", async (evt) => {
      // Handle when a client closes the WebSocket connection
      console.log("Closing Websocket....");
      console.log(evt);
      this.session = undefined;
    });
    websocket.addEventListener("error", async (evt) => {
      console.log("Error in handle Session");
      console.log(evt);
      this.session = undefined;
    });
  }
}

export interface ClientFileResponse {
  ID: string;
  DATA: string;
  status: number;
}
