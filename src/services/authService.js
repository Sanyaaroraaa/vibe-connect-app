import { auth, db } from "../config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import Tesseract from 'tesseract.js';

export async function submitStudentId(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required to upload ID.");

  try {
    // 1. AI OCR Scan (Using Tesseract.js)
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    
    const keywords = ["university", "student", "identity", "valid", "card", "college", "id"];
    const found = keywords.some(word => text.toLowerCase().includes(word));

    if (!found) {
      throw new Error("AI Scan: Could not detect university keywords. Please take a clearer photo.");
    }

    // 2. Advanced Compression for Firestore (Spark Plan Friendly)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          
         
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          
          
          ctx.filter = 'grayscale(100%) brightness(1.1)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.3);

          try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              idCardBase64: compressedBase64,
              status: "pending", 
              submittedAt: serverTimestamp(),
              ocrDraftText: "AI Scanned & Compressed"
            });
            resolve(true);
          } catch (err) {
            reject(new Error("Database Error: " + err.message));
          }
        };
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
    });
  } catch (err) {
    throw err; 
  }
}