
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* ---------- Configuration ---------- */
const ADMIN_COLLECTION = 'admins';      
const STUDENTS_COLLECTION = 'students'; 
const GATEPASSES_COLLECTION = 'gatepasses';

let currentUser = null;
let isAdmin = false;

/* ---------- DOM root ---------- */
const root = document.getElementById('app');

/* ---------- Helpers ---------- */
function show(html) { root.innerHTML = html; }
function normalizeEmail(e){ return (e||'').toLowerCase().trim(); }
function formatDate(ts){
  if(!ts) return 'N/A';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

/* ---------- Modal ---------- */
function showModal(message, confirmText = 'Confirm'){
  const modal = document.getElementById('modal-container');
  const msg = document.getElementById('modal-message');
  const c = document.getElementById('modal-confirm');
  const x = document.getElementById('modal-cancel');
  msg.textContent = message;
  c.textContent = confirmText;
  modal.classList.remove('hidden');
  return new Promise(resolve=>{
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onNo = ()=>{ cleanup(); resolve(false); };
    function cleanup(){ modal.classList.add('hidden'); c.removeEventListener('click', onOk); x.removeEventListener('click', onNo); }
    c.addEventListener('click', onOk);
    x.addEventListener('click', onNo);
  });
}

/* ---------- Auth UI ---------- */
function renderAuthUI(){
  show(`
    <div>
      <div class="header">
        <div>
          <div class="h-title">Gate Pass App</div>
          <div class="subtle">Sign up or sign in with email & password</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Create account</h3>
          <form id="signup-form">
            <input id="signup-name" type="text" placeholder="Full name" required />
            <input id="signup-email" type="email" placeholder="Email" required />
            <input id="signup-pass" type="password" placeholder="Password (min 6)" required />
            <div style="height:8px"></div>
            <button class="btn btn-primary" type="submit">Create account</button>
          </form>
          <div class="link-btn" id="to-signin">Already have an account? Sign in</div>
        </div>

        <div class="card">
          <h3>Sign in</h3>
          <form id="signin-form">
            <input id="signin-email" type="email" placeholder="Email" required />
            <input id="signin-pass" type="password" placeholder="Password" required />
            <div style="height:8px"></div>
            <button class="btn btn-primary" type="submit">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  `);

  // handlers
  document.getElementById('signup-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass = document.getElementById('signup-pass').value;
    try{
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      // set displayName
      try{ await updateProfile(userCred.user, { displayName: name }); } catch(_) {}
      // create student profile
      const studentRef = doc(db, STUDENTS_COLLECTION, userCred.user.uid);
      await setDoc(studentRef, { uid: userCred.user.uid, name, email: normalizeEmail(email), createdAt: serverTimestamp() });
      alert('Account created and profile saved. You are signed in.');
    } catch(err){
      alert('Sign up error: ' + err.message);
      console.error(err);
    }
  });

  document.getElementById('signin-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const pass = document.getElementById('signin-pass').value;
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will load app
    } catch(err){
      alert('Sign in error: ' + err.message);
      console.error(err);
    }
  });

  document.getElementById('to-signin').addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
}

/* ---------- App shell after login ---------- */
function renderAppShell(){
  const email = currentUser?.email || '';
  show(`
    <div>
      <div class="header">
        <div>
          <div class="h-title">Gate Pass App</div>
          <div class="subtle">Signed in as <strong>${email}</strong> ${isAdmin? '(Admin)': '(Student)'}</div>
        </div>
        <div>
          <button id="signout" class="btn btn-secondary">Sign out</button>
        </div>
      </div>

      <div id="main-area"></div>
    </div>
  `);
  document.getElementById('signout').addEventListener('click', async()=> await signOut(auth));
  if(isAdmin) renderAdminDashboard(); else renderStudentDashboard();
}

/* ---------- Student Dashboard ---------- */
let studentUnsub = null;
function renderStudentDashboard(){
  const main = document.getElementById('main-area');
  main.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card">
          <h3>Request New Gate Pass</h3>
          <form id="pass-form">
            <input id="student-name" type="text" placeholder="Full name" required />
            <input id="student-roll" type="text" placeholder="Roll / Reg No" required />
            <input id="student-dept" type="text" placeholder="Department" required />
            <input id="destination" type="text" placeholder="Destination" required />
            <textarea id="reason" placeholder="Reason for leave" required></textarea>
            <div style="display:flex;gap:8px">
              <input id="departure-time" type="datetime-local" required />
              <input id="return-time" type="datetime-local" required />
            </div>
            <div id="submission-message" style="min-height:18px;margin-top:8px"></div>
            <div style="height:8px"></div>
            <button class="btn btn-primary" type="submit">Submit Request</button>
          </form>
        </div>
      </div>

      <aside>
        <div class="card">
          <h3>Your Recent Passes</h3>
          <div id="student-passes-list" class="items-list">Loading...</div>
        </div>
      </aside>
    </div>
  `;

  preloadStudentProfile();
  document.getElementById('pass-form').addEventListener('submit', submitPassRequest);
  listenForStudentPasses();
}

async function preloadStudentProfile(){
  try{
    const sref = doc(db, STUDENTS_COLLECTION, currentUser.uid);
    const snap = await getDoc(sref);
    if(snap.exists()){
      const data = snap.data();
      if(data.name) document.getElementById('student-name').value = data.name;
      if(data.roll) document.getElementById('student-roll').value = data.roll;
      if(data.department) document.getElementById('student-dept').value = data.department;
    }
  } catch(err){ console.warn('preload profile err', err); }
}

async function submitPassRequest(e){
  e.preventDefault();
  const name = document.getElementById('student-name').value.trim();
  const roll = document.getElementById('student-roll').value.trim();
  const dept = document.getElementById('student-dept').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const reason = document.getElementById('reason').value.trim();
  const departure = document.getElementById('departure-time').value;
  const ret = document.getElementById('return-time').value;
  const msgEl = document.getElementById('submission-message');

  if(!name || !roll || !dept || !destination || !reason || !departure || !ret){
    msgEl.textContent = 'Please fill all fields';
    return;
  }

  try {
    const passesRef = collection(db, GATEPASSES_COLLECTION);
    await addDoc(passesRef, {
      userId: currentUser.uid,
      name,
      roll,
      department: dept,
      destination,
      reason,
      departureTime: new Date(departure),
      returnTime: new Date(ret),
      status: 'Pending',
      adminNotes: '',
      createdAt: serverTimestamp(),
      createdByEmail: normalizeEmail(currentUser.email)
    });
    msgEl.textContent = 'Request submitted';
    setTimeout(()=> msgEl.textContent = '', 3500);
    document.getElementById('pass-form').reset();
    preloadStudentProfile();
  } catch(err){
    console.error('submit error', err);
    msgEl.textContent = 'Error: ' + err.message;
  }
}

function listenForStudentPasses(){
  const passesRef = collection(db, GATEPASSES_COLLECTION);
  const q = query(passesRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));

  if(studentUnsub) studentUnsub(); // cleanup
  studentUnsub = onSnapshot(q, (snapshot)=>{
    const list = document.getElementById('student-passes-list');
    if(!list) return;
    if(snapshot.empty){ list.innerHTML = '<div>No passes found</div>'; return; }
    list.innerHTML = '';
    snapshot.forEach(snap=>{
      const d = snap.data();
      const div = document.createElement('div');
      div.className = 'pass-card';
      const statusClass = d.status === 'Approved' ? 'status-approved' : d.status === 'Rejected' ? 'status-rejected' : 'status-pending';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${d.name} (${d.roll})</strong><div class="pass-meta">${d.destination} — ${d.reason}</div></div>
          <div class="status-pill ${statusClass}">${d.status}</div>
        </div>
        <div style="margin-top:8px;font-size:13px;color:#475569">Out: ${formatDate(d.departureTime)} | In: ${formatDate(d.returnTime)}</div>
        ${d.adminNotes ? `<div style="margin-top:6px;color:#b91c1c"><em>Note: ${d.adminNotes}</em></div>` : ''}
      `;
      list.appendChild(div);
    });
  }, (err)=>{
    console.error('student pass listen err', err);
    const list = document.getElementById('student-passes-list');
    if(list) list.innerHTML = `<div style="color:red">Failed to load your passes: ${err.message}</div>`;
  });
}

/* ---------- Admin Dashboard ---------- */
let adminUnsub = null;
function renderAdminDashboard(){
  const main = document.getElementById('main-area');
  main.innerHTML = `
    <div>
      <div class="card">
        <h3>Admin Controls</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="new-admin-email" type="email" placeholder="Admin email to add" />
          <button id="add-admin" class="btn btn-primary">Add Admin</button>
        </div>
        <div id="admins-list" style="margin-top:12px">Loading admins...</div>
      </div>

      <div class="card" style="margin-top:12px">
        <h3>All Gate Pass Requests</h3>
        <div id="admin-passes-list" class="items-list">Loading...</div>
      </div>
    </div>
  `;

  document.getElementById('add-admin').addEventListener('click', async ()=>{
    const em = normalizeEmail(document.getElementById('new-admin-email').value);
    if(!em) return alert('Enter email');
    try{
      await setDoc(doc(db, ADMIN_COLLECTION, em), { role: 'admin', addedAt: serverTimestamp() });
      document.getElementById('new-admin-email').value = '';
      loadAndRenderAdmins();
      alert('Admin added: ' + em);
    } catch(err){ alert('Could not add admin: ' + err.message); console.error(err); }
  });

  loadAndRenderAdmins();
  listenForAdminPasses();
}

async function loadAndRenderAdmins(){
  try{
    const snaps = await getDocs(collection(db, ADMIN_COLLECTION));
    const el = document.getElementById('admins-list');
    el.innerHTML = '';
    if(snaps.empty){ el.textContent = 'No admins registered.'; return; }
    snaps.forEach(s=>{
      const id = s.id;
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems='center'; row.style.padding='6px 0';
      row.innerHTML = `<div>${id}</div><div><button class="btn btn-secondary remove-admin" data-email="${id}">Remove</button></div>`;
      el.appendChild(row);
    });

    document.querySelectorAll('.remove-admin').forEach(btn=>{
      btn.addEventListener('click', async (ev)=>{
        const em = ev.target.dataset.email;
        const ok = await showModal(`Remove admin ${em}?`, 'Remove');
        if(!ok) return;
        try{
          await deleteDoc(doc(db, ADMIN_COLLECTION, em));
          loadAndRenderAdmins();
        } catch(err){ alert('Could not remove: ' + err.message); console.error(err);}
      });
    });

  } catch(err){
    console.error('load admins err', err);
    document.getElementById('admins-list').innerHTML = `<div style="color:red">Failed to load admins: ${err.message}</div>`;
  }
}

function listenForAdminPasses(){
  const passesRef = collection(db, GATEPASSES_COLLECTION);
  const q = query(passesRef, orderBy('createdAt', 'desc'));

  if(adminUnsub) adminUnsub();
  adminUnsub = onSnapshot(q, (snapshot)=>{
    const list = document.getElementById('admin-passes-list');
    if(!list) return;
    if(snapshot.empty){ list.innerHTML = '<div>No pass requests yet.</div>'; return; }
    list.innerHTML = '';
    snapshot.forEach(snap=>{
      const d = snap.data(); const id = snap.id;
      const card = document.createElement('div'); card.className = 'pass-card';
      const statusClass = d.status === 'Approved' ? 'status-approved' : d.status === 'Rejected' ? 'status-rejected' : 'status-pending';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <strong>${d.name} (${d.roll})</strong>
            <div class="pass-meta">${d.destination} — ${d.reason}</div>
            <div style="margin-top:8px;font-size:13px;color:#475569">Out: ${formatDate(d.departureTime)} | In: ${formatDate(d.returnTime)}</div>
            ${d.adminNotes ? `<div style="margin-top:6px;color:#b91c1c"><em>Note: ${d.adminNotes}</em></div>` : ''}
          </div>
          <div style="min-width:120px;text-align:right"><div class="status-pill ${statusClass}">${d.status}</div></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${d.status === 'Pending' ? `<button class="btn btn-primary approve" data-id="${id}">Approve</button><button class="btn btn-secondary reject" data-id="${id}">Reject</button>` : ''}
          <button class="btn btn-secondary view" data-id="${id}">View</button>
          <button class="btn btn-secondary del" data-id="${id}">Delete</button>
        </div>
      `;
      list.appendChild(card);
    });

    // actions
    document.querySelectorAll('.approve').forEach(b=> b.addEventListener('click', async ev=>{
      const id = ev.target.dataset.id;
      const ok = await showModal('Approve this request?', 'Approve');
      if(!ok) return;
      await updatePassStatus(id, 'Approved', 'Approved by admin.');
    }));
    document.querySelectorAll('.reject').forEach(b=> b.addEventListener('click', async ev=>{
      const id = ev.target.dataset.id;
      const ok = await showModal('Reject this request?', 'Reject');
      if(!ok) return;
      await updatePassStatus(id, 'Rejected', 'Rejected by admin.');
    }));
    document.querySelectorAll('.view').forEach(b=> b.addEventListener('click', async ev=>{
      const id = ev.target.dataset.id;
      const snap = await getDoc(doc(db, GATEPASSES_COLLECTION, id));
      if(!snap.exists()) return alert('Not found');
      const d = snap.data();
      await showModal(`Student: ${d.name} (${d.roll})\nDestination: ${d.destination}\nReason: ${d.reason}\nOut: ${formatDate(d.departureTime)}\nIn: ${formatDate(d.returnTime)}\nStatus: ${d.status}`, 'OK');
    }));
    document.querySelectorAll('.del').forEach(b=> b.addEventListener('click', async ev=>{
      const id = ev.target.dataset.id;
      const ok = await showModal('Delete this pass?', 'Delete');
      if(!ok) return;
      try{
        await deleteDoc(doc(db, GATEPASSES_COLLECTION, id));
      } catch(err){ alert('Delete error: ' + err.message); console.error(err); }
    }));

  }, (err)=>{
    console.error('admin passes listen err', err);
    const list = document.getElementById('admin-passes-list');
    if(list) list.innerHTML = `<div style="color:red">Failed to load passes: ${err.message}</div>`;
  });
}

async function updatePassStatus(id, newStatus, notes=''){
  try{
    await updateDoc(doc(db, GATEPASSES_COLLECTION, id), {
      status: newStatus,
      adminNotes: notes,
      updatedAt: serverTimestamp()
    });
  } catch(err){ alert('Update error: ' + err.message); console.error(err); }
}

/* ---------- Admin check ---------- */
async function checkIfAdmin(user){
  if(!user || !user.email) return false;
  try{
    const emailKey = normalizeEmail(user.email);
    const snap = await getDoc(doc(db, ADMIN_COLLECTION, emailKey));
    return snap.exists();
  } catch(err){
    console.warn('admin check failed', err);
    return false;
  }
}

/* ---------- Auth state ---------- */
onAuthStateChanged(auth, async (user)=>{
  currentUser = user;
  if(!user){
    isAdmin = false;
    renderAuthUI();
    return;
  }
  // determine admin
  isAdmin = await checkIfAdmin(user);
  renderAppShell();
});


