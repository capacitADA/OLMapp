// ============================================
// OLM INGENIERÍA SAS - Firebase (solo Firestore)
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, addDoc, setDoc,
    updateDoc, deleteDoc, onSnapshot, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpW1ZLMZkpjbsBWiCRA3W15DHO2x-1aTE",
    authDomain: "olmapp.firebaseapp.com",
    projectId: "olmapp",
    storageBucket: "olmapp.firebasestorage.app",
    messagingSenderId: "936967827188",
    appId: "1:936967827188:web:7581731966a851725638a1"
};

const DRIVE_CLIENT_ID = "936967827188-479uovu5dirg6c6h8768u7a4h9jpqi81.apps.googleusercontent.com";
const DRIVE_FOLDER_NAME = "OLM_Informes";

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ===== FIRESTORE CRUD =====
export async function fsGetAll(col) {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fsAdd(col, data) {
    const ref = await addDoc(collection(db, col), {
        ...data, _createdAt: serverTimestamp()
    });
    return ref.id;
}

export async function fsUpdate(col, id, data) {
    await updateDoc(doc(db, col, id), { ...data, _updatedAt: serverTimestamp() });
}

export async function fsDelete(col, id) {
    await deleteDoc(doc(db, col, id));
}

// ===== GOOGLE DRIVE =====
let _driveToken = null;
let _driveFolderId = null;

export function driveIsConnected() { return !!_driveToken; }

export function driveSignIn() {
    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: "https://www.googleapis.com/auth/drive.file",
            callback: (resp) => {
                if (resp.error) { reject(resp.error); return; }
                _driveToken = resp.access_token;
                resolve(_driveToken);
            }
        });
        client.requestAccessToken();
    });
}

async function driveGetOrCreateFolder() {
    if (_driveFolderId) return _driveFolderId;
    const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER_NAME}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,
        { headers: { Authorization: `Bearer ${_driveToken}` } }
    );
    const data = await r.json();
    if (data.files && data.files.length > 0) {
        _driveFolderId = data.files[0].id;
        return _driveFolderId;
    }
    const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${_driveToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
    });
    const folder = await cr.json();
    _driveFolderId = folder.id;
    return _driveFolderId;
}

export async function driveUploadHTML(htmlContent, fileName) {
    if (!_driveToken) throw new Error("No hay token de Drive");
    const folderId = await driveGetOrCreateFolder();
    const blob = new Blob([htmlContent], { type: "text/html" });
    const metadata = { name: fileName, mimeType: "text/html", parents: [folderId] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);
    const resp = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        { method: "POST", headers: { Authorization: `Bearer ${_driveToken}` }, body: form }
    );
    return await resp.json();
}
