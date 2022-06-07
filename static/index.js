/* Directory / File Handling */

let picker = document.getElementById("picker");
let listing = document.getElementById("listing");
// array of loaded files
files = [];
// root path
rootPath = [];

// on items uploaded
// A bunch of magic just focused on finding the highest directory with files and making a list of all files
picker.addEventListener("change", (e) => {
  // First, we find the highest directory
  for (let file of Array.from(e.target.files)) {
    var pathSplit = file.webkitRelativePath.split("/");
    var pathOfItem = pathSplit.slice(0, -1);
    if (rootPath.length == 0) {
      rootPath = pathOfItem;
    }
    if (pathOfItem.length < rootPath.length) {
      rootPath = pathOfItem;
    }
  }
  // Clear list

  while (listing.firstChild) {
    listing.removeChild(listing.firstChild);
  }
  // Once we have found the highest directory, we just add the files to the display, and the array
  let indexFile = false;
  for (let file of Array.from(e.target.files)) {
    let simplePath = file.webkitRelativePath
      .split(rootPath.join("/"))
      .join("")
      .trimStart("/")
      .trim();
    let listitem = document.createElement("li");
    let anchoritem = document.createElement("a");
    // Clean up leading slash
    anchoritem.textContent = simplePath.replace("/", "") + " - 0 Requests";
    anchoritem.id = simplePath;
    listing.appendChild(listitem);
    listitem.appendChild(anchoritem);
    anchoritem.href = location.href + simplePath;
    anchoritem.target = "_blank";
    files.push(file);
    //file.text().then(x => console.log(x))
    if (simplePath == "/index.html") {
      indexFile = true;
    }
    flash_element(anchoritem);
  }
  if (indexFile == false) {
    document.getElementById("fileWarning").innerText =
      "Warning: No index.html found, you won't be able to view the site.";
    document.getElementById("viewWebsiteLink").style.display = "none";
  } else {
    document.getElementById("fileWarning").innerText = "";
    document.getElementById("viewWebsiteLink").style.display = "unset";
  }
  console.log("The root directory seems to be: " + rootPath.join("/"));
});

/* Websocket Handling */

async function websocket_onmessage(message) {
  // Parse the message, so we know where to look
  var request = JSON.parse(message.data);
  var path = request.truePath;
  var foundFile = files.find((file) => {
    // We remove the root path from the path, remove any leading slashes, and compare it.
    return (
      file.webkitRelativePath
        .split(rootPath.join("/"))
        .join("")
        .trimStart("/")
        .trim() == path.trim()
    );
  });
  // If we can't find the file, return that result.
  if (foundFile == undefined) {
    // No files have been shared
    if (files.length == 0) {
      console.log(
        "Handled Request, ID: " +
          request.ID +
          " Path: " +
          path +
          " responded with: no files have been shared, 1002"
      );
      websocket.send(
        JSON.stringify({
          ID: request.ID,
          DATA: null,
          status: 1002,
        })
      );
    } else {
      console.log(
        "Handled Request, ID: " +
          request.ID +
          " Path: " +
          path +
          " responded with: not found, 404"
      );
      websocket.send(
        JSON.stringify({
          ID: request.ID,
          DATA: null,
          status: 404,
        })
      );
    }
  } else {
    // Otherwise, fetch file info and return back
    // First we need to convert  to base64
    rawData = await foundFile.arrayBuffer();
    let output = "";
    new Uint8Array(await rawData).forEach((byte) => {
      output += String.fromCharCode(byte);
    });
    output = btoa(output);
    // Then we send it away
    console.log(
      "Handled Request, ID: " +
        request.ID +
        " Path: " +
        path +
        " responded with: Found file, 200"
    );
    websocket.send(
      JSON.stringify({
        ID: request.ID,
        DATA: output,
        status: 200,
      })
    );
    handle_request_stats(path);
  }
}

requestStats = new Map();

function handle_request_stats(path) {
  if (requestStats.has(path)) {
    requestStats.set(path, requestStats.get(path) + 1);
  } else {
    requestStats.set(path, 1);
  }
  let anchorListItem = document.getElementById(path);
  anchorListItem.innerText = `${path.replace("/", "")} - ${requestStats.get(
    path
  )} Requests`;
  flash_element(anchorListItem);
}

function flash_element(element) {
  if (
    element.classList.contains("flashAnimation") == false
  ) {
    element.classList.add("flashAnimation");
    setTimeout(() => {
      element.classList.remove("flashAnimation");
    }, 400);
  }
}

function websocket_onerror(err) {
  console.error("Socket encountered error: ", err.message, "Closing socket");
  websocket.close();
}

function websocket_onclose(closeEvent) {
  console.log(
    "Socket is closed. Will Attempt to reconnect.",
    closeEvent.reason
  );
  websocketLabel.innerText = "Disconnected";
}

function websocket_onopen(openEvent) {
  console.log("Socket is open.");
  websocketLabel.innerText = "Connected";
}

function isWebsocketConnected() {
  return websocket && websocket.readyState === websocket.OPEN;
}

function isWebsocketConnected() {
  return websocket && websocket.readyState === websocket.OPEN;
}

function check_connection() {
  // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
  if (
    websocket === null ||
    (websocket && websocket.readyState === websocket.CLOSED)
  ) {
    try {
      console.log("Trying to connect to websocket...");
      websocketLabel.innerText = "Connecting";
      websocket = new WebSocket(
        (window.location.protocol === "https:" ? "wss://" : "ws://") +
          window.location.host +
          window.location.pathname +
          "/websocket"
      );
      console.log("Websocket Status is: ", websocket.readyState);
      websocket_bind(websocket);
    } catch (err) {
      console.error(err);
      console.log("Error connecting to Websocket, will retry shortly...");
    }
  }
}

function websocket_bind(websocket) {
  websocket.onmessage = websocket_onmessage;
  websocket.onerror = websocket_onerror;
  websocket.onclose = websocket_onclose;
  websocket.onopen = websocket_onopen;
}

websocket = null;
websocketLabel = document.getElementById("websocketLabel");

// On first load, load up the websocket connection
check_connection();
// Then, every two seconds, check if the websocket is still open. If not, try to reconnect.
setInterval(check_connection, 2000);
