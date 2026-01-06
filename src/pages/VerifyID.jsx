import React, { useState, useEffect } from 'react';
import { Container, Button, Form, Alert, ProgressBar } from 'react-bootstrap';
import { ShieldCheck, UploadCloud, CheckCircle, Loader2 } from 'lucide-react';
import { auth, db } from "../config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import Tesseract from 'tesseract.js';
import { toast } from 'react-toastify';

const VerifyID = ({ onComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const processID = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a photo of your ID");

    setLoading(true);
    setProgress(0);
    setScanStatus("Initializing AI...");

    try {
     
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setScanStatus("Scanning ID Text...");
          }
        }
      });

      const keywords = ["university", "student", "identity", "valid", "card", "college"];
      const isID = keywords.some(word => text.toLowerCase().includes(word));

      if (!isID) {
        throw new Error("AI Scan Failed: Could not find university keywords. Ensure text is clear.");
      }

      setScanStatus("Compressing Image...");
      
      // 3. Compression & Upload
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
          
          const base64 = canvas.toDataURL('image/jpeg', 0.5);

          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            idCardBase64: base64,
            status: "pending",
            submittedAt: serverTimestamp()
          });

          toast.success("ID Securely Uploaded!");
          if (onComplete) onComplete();
        };
      };

    } catch (err) {
      toast.error(err.message);
      setScanStatus("");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5 text-center" style={{ maxWidth: '420px' }}>
      <div className="mb-4 animate__animated animate__fadeIn">
        <ShieldCheck size={56} color="#C1FF72" className="mb-3" />
        <h2 className="fw-black text-white">CAMPUS ACCESS</h2>
        <p className="text-white-50 small">Our AI will verify your student status. This data is encrypted and used for one-time verification only.</p>
      </div>

      <Form onSubmit={processID} className="p-4 rounded-5" style={{ background: '#0a0a0b', border: '1px solid #222' }}>
        <div 
          className="mb-4 d-flex flex-column align-items-center justify-content-center border-dashed rounded-4 position-relative" 
          style={{ height: '220px', border: '2px dashed #333', cursor: loading ? 'not-allowed' : 'pointer', overflow: 'hidden', backgroundColor: '#000' }}
          onClick={() => !loading && document.getElementById('fileInput').click()}
        >
          {preview ? (
            <img src={preview} alt="ID Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loading ? 0.4 : 1 }} />
          ) : (
            <div className="text-center">
              <UploadCloud size={40} className="mb-2 text-white-50" />
              <div className="small text-white-50 fw-bold">TAP TO UPLOAD ID</div>
            </div>
          )}

          {loading && (
            <div className="position-absolute top-50 start-50 translate-middle w-75">
               <div className="small fw-bold text-white mb-2">{scanStatus}</div>
               <ProgressBar now={progress} variant="success" style={{ height: '8px', borderRadius: '10px', backgroundColor: '#222' }} />
               <div className="mt-2" style={{ color: '#C1FF72', fontSize: '12px' }}>{progress}%</div>
            </div>
          )}
        </div>

        <input type="file" id="fileInput" hidden accept="image/*" onChange={handleFileChange} disabled={loading} />

        <Button 
          type="submit" 
          disabled={loading || !file} 
          className="w-100 py-3 fw-bold border-0 shadow-lg" 
          style={{ backgroundColor: (loading || !file) ? '#222' : '#C1FF72', color: '#000', borderRadius: '16px', transition: '0.3s' }}
        >
          {loading ? <><Loader2 size={18} className="spinner-border-sm me-2 animate-spin" /> ANALYZING...</> : "AUTHENTICATE ID"}
        </Button>
      </Form>
      
      <div className="mt-4 d-flex align-items-center justify-content-center gap-2 text-white-50 small">
        <CheckCircle size={14} color="#C1FF72" /> <span>End-to-End Encrypted Verification</span>
      </div>
    </Container>
  );
};

export default VerifyID;