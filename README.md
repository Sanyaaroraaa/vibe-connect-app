# Connect. ⚡

A real-time campus social connection app built with React, Vite, and Firebase. Connect allows users to signal "Vibes" and match with nearby peers instantly.

## 🚀 Key Features

* **Synchronized Handshake:** A custom presence system that freezes the 15-minute mission timer until both users are physically active in the chat room.
* **Snapchat-Style Media:** Secure "Burning Photos" with custom SVG circular countdown loaders and automated deletion.
* **GPS Verification:** Real-time distance calculation to ensure users only connect within a safe radius.
* **Secure Infrastructure:** Fully protected with Firebase Security Rules and environment-based configuration.

## 🛠️ Tech Stack
* **Frontend:** React.js, Vite, Bootstrap
* **Backend:** Firebase (Firestore, Auth, Cloud Messaging)
* **Icons:** Lucide-React
* **Styles:** Custom CSS with GSAP-inspired animations

## ⚙️ Setup for Developers
1. Clone the repo.
2. Create a `.env` file based on the keys in `src/config/firebase.js`.
3. Rename `public/firebase-messaging-fw.js.example` to `public/firebase-messaging-fw.js` and add your Firebase config.
4. Run `npm install` and `npm run dev`.

---
*Note: This project is for portfolio demonstration purposes. All rights reserved.*