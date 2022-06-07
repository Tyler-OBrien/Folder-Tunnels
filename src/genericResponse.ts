export function genericResponse(text: string, status: number, headers: {} = {}) {
    // Build a HTML response containing the text
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
      </head>
      <body>
          <p>${text}</p>
          <a href="/" target="_blank">Create your own directory stream</a>
      </body>
      </html>
    `;
  
    return new Response(html, {
      status: status,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
      ...headers
    });
  }