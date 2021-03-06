# Folder Tunnels
This is designed to expose ("live stream") a directory over Cloudflare Workers using Websockets. The end user goes your auto generated URL (https://folder-tunnels.chaika.me/{Random-UUID}/) and will be served index.html (if no path) along with any other files requested that are within the directory you exposed. 

JavaScript is required for the creator of the live stream, but not for any requesting clients, as the Cloudflare Worker handles the websocket connection and requesting the file.

Note: Editing the served file and having it serve the new version on the next request only works on Firefox. On Chrome or Chromium based browsers, it just errors out.


Example Video:


https://user-images.githubusercontent.com/94197210/172295510-083bdc16-9c74-4656-8e5a-1e6b9ecabdcb.mp4



Simple Overview:

On the request of a file (folder-tunnels.chaika.me/3112d91e-1e3c-4f9c-9bb9-deb7f227c8c5/index.html), the Cloudflare Worker will first find the Durable Object by ID (3112d91e-1e3c-4f9c-9bb9-deb7f227c8c5) and then send a request over the Websocket for the file (/index.html).

The Cloudflare Durable Object uses a Map, with the Key being the random UUID and the value being a Promise. It awaits the promise with a timeout of 5000ms. If timeout is reached, it will just respond that the websocket connection timed out.

```json
{
"ID":"d69b25d0-4c47-40ec-a4cf-23561e2f6082",
"truePath":"/index.html",
"fullpath":"http://127.0.0.1:8787/3112d91e-1e3c-4f9c-9bb9-deb7f227c8c5/"
}
```
The host responds with the file data over the Websocket, back to the Cloudflare Worker
```json
{
    "ID":"d69b25d0-4c47-40ec-a4cf-23561e2f6082",
    "DATA":"This would be base64 encoded file data",
    "status":200
}
```
When the Cloudflare Worker recieves this data, it finds the promise from the map and resolves it with the incoming request. Then, that waiting request is returned the returned data, or if the status code is 404, then not found, or custom code 1002 returning no files have been shared yet.

Supports reconnecting, when the websocket connection is first established, a session secret is generated in the Durable Object and transferred to the client as a cookie. Automamatic Reconnection on failure is done by the client, and as long as they possess that session secret, they will be allowed to reconnect without needing to generate a new tunnel.




