import React, { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { Button } from 'react-bootstrap';
import { 
  collection, query, where, onSnapshot, doc, updateDoc, getCountFromServer 
} from 'firebase/firestore';
import { Users, Zap, CheckCircle, Clock, Shield } from 'lucide-react';

const AdminPanel = ({ accent }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [stats, setStats] = useState({ activeVibes: 0, totalUsers: 0, pendingApprovals: 0 });

  useEffect(() => {
   
    const fetchStats = async () => {
      const vibesQuery = query(collection(db, "vibes"), where("status", "==", "open"));
      const usersQuery = collection(db, "users");
      const pendingQuery = query(collection(db, "users"), where("status", "==", "pending"));

      const [vibesSnap, usersSnap, pendingSnap] = await Promise.all([
        getCountFromServer(vibesQuery),
        getCountFromServer(usersQuery),
        getCountFromServer(pendingQuery)
      ]);

      setStats({
        activeVibes: vibesSnap.data().count,
        totalUsers: usersSnap.data().count,
        pendingApprovals: pendingSnap.data().count
      });
    };

    fetchStats();
    
   
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    return onSnapshot(q, (snapshot) => {
      setPendingUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const approveUser = async (userId) => {
    await updateDoc(doc(db, "users", userId), {
      status: 'approved',
      isVerified: true,
      trustPoints: 5 
    });
  };

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '2rem' }}>
      <div className="d-flex align-items-center gap-3 mb-5">
        <Shield size={32} color={accent} />
        <h2 className="fw-black m-0" style={{ letterSpacing: '-1px' }}>COMMAND CENTER</h2>
      </div>

    
      <div className="row g-4 mb-5">
        <div className="col-md-4">
          <div className="p-4 rounded-4" style={{ background: '#111', border: '1px solid #222' }}>
            <Zap size={20} color={accent} className="mb-2" />
            <h3 className="fw-black m-0">{stats.activeVibes}</h3>
            <span className="text-white-50 small text-uppercase">Active Vibes</span>
          </div>
        </div>
        <div className="col-md-4">
          <div className="p-4 rounded-4" style={{ background: '#111', border: '1px solid #222' }}>
            <Users size={20} color={accent} className="mb-2" />
            <h3 className="fw-black m-0">{stats.totalUsers}</h3>
            <span className="text-white-50 small text-uppercase">Node Members</span>
          </div>
        </div>
        <div className="col-md-4">
          <div className="p-4 rounded-4" style={{ background: `${accent}11`, border: `1px solid ${accent}44` }}>
            <Clock size={20} color={accent} className="mb-2" />
            <h3 className="fw-black m-0">{stats.pendingApprovals}</h3>
            <span className="text-white-50 small text-uppercase">Waiting Review</span>
          </div>
        </div>
      </div>

      
      <h5 className="fw-bold mb-4 text-white-50">VERIFICATION QUEUE</h5>
      {pendingUsers.length === 0 ? (
        <div className="p-5 text-center rounded-4" style={{ border: '2px dashed #222' }}>
          <CheckCircle size={40} color="#333" className="mb-2" />
          <p className="text-white-50">Queue Clear. All students verified.</p>
        </div>
      ) : (
        <div className="row g-3">
          {pendingUsers.map(user => (
            <div key={user.id} className="col-md-6 col-lg-4">
              <div className="p-4 rounded-4 h-100" style={{ backgroundColor: '#16181c', border: '1px solid #2f3336' }}>
                <div className="d-flex justify-content-between mb-3">
                    <span className="fw-bold small">{user.name}</span>
                    <span className="text-white-50" style={{fontSize: '10px'}}>{user.uid.slice(0,8)}</span>
                </div>
               
                <div className="mb-3 rounded-3 overflow-hidden" style={{ height: '200px', background: '#000' }}>
                  <img src={user.idCardBase64} alt="ID" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <Button 
                  onClick={() => approveUser(user.id)} 
                  className="w-100 fw-bold border-0 py-2" 
                  style={{ backgroundColor: accent, color: '#000', borderRadius: '12px' }}
                >
                  APPROVE STUDENT
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;