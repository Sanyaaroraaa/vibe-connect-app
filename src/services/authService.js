import { auth, db } from "../config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import Tesseract from 'tesseract.js';

export async function submitStudentId(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required to upload ID.");

  try {
    
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => console.log(m.status + ": " + Math.round(m.progress * 100) + "%")
    });
    
    const keywords = ["university", "student", "identity", "valid", "card", "college", "id"];
    const found = keywords.some(word => text.toLowerCase().includes(word));

    if (!found) {
      throw new Error("AI Scan: Could not detect university keywords. Please take a clearer photo of the text on your ID.");
    }

 
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

       
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);

          try {
            const userRef = doc(db, "users", user.uid);
         
            await updateDoc(userRef, {
              idCardBase64: compressedBase64,
              status: "pending", 
              submittedAt: serverTimestamp(),
              ocrDraftText: "AI Scanned: Verified"
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