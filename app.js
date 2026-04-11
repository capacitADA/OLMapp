// ============================================
// OLM INGENIERÍA SAS - APP Firebase
// Versión unificada - QR móvil + Informe PDF grande
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, writeBatch }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpW1ZLMZkpjbsBWiCRA3W15DHO2x-1aTE",
    authDomain: "olmapp.firebaseapp.com",
    projectId: "olmapp",
    storageBucket: "olmapp.firebasestorage.app",
    messagingSenderId: "936967827188",
    appId: "1:936967827188:web:7581731966a851725638a1"
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYWgupeHfhfKmvMDk_FFsTj-P9PdJfXMn3pheGjFMXK7i43AW1V8A5BD4iCSbOho9c/exec';

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ===== DRIVE =====
let _driveConnected = false;

async function conectarDriveAuto() {
    try {
        await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' });
        _driveConnected = true;
        console.log('✅ Drive conectado automáticamente');
    } catch (e) {
        console.log('⚠️ Drive no disponible');
        _driveConnected = false;
    }
}

async function driveUploadPDF(html, filename) {
    if (!filename.endsWith('.pdf')) filename = filename.replace('.html', '') + '.pdf';
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: html, filename: filename })
        });
        console.log('✅ PDF enviado a Drive:', filename);
        return true;
    } catch(e) {
        console.error('Error Drive:', e);
        return false;
    }
}

// ===== DATOS GLOBALES =====
let clientes = [], equipos = [], servicios = [], tecnicos = [];
let jmcTiendas = [];
let jmcTiendasVersion = '';

// ===== CARGAR DATOS =====
async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cs, es, ss, ts, jmc] = await Promise.all([
            getDocs(query(collection(db, 'clientes'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos')),
            getDocs(collection(db, 'jmc_tiendas'))
        ]);
        clientes = cs.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = es.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = ts.docs.map(d => ({ id: d.id, ...d.data() }));
        jmcTiendas = jmc.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (jmcTiendas.length > 0 && jmcTiendas[0].version) {
            jmcTiendasVersion = jmcTiendas[0].version;
        }
    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

// ===== SEMBRAR DATOS INICIALES =====
async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app...');
    
    const cRef = await addDoc(collection(db, 'clientes'), {
        nombre: 'Jeronimo Martins Colombia',
        telefono: '3212167987',
        email: 'Nestor.gutierres@jeronimo-martins.com',
        ciudad: 'Bogota',
        direccion: 'Calle 100 # 7 - 33, Torre 1, Piso 11',
        latitud: '4.6798976',
        longitud: '-74.0415781',
        fechaCreacion: new Date().toISOString().split('T')[0]
    });
    
    await addDoc(collection(db, 'equipos'), {
        clienteId: cRef.id,
        marca: 'Copeland',
        modelo: 'CR-400',
        serie: 'CP-2024-00891',
        ubicacion: '893',
        tipo: 'Compresor industrial'
    });
    
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Oscar Leonardo Martinez',
        cedula: '0000001',
        tipoDoc: 'CC',
        telefono: '3114831801',
        cargo: 'Administrador',
        rol: 'admin',
        especialidades: ['mecanico', 'baja', 'media', 'electronico', 'ups', 'planta'],
        region: 'Colombia',
        clave: '1234'
    });
    
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Juan Perez',
        cedula: '10234568',
        tipoDoc: 'CC',
        telefono: '3120000002',
        cargo: 'Tecnico de Campo',
        rol: 'tecnico',
        especialidades: ['baja', 'media'],
        region: 'Cundinamarca',
        clave: '5678'
    });
    
    toast('✅ Listo. Cedula: 0000001 · Clave: 1234');
}

// ===== HELPERS =====
const getEq = id => equipos.find(e => e.id === id);
const getCl = id => clientes.find(c => c.id === id);
const getTec = id => tecnicos.find(t => t.id === t);
const getEquiposCliente = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}

function toast(msg, duration = 3000) {
    const t = document.getElementById('toastEl');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function showModal(html) {
    const ov = document.getElementById('overlayEl');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
    ov.onclick = e => { if (e.target === ov) closeModal(); };
}

function closeModal() {
    const ov = document.getElementById('overlayEl');
    ov.classList.add('hidden');
    ov.innerHTML = '';
    fotosNuevas = [null, null, null];
}

// ===== ESTADO =====
let currentView = 'panel';
let sesionActual = null;
let selectedClienteId = null;
let selectedEquipoId = null;
let fotosNuevas = [null, null, null];
let _servicioEidActual = null;

// ===== NAVEGACIÓN (resumida - agrega el resto de tus funciones render si falta) =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
}

function renderView() {
    // ... tu código original de renderView
    // (mantén todas tus funciones renderPanel, renderClientes, etc.)
    console.log('Renderizando vista:', currentView);
}

// ===== FUNCIÓN MEJORADA PARA QR (funciona en todos los celulares) =====
function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    
    const eid = hash.replace('#/equipo/', '').trim();
    const e = getEq(eid);
    if (!e) {
        document.getElementById('mainContent').innerHTML = `<div class="page" style="text-align:center;padding:4rem;"><p>⚠️ Equipo no encontrado</p><p>ID: ${eid}</p></div>`;
        return true;
    }

    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    const main = document.getElementById('mainContent');
    document.querySelectorAll('.topbar, .botnav').forEach(el => el.style.display = 'none');
    main.style.background = '#ffffff';

    
const waMsg = encodeURIComponent(
    `Hola Oscar, necesito ayuda con el equipo ${e?.tipo || ''} ${e?.marca} ${e?.modelo} ` +
    `ubicado en ${e?.ubicacion || 'sin ubicación especificada'}. ` +
    `Podrías devolverme el mensaje?`
);
    main.innerHTML = `
    <div style="max-width:640px;margin:0 auto;padding:1.2rem;">
        <div style="text-align:center;margin-bottom:1rem;">
            <img src="https://raw.githubusercontent.com/capacitADA/OLMapp/main/OLM_LOGO.png" style="height:52px;" onerror="this.style.display='none'">
            <h2 style="color:#0d4a3a;margin:8px 0 4px;">OLM INGENIERÍA SAS</h2>
            <p style="margin:0;color:#555;font-size:1.1rem;">📞 311 483 1801</p>
        </div>
        <div style="background:#0d4a3a;color:white;border-radius:16px;padding:18px;text-align:center;margin-bottom:1.2rem;">
            <div style="font-size:2.1rem;font-weight:700;">311 483 1801</div>
        </div>
        <div style="border:1px solid #ddd;border-radius:14px;padding:1.2rem;background:#fafafa;margin-bottom:1.2rem;">
            <h3 style="margin:0 0 10px;color:#0d4a3a;">${e.tipo ? e.tipo + ' • ' : ''}${e.marca} ${e.modelo}</h3>
            <p style="margin:6px 0;"><strong>📍</strong> ${e.ubicacion}</p>
            <p style="margin:6px 0;"><strong>👤</strong> ${c?.nombre || 'N/A'}</p>
        </div>
        <a href="${waUrl}" target="_blank" style="display:block;width:100%;background:#25D366;color:white;padding:16px;border-radius:14px;text-align:center;font-size:1.1rem;font-weight:700;margin-bottom:1.5rem;">📱 Contactar por WhatsApp</a>
        <h3>Historial (${ss.length})</h3>
        ${ss.map(s => `
        <div style="border:1px solid #d1ede0;border-radius:12px;padding:1rem;margin-bottom:0.8rem;">
            <div style="display:flex;justify-content:space-between;"><strong>${s.tipo}</strong><span>${fmtFecha(s.fecha)}</span></div>
            <div>🔧 ${s.tecnico}</div>
            <div>${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="color:#b45309;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`).join('')}
    </div>`;
    return true;
}

// ===== INFORME PDF CON LETRA GRANDE =====
function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    const LOGO = 'https://raw.githubusercontent.com/capacitADA/OLMapp/main/OLM_LOGO.png';

    const serviciosHTML = ss.map(s => `
        <div style="border:1px solid #d1d5db;border-radius:10px;padding:16px;margin-bottom:14px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="background:${s.tipo==='Mantenimiento'?'#1d4ed8':s.tipo==='Reparacion'?'#dc2626':'#15803d'};color:white;padding:6px 14px;border-radius:12px;font-size:15px;font-weight:700;">${s.tipo}</span>
                <span style="font-size:16px;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:17px;margin:8px 0;">🔧 ${s.tecnico}</div>
            <div style="font-size:17px;line-height:1.6;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="color:#b45309;font-size:16px;margin-top:8px;">📅 Próximo mantenimiento: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Informe_${e?.marca || ''}_${e?.modelo || ''}</title>
<style>
  @page{size:letter;margin:15mm;}
  body{font-family:Arial,sans-serif;font-size:17px;color:#111;line-height:1.6;}
  h2{font-size:26px;}
  strong{font-size:18px;}
  .info{font-size:18px;}
</style></head><body>

<div style="display:flex;align-items:center;border-bottom:4px solid #0d4a3a;padding-bottom:16px;margin-bottom:20px;">
  <img src="${LOGO}" style="height:70px;margin-right:20px;" onerror="this.style.display='none'">
  <div>
    <div style="font-size:26px;font-weight:900;color:#0d4a3a;">OLM INGENIERÍA SAS</div>
    <div style="font-size:17px;color:#555;">Plantas y Sistemas Eléctricos | 📞 311 483 1801</div>
    <div style="font-size:22px;font-weight:700;margin-top:8px;">INFORME TÉCNICO</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
  <tr>
    <td class="info" style="padding:12px;background:#f1f5f9;border:1px solid #ddd;"><strong>Cliente:</strong> ${c?.nombre || 'N/A'}</td>
    <td class="info" style="padding:12px;background:#f1f5f9;border:1px solid #ddd;"><strong>Generado:</strong> ${new Date().toLocaleString('es-CO')}</td>
  </tr>
  <tr>
    <td colspan="2" class="info" style="padding:14px;border:1px solid #ddd;">
      <strong>Activo:</strong> ${e?.tipo||''} ${e?.marca||''} ${e?.modelo||''} 
      &nbsp;&nbsp; <strong>Serial:</strong> ${e?.serie || 'N/A'} 
      &nbsp;&nbsp; <strong>Ubicación:</strong> ${e?.ubicacion||''}
    </td>
  </tr>
</table>

<div style="background:#0d4a3a;color:white;font-weight:700;font-size:20px;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
  HISTORIAL DE SERVICIOS &nbsp;&nbsp; <span style="font-weight:400;">${ss.length} registro(s)</span>
</div>

${serviciosHTML}

<div style="margin-top:40px;text-align:center;font-size:14px;color:#666;">
  Documento generado por OLM App
</div>

</body></html>`;

    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const v = window.open(url, '_blank');
    if (v) v.onload = () => v.print();
}

// ===== INICIO DE LA APP =====
(async () => {
    await conectarDriveAuto();
    await sembrarDatos();
    await cargarDatos();

    // Manejo del QR
    const esQR = manejarRutaQR();
    if (!esQR) {
        renderView();
    }

    window.addEventListener('hashchange', manejarRutaQR);

    // Soporte extra para móviles
    setTimeout(() => {
        if (window.location.hash.startsWith('#/equipo/')) manejarRutaQR();
    }, 1000);
})();

// ===== Exporta las funciones que usas en HTML onclick =====
window.goTo = goTo;
window.generarInformePDF = generarInformePDF;
window.closeModal = closeModal;
window.toast = toast;
// Agrega aquí las demás: window.modalNuevoServicio = ... etc. (las que ya tenías)