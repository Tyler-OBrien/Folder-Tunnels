# Easyshare

A fun project trying to create secure sharing between two parties. Created to provide a secure communication channel between a device like your phone, and a public PC, for sharing simple documents/data/etc.

Cloudflare Workers however appears to limit websocket messages to ~500KB, so the max file size is like ~350KB given base64 has an overhead of ~33.3%

Using libsodium.js for asymmetric encryption, html5-qrcode for QR code scanning, and qrcode for QR Code generation.

This is more of a proof of concept, some specific items like transferring large files in chunks would need to be done for this to be very usable.