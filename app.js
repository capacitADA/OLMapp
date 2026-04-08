// ============================================
// OLM INGENIERÍA SAS - APP Firebase
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy }
    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpW1ZLMZkpjbsBWiCRA3W15DHO2x-1aTE",
    authDomain: "olmapp.firebaseapp.com",
    projectId: "olmapp",
    storageBucket: "olmapp.firebasestorage.app",
    messagingSenderId: "936967827188",
    appId: "1:936967827188:web:7581731966a851725638a1"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ===== DRIVE =====
const DRIVE_CID = "936967827188-479uovu5dirg6c6h8768u7a4h9jpqi81.apps.googleusercontent.com";
let _driveTok = null, _driveFid = null;

function driveIsConnected() { return !!_driveTok; }

async function conectarDrive() {
    try {
        await new Promise((res, rej) => {
            google.accounts.oauth2.initTokenClient({
                client_id: DRIVE_CID,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (r) => {
                    if (r.error) { rej(r.error); return; }
                    _driveTok = r.access_token;
                    res();
                }
            }).requestAccessToken();
        });
        actualizarTopbar();
        toast('☁️ Drive conectado');
    } catch (e) {
        toast('❌ Drive: ' + e);
    }
}

async function driveUploadHTML(html, name) {
    if (!_driveTok) return;
    if (!_driveFid) {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='OLM_Informes'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`, {
            headers: { Authorization: `Bearer ${_driveTok}` }
        });
        const d = await r.json();
        if (d.files && d.files.length > 0) {
            _driveFid = d.files[0].id;
        } else {
            const c = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: { Authorization: `Bearer ${_driveTok}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'OLM_Informes', mimeType: 'application/vnd.google-apps.folder' })
            });
            _driveFid = (await c.json()).id;
        }
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name, mimeType: 'text/html', parents: [_driveFid] })], { type: 'application/json' }));
    form.append('file', new Blob([html], { type: 'text/html' }));
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${_driveTok}` },
        body: form
    });
}

// ===== DATOS =====
let clientes = [], equipos = [], servicios = [], tecnicos = [];

async function cargarDatos() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><p>Cargando...</p></div>';
    try {
        const [cs, es, ss, ts] = await Promise.all([
            getDocs(query(collection(db, 'clientes'), orderBy('nombre'))),
            getDocs(collection(db, 'equipos')),
            getDocs(query(collection(db, 'servicios'), orderBy('fecha', 'desc'))),
            getDocs(collection(db, 'tecnicos'))
        ]);
        clientes = cs.docs.map(d => ({ id: d.id, ...d.data() }));
        equipos = es.docs.map(d => ({ id: d.id, ...d.data() }));
        servicios = ss.docs.map(d => ({ id: d.id, ...d.data() }));
        tecnicos = ts.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error('Error:', err);
        toast('⚠️ Error de conexión');
        main.innerHTML = '<div class="page" style="text-align:center;padding:2rem;"><p>⚠️ Error al cargar datos</p><button class="btn btn-blue" onclick="location.reload()">Reintentar</button></div>';
        return;
    }
    renderView();
}

async function sembrarDatos() {
    const snap = await getDocs(collection(db, 'tecnicos'));
    if (!snap.empty) return;
    toast('⚙️ Configurando app...');
    const cRef = await addDoc(collection(db, 'clientes'), {
        nombre: 'Cliente Demo SAS',
        telefono: '3100000000',
        email: 'demo@clientedemo.com',
        ciudad: 'Bucaramanga',
        direccion: 'Calle 1 # 1-1',
        latitud: null,
        longitud: null,
        fechaCreacion: new Date().toISOString().split('T')[0]
    });
    const eRef = await addDoc(collection(db, 'equipos'), {
        clienteId: cRef.id,
        marca: 'APC',
        modelo: 'Smart-UPS 3000',
        serie: 'UPS-2024-001',
        ubicacion: 'Sala de servidores',
        tipo: 'UPS'
    });
    await addDoc(collection(db, 'servicios'), {
        equipoId: eRef.id,
        tipo: 'Mantenimiento',
        fecha: new Date().toISOString().split('T')[0],
        tecnico: 'Oscar Leonardo Martínez',
        descripcion: 'Revisión general UPS. Sistema óptimo.',
        proximoMantenimiento: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fotos: []
    });
    await addDoc(collection(db, 'tecnicos'), {
        nombre: 'Oscar Leonardo Martínez',
        cedula: '0000001',
        tipoDoc: 'CC',
        telefono: '3114831801',
        cargo: 'Administrador',
        rol: 'admin',
        especialidades: ['mecanico', 'baja', 'media'],
        region: 'Colombia',
        clave: '1234'
    });
    toast('✅ Listo. Cédula: 0000001 · Clave: 1234');
}

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Bucaramanga', 'Barranquilla',
    'Cúcuta', 'Manizales', 'Pereira', 'Ibagué', 'Villavicencio',
    'Girón', 'Floridablanca', 'Piedecuesta', 'Pamplona', 'Soacha'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const EMPRESA = { nombre: 'OLM INGENIERÍA SAS', nit: '901.050.468-5', contacto: 'Oscar Leonardo Martínez', telefono: '311 4831801', ciudad: 'Bogotá' };

// ===== ESPECIALIDADES (FIX BUG #1) =====
const ESPECIALIDADES = [
    { id: 'mecanico', label: 'Mecánico' },
    { id: 'electrico', label: 'Eléctrico' },
    { id: 'electronico', label: 'Electrónico' },
    { id: 'baja', label: 'Baja Tensión' },
    { id: 'media', label: 'Media Tensión' },
    { id: 'alta', label: 'Alta Tensión' },
    { id: 'ups', label: 'UPS' },
    { id: 'planta', label: 'Plantas Eléctricas' }
];

// ===== ESTADO =====
let currentView = 'panel';
let sesionActual = null;
let selectedClienteId = null;
let selectedEquipoId = null;
const fotosNuevas = [null, null, null];

// ===== HELPERS =====
const getEq = id => equipos.find(e => e.id === id);
const getCl = id => clientes.find(c => c.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposCliente = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));

function fmtFecha(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES');
}
function fmtFechaLarga(f) {
    if (!f) return '';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function getMesActual() { return new Date().toISOString().slice(0, 7); }

// ===== PERMISOS =====
function esAdmin() { return sesionActual?.rol === 'admin'; }
function esPropietario(creadoPor) { return sesionActual?.nombre === creadoPor; }
function puedeEditar(creadoPor) { return esAdmin() || esPropietario(creadoPor); }

// ===== TOAST =====
function toast(msg, duration = 2500) {
    const t = document.getElementById('toastEl');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ===== OVERLAY / MODAL =====
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
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;
}

// ===== TOPBAR SESION =====
function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span class="topbar-user" id="topbarUser">Sin sesión</span>`;
    } else {
        const initials = sesionActual.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const rolBadge = esAdmin()
            ? `<span class="topbar-rol-badge">Admin</span>`
            : '';
        right.innerHTML = `
            <div class="topbar-sesion">
                <div class="topbar-avatar">${initials}</div>
                <div>
                    <div style="font-size:0.68rem;color:white;font-weight:700;line-height:1;">${sesionActual.nombre.split(' ')[0]}</div>
                    ${rolBadge}
                </div>
                ${driveIsConnected() ? '<span style="font-size:0.6rem;color:#4ade80;font-weight:700;">☁️</span>' : '<button class="topbar-salir" style="background:#1a73e8;padding:4px 8px;" onclick="conectarDrive()">☁️</button>'}
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

function cerrarSesion() {
    sesionActual = null;
    currentView = 'panel';
    actualizarTopbar();
    actualizarBotnav();
    renderView();
    toast('👋 Sesión cerrada');
}

// ===== BOTTOM NAV ACTUALIZAR (con candados) =====
function actualizarBotnav() {
    const btns = document.querySelectorAll('.bni');
    const sinSesion = !sesionActual;
    
    btns.forEach(btn => {
        const page = btn.dataset.page;
        const icoSpan = btn.querySelector('.bni-ico');
        const lblSpan = btn.querySelector('.bni-lbl');
        
        // Técnicos siempre normal
        if (page === 'tecnicos') {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.filter = 'none';
            if (icoSpan && icoSpan.innerHTML.includes('🔒')) {
                icoSpan.innerHTML = '👨‍🔧';
            }
            if (lblSpan) lblSpan.style.color = '';
            return;
        }
        
        // Sin sesión: candado
        if (sinSesion) {
            btn.style.opacity = '0.6';
            btn.style.cursor = 'pointer';
            if (icoSpan && !icoSpan.innerHTML.includes('🔒')) {
                if (!btn.dataset.originalIcon) {
                    btn.dataset.originalIcon = icoSpan.innerHTML;
                }
                icoSpan.innerHTML = '🔒';
            }
            if (lblSpan) lblSpan.style.color = 'var(--hint)';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            if (btn.dataset.originalIcon && icoSpan) {
                icoSpan.innerHTML = btn.dataset.originalIcon;
            }
            if (lblSpan) lblSpan.style.color = '';
        }
    });
}

function initBotnavListeners() {
    document.querySelectorAll('.bni').forEach(btn => {
        btn.removeEventListener('click', btn._listener);
        
        const handler = () => {
            const page = btn.dataset.page;
            
            if (!sesionActual && page !== 'panel' && page !== 'tecnicos') {
                toast('🔒 Inicia sesión desde el menú Técnicos', 2000);
                const tecBtn = document.querySelector('.bni[data-page="tecnicos"]');
                if (tecBtn) {
                    tecBtn.style.transform = 'scale(1.05)';
                    setTimeout(() => { if (tecBtn) tecBtn.style.transform = ''; }, 300);
                }
                return;
            }
            
            selectedClienteId = null;
            selectedEquipoId = null;
            goTo(page);
        };
        
        btn._listener = handler;
        btn.addEventListener('click', handler);
    });
}

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    if (!sesionActual && view !== 'panel' && view !== 'tecnicos') {
        toast('🔒 Debes iniciar sesión primero', 2000);
        return;
    }
    
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId = eid;
    closeModal();
    renderView();
    
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle' && b.dataset.page === 'clientes') ||
            (view === 'historial' && b.dataset.page === 'clientes'));
    });
}

// ===== RENDER PRINCIPAL =====
function renderView() {
    const main = document.getElementById('mainContent');
    const botnav = document.getElementById('botnavEl');
    botnav.style.display = 'flex';
    actualizarBotnav();
    
    switch (currentView) {
        case 'panel':         main.innerHTML = renderPanel(); break;
        case 'clientes':      
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderClientes(); 
            break;
        case 'detalle':       
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderDetalleCliente(); 
            break;
        case 'historial':     
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderHistorial(); 
            break;
        case 'equipos':       
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderEquipos(); 
            break;
        case 'servicios':     
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderServicios(); 
            if (typeof aplicarFiltros === 'function') aplicarFiltros();
            break;
        case 'mantenimientos':
            if (!sesionActual) { main.innerHTML = renderAccesoDenegado(); break; }
            main.innerHTML = renderMantenimientos(); 
            break;
        case 'tecnicos':      main.innerHTML = renderTecnicos(); break;
        default:              main.innerHTML = renderPanel();
    }
}

function renderAccesoDenegado() {
    return `
    <div class="page" style="text-align:center; padding:2rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
        <h3 style="color:var(--green); margin-bottom:0.5rem;">Acceso restringido</h3>
        <p style="color:var(--muted); font-size:0.85rem; margin-bottom:1.5rem;">
            Inicia sesión desde el menú <strong>Técnicos</strong> para acceder a esta sección.
        </p>
        <button class="btn btn-blue" onclick="goTo('tecnicos')">
            Ir a Técnicos → 
        </button>
    </div>`;
}

// ===== PANEL =====
function renderPanel() {
    const año = new Date().getFullYear();
    const mes = getMesActual();
    const man = servicios.filter(s => s.tipo === 'Mantenimiento');
    const rep = servicios.filter(s => s.tipo === 'Reparación');
    const inst = servicios.filter(s => s.tipo === 'Instalación');
    const manM = man.filter(s => s.fecha?.startsWith(mes));
    const repM = rep.filter(s => s.fecha?.startsWith(mes));
    const instM = inst.filter(s => s.fecha?.startsWith(mes));
    const nuevosDelMes = clientes.filter(c => c.fechaCreacion?.startsWith(mes)).length;

    return `<div class="page">
        <div class="panel-banner">
            <div class="panel-banner-sub">Plantas y Sistemas Eléctricos</div>
            <div class="panel-banner-title">Panel Principal</div>
        </div>
        <div class="panel-grid">
            <div class="panel-col">
                <div class="panel-col-head">Clientes</div>
                <div class="panel-box gold-box">
                    <div class="panel-box-num">${clientes.length}</div>
                    <div class="panel-box-lbl">TOTALES</div>
                </div>
                <div class="panel-box gold-box">
                    <div class="panel-box-num">${nuevosDelMes}</div>
                    <div class="panel-box-lbl">NUEVOS MES</div>
                </div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box anual-box">
                    <div class="panel-box-lbl">ANUAL</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${man.length}</div>
                    <div class="panel-box-lbl">MANTENIMIENTO</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${rep.length}</div>
                    <div class="panel-box-lbl">REPARACIÓN</div>
                </div>
                <div class="panel-box anual-box">
                    <div class="panel-box-num">${inst.length}</div>
                    <div class="panel-box-lbl">INSTALACIÓN</div>
                </div>
            </div>
            <div class="panel-col">
                <div class="panel-col-head">Servicio</div>
                <div class="panel-box header-box mensual-box">
                    <div class="panel-box-lbl">MENSUAL</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${manM.length}</div>
                    <div class="panel-box-lbl">MANTENIMIENTO</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${repM.length}</div>
                    <div class="panel-box-lbl">REPARACIÓN</div>
                </div>
                <div class="panel-box mensual-box">
                    <div class="panel-box-num">${instM.length}</div>
                    <div class="panel-box-lbl">INSTALACIÓN</div>
                </div>
            </div>
        </div>
    </div>`;
}

// ===== CLIENTES =====
function renderClientes() {
    return `<div class="page">
        <div class="sec-head">
            <h2>Clientes (${clientes.length})</h2>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoCliente()">+ Nuevo</button>
        </div>
        <input class="search" placeholder="🔍 Buscar por nombre, ciudad, teléfono..."
            oninput="filtrarClientes(this.value)" id="searchClientes">
        <div id="clientesGrid">
            ${clientes.map(c => `
            <div class="cc" data-search="${(c.nombre + c.ciudad + c.telefono + (c.email || '')).toLowerCase()}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div class="cc-name">${c.nombre}</div>
                    <div style="display:flex;gap:4px;">
                        ${esAdmin() ? `<button class="ib" onclick="modalEditarCliente('${c.id}')">✏️</button>
                        <button class="ib" onclick="modalEliminarCliente('${c.id}')">🗑️</button>` : ''}
                    </div>
                </div>
                <div class="cc-row">📞 ${c.telefono}</div>
                ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
                <div class="cc-row">📍 ${c.direccion}</div>
                <span class="city-tag">${c.ciudad}</span>
                ${c.latitud ? `<div style="margin-top:4px;"><a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver GPS</a></div>` : ''}
                <div class="cc-meta">${getEquiposCliente(c.id).length} activo(s) · ${getServiciosCliente(c.id).length} servicio(s)</div>
                <button class="link-btn" onclick="goTo('detalle','${c.id}')">Ver activos y servicios →</button>
            </div>`).join('')}
        </div>
    </div>`;
}

function filtrarClientes(v) {
    const txt = v.toLowerCase();
    document.querySelectorAll('#clientesGrid .cc').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(txt) ? '' : 'none';
    });
}

// ===== DETALLE CLIENTE =====
function renderDetalleCliente() {
    const c = getCl(selectedClienteId);
    if (!c) { goTo('clientes'); return ''; }
    const eqs = getEquiposCliente(c.id);
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('clientes')">← Volver</button>
            <div>
                <div style="font-size:0.92rem;font-weight:700;">${c.nombre}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${c.ciudad}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="cc-row">📞 <strong>${c.telefono}</strong></div>
            ${c.email ? `<div class="cc-row">📧 ${c.email}</div>` : ''}
            <div class="cc-row">📍 ${c.direccion}</div>
            ${c.latitud ? `<a class="map-link" href="https://maps.google.com/?q=${c.latitud},${c.longitud}" target="_blank">🗺️ Ver en Google Maps</a>`
                : '<div style="font-size:0.72rem;color:var(--hint);">Sin GPS registrado</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
            <span style="font-size:0.9rem;font-weight:700;">Activos (${eqs.length})</span>
            <button class="btn btn-blue btn-sm" onclick="modalNuevoEquipo('${c.id}')">+ Activo</button>
        </div>
        ${eqs.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin activos. Agrega uno.</p>' : ''}
        ${eqs.map(e => `
        <div class="ec">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div class="ec-name">${e.marca} ${e.modelo}</div>
                    <div class="ec-meta">📍 ${e.ubicacion} · Serie: ${e.serie || 'S/N'}</div>
                    <div class="ec-meta">${getServiciosEquipo(e.id).length} servicio(s) registrado(s)</div>
                </div>
                <div style="display:flex;gap:4px;">
                    ${esAdmin() ? `<button class="ib" onclick="modalEditarEquipo('${e.id}')">✏️</button>
                    <button class="ib" onclick="modalEliminarEquipo('${e.id}')">🗑️</button>` : ''}
                </div>
            </div>
            <div class="ec-btns">
                <button class="ab" onclick="goTo('historial','${c.id}','${e.id}')">📋 Servicios</button>
                <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo servicio</button>
                <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                <button class="ab" onclick="modalQR('${e.id}')">📱 QR</button>
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== HISTORIAL =====
function renderHistorial() {
    const e = getEq(selectedEquipoId);
    if (!e) { goTo('clientes'); return ''; }
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(e.id).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return `<div class="page">
        <div class="det-hdr">
            <button class="back" onclick="goTo('detalle','${e.clienteId}')">← Volver</button>
            <div>
                <div style="font-size:0.88rem;font-weight:700;">${e.marca} ${e.modelo}</div>
                <div style="font-size:0.72rem;color:var(--hint);">${e.ubicacion} · ${c?.nombre}</div>
            </div>
        </div>
        <div style="margin-bottom:0.65rem;">
            <span style="font-size:0.88rem;font-weight:700;">Historial (${ss.length})</span>
        </div>
        ${ss.length === 0 ? '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1rem;">Sin servicios registrados.</p>' : ''}
        ${ss.map(s => `
        <div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo === 'Mantenimiento' ? 'b-blue' : s.tipo === 'Reparación' ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
                    ${puedeEditar(s.tecnico) ? `<button class="ib" style="padding:3px 7px;min-height:28px;" onclick="modalEditarServicio('${s.id}')">✏️</button>` : ''}
                    ${esAdmin() ? `<button class="ib" style="padding:3px 7px;min-height:28px;" onclick="eliminarServicio('${s.id}')">🗑️</button>` : ''}
                </div>
            </div>
            <div class="si-info">🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.78rem;color:var(--gold);margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
            <div class="fotos-strip">
                ${(s.fotos || []).map(f => `<img class="fthumb" src="${f}" loading="lazy">`).join('')}
                ${!(s.fotos || []).length ? '<span style="font-size:0.72rem;color:var(--hint);">Sin fotos</span>' : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

// ===== EQUIPOS =====
function renderEquipos() {
    return `<div class="page">
        <div class="sec-head"><h2>Activos (${equipos.length})</h2></div>
        <input class="search" placeholder="🔍 Buscar activo o cliente..." oninput="filtrarEquipos(this.value)" id="searchEq">
        <div id="equiposGrid">
        ${equipos.map(e => {
            const c = getCl(e.clienteId);
            return `<div class="ec" data-search="${(e.marca + e.modelo + (c?.nombre || '')).toLowerCase()}">
                <div class="ec-name">${e.marca} ${e.modelo}</div>
                <div class="ec-meta">👤 ${c?.nombre || 'Sin cliente'} · 📍 ${e.ubicacion}</div>
                <div class="ec-btns">
                    <button class="ab" onclick="goTo('historial','${e.clienteId}','${e.id}')">📋 Servicios</button>
                    <button class="ab" onclick="modalNuevoServicio('${e.id}')">➕ Nuevo</button>
                    <button class="ab" onclick="generarInformePDF('${e.id}')">📄 PDF</button>
                </div>
            </div>`;
        }).join('')}
        </div>
    </div>`;
}

function filtrarEquipos(v) {
    document.querySelectorAll('#equiposGrid .ec').forEach(c => {
        c.style.display = (c.dataset.search || '').includes(v.toLowerCase()) ? '' : 'none';
    });
}

// ===== SERVICIOS =====
function renderServicios() {
    const años = [...new Set(servicios.map(s => s.fecha?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `<div class="page">
        <div class="sec-head"><h2>Servicios</h2></div>
        <div class="filtros">
            <select class="fi" id="fAnio"><option value="">Todos los años</option>${años.map(a => `<option>${a}</option>`).join('')}</select>
            <select class="fi" id="fMes"><option value="">Todos los meses</option>${meses.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}</select>
            <select class="fi" id="fTipo"><option value="">Todos los tipos</option><option>Mantenimiento</option><option>Reparación</option><option>Instalación</option></select>
            <select class="fi" id="fCliente"><option value="">Todos los clientes</option>${clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
            <select class="fi" id="fTecnico"><option value="">Todos los técnicos</option>${tecnicos.map(t => `<option>${t.nombre}</option>`).join('')}</select>
            <button class="btn btn-blue btn-full" onclick="aplicarFiltros()">Aplicar filtros</button>
            <button class="btn btn-gray btn-full" onclick="limpiarFiltros()">Limpiar filtros</button>
        </div>
        <div id="listaServicios"></div>
    </div>`;
}

function aplicarFiltros() {
    const anio = document.getElementById('fAnio')?.value || '';
    const mes = document.getElementById('fMes')?.value || '';
    const tipo = document.getElementById('fTipo')?.value || '';
    const cid = document.getElementById('fCliente')?.value || '';
    const tec = document.getElementById('fTecnico')?.value || '';
    let filtrados = [...servicios].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (anio) filtrados = filtrados.filter(s => s.fecha?.startsWith(anio));
    if (mes) filtrados = filtrados.filter(s => s.fecha?.slice(5, 7) === mes);
    if (tipo) filtrados = filtrados.filter(s => s.tipo === tipo);
    if (cid) filtrados = filtrados.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));
    if (tec) filtrados = filtrados.filter(s => s.tecnico === tec);
    const el = document.getElementById('listaServicios');
    if (!el) return;
    if (!filtrados.length) { el.innerHTML = '<p style="font-size:0.85rem;color:var(--hint);text-align:center;padding:1.5rem;">Sin resultados.</p>'; return; }
    el.innerHTML = filtrados.map(s => {
        const e = getEq(s.equipoId);
        const c = getCl(e?.clienteId);
        return `<div class="si">
            <div class="si-top">
                <span class="badge ${s.tipo === 'Mantenimiento' ? 'b-blue' : s.tipo === 'Reparación' ? 'b-red' : 'b-green'}">${s.tipo}</span>
                <span style="font-size:0.75rem;color:var(--hint);">${fmtFecha(s.fecha)}</span>
            </div>
            <div class="si-info">👤 ${c?.nombre || 'N/A'} · ${e?.marca || ''} ${e?.modelo || ''}</div>
            <div class="si-info">📍 ${e?.ubicacion || ''} · 🔧 ${s.tecnico}</div>
            <div class="si-info" style="color:#64748b;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.75rem;color:var(--gold);margin-top:2px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`;
    }).join('');
}

function limpiarFiltros() {
    ['fAnio', 'fMes', 'fTipo', 'fCliente', 'fTecnico'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    aplicarFiltros();
}

// ===== AGENDA =====
function renderMantenimientos() {
    const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const año = new Date().getFullYear();
    const mant = servicios.filter(s => s.proximoMantenimiento);
    return `<div class="page">
        <div class="sec-head"><h2>Agenda ${año}</h2></div>
        <div class="tbl-wrap">
            <table>
                <thead>
                    <tr><th>Mes</th><th>Fecha</th><th>Cliente</th><th>Activo</th><th></th></tr>
                </thead>
                <tbody>
                ${MESES.map((mes, idx) => {
                    const mp = String(idx + 1).padStart(2, '0');
                    const lista = mant.filter(m => m.proximoMantenimiento?.startsWith(`${año}-${mp}`));
                    if (!lista.length) return `<tr><td style="color:var(--hint);font-size:0.72rem;background:var(--bg2);">${mes}</td><td colspan="4" style="color:#cbd5e1;font-size:0.7rem;">—</td></tr>`;
                    return lista.map((m, i) => {
                        const e = getEq(m.equipoId);
                        const c = getCl(e?.clienteId);
                        return `<tr>
                            ${i === 0 ? `<td rowspan="${lista.length}" style="font-weight:700;font-size:0.75rem;background:var(--bg2);">${mes}</td>` : ''}
                            <td style="font-size:0.75rem;">${fmtFecha(m.proximoMantenimiento)}</td>
                            <td style="font-size:0.75rem;">${c?.nombre || 'N/A'}</td>
                            <td style="font-size:0.72rem;">${e ? `${e.marca} ${e.modelo}` : 'N/A'}</td>
                            <td><button class="rec-btn" onclick="modalRecordar('${e?.clienteId}', '${e?.id}', '${m.proximoMantenimiento}')">📱</button></td>
                        </tr>`;
                    }).join('');
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

// ===== TÉCNICOS (con login integrado) =====
function renderTecnicos() {
    if (!sesionActual) {
        return `
        <div class="page">
            <div class="login-highlight" style="background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%); border-radius: 20px; padding: 1.2rem; margin-bottom: 1rem; color: white;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div style="background: var(--gold); width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">🔑</div>
                    <div>
                        <div style="font-weight: 700; font-size: 1rem;">Iniciar sesión</div>
                        <div style="font-size: 0.7rem; opacity: 0.8;">Ingresa tus credenciales</div>
                    </div>
                </div>
                <label class="fl" style="color: #a5c9bb;">Cédula</label>
                <input class="fi" id="loginCedulaTec" placeholder="Número de cédula" type="number" style="margin-bottom: 12px; background: white;">
                <label class="fl" style="color: #a5c9bb;">Clave (4 dígitos)</label>
                <div class="pin-display" style="margin: 8px 0;">
                    <div class="pin-digit" id="pdTec0"></div>
                    <div class="pin-digit" id="pdTec1"></div>
                    <div class="pin-digit" id="pdTec2"></div>
                    <div class="pin-digit" id="pdTec3"></div>
                </div>
                <div class="numpad" style="margin-top: 8px;">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<div class="num-btn" onclick="pinPressTec(${n})">${n}</div>`).join('')}
                    <div class="num-btn del" onclick="pinDelTec()">⌫</div>
                    <div class="num-btn zero" onclick="pinPressTec(0)">0</div>
                    <div class="num-btn ok" onclick="doLoginTec()">✓</div>
                </div>
                <div id="loginMsgTec" style="margin-top: 10px;"></div>
                <button class="btn" style="width:100%; margin-top: 12px; background: var(--gold); color: var(--green); font-weight: 700;" onclick="doLoginTec()">Ingresar</button>
            </div>
            
            <div class="sec-head">
                <h2>Técnicos (${tecnicos.length})</h2>
            </div>
            ${tecnicos.map(t => {
                const esps = (t.especialidades || []).map(id => {
                    const esp = ESPECIALIDADES.find(e => e.id === id);
                    return esp ? esp.label : id;
                });
                return `<div class="ec" style="opacity:0.7;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <div>
                            <div class="ec-name">${t.nombre}</div>
                            <div class="ec-meta">${t.tipoDoc} · ${t.cedula}</div>
                            <div class="ec-meta">${t.cargo}</div>
                        </div>
                        <span class="tc-rol-badge ${t.rol === 'admin' ? 'rol-admin' : 'rol-tec'}">${t.rol === 'admin' ? 'Admin' : 'Técnico'}</span>
                    </div>
                    <div style="margin-bottom:4px;">${esps.map(e => `<span class="esp-chip">${e}</span>`).join('')}</div>
                    <div style="font-size:0.72rem; color:var(--muted);">📍 ${t.region || 'Sin región'}</div>
                    <div style="margin-top:8px;">
                        <div class="btn btn-gray btn-sm btn-full" style="background:#e2e8f0; cursor:not-allowed; opacity:0.6;">🔒 Inicia sesión para acceder</div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }
    
    // CON SESIÓN
    return `
    <div class="page">
        <div class="sec-head">
            <h2>Técnicos (${tecnicos.length})</h2>
            ${esAdmin() ? `<button class="btn btn-blue btn-sm" onclick="modalNuevoTecnico()">+ Nuevo</button>` : ''}
        </div>
        ${tecnicos.map(t => {
            const esps = (t.especialidades || []).map(id => {
                const esp = ESPECIALIDADES.find(e => e.id === id);
                return esp ? esp.label : id;
            });
            return `<div class="ec">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                        <div class="ec-name">${t.nombre}</div>
                        <div class="ec-meta">${t.tipoDoc} · ${t.cedula}</div>
                        <div class="ec-meta">${t.cargo}</div>
                        <div class="ec-meta">📞 ${t.telefono}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span class="tc-rol-badge ${t.rol === 'admin' ? 'rol-admin' : 'rol-tec'}">${t.rol === 'admin' ? 'Admin' : 'Técnico'}</span>
                        <div style="display:flex; gap:4px;">
                            ${esAdmin() ? `<button class="ib" onclick="modalEditarTecnico('${t.id}')">✏️</button>
                            <button class="ib" onclick="eliminarTecnico('${t.id}')">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
                <div style="margin-bottom:4px;">${esps.map(e => `<span class="esp-chip">${e}</span>`).join('')}</div>
                <div style="font-size:0.72rem; color:var(--muted);">📍 ${t.region || 'Sin región asignada'}</div>
                <div style="margin-top:8px;">
                    <button class="btn btn-blue btn-sm btn-full" onclick="cambiarSesion('${t.id}')">🔑 Ingresar como ${t.nombre.split(' ')[0]}</button>
                </div>
            </div>`;
        }).join('')}
        
        ${esAdmin() ? `
        <div style="margin-top:1.2rem; background:white; border:0.5px solid var(--border); border-radius:12px; overflow:hidden;">
            <div style="background:#1e3a6e; padding:0.7rem 1rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:0.88rem; font-weight:700; color:white;">🏪 Tiendas Jerónimo Martins</div>
                    <div style="font-size:0.68rem; color:#93c5fd; margin-top:2px;">Tabla activa: ${JMC_TIENDAS_VERSION}</div>
                </div>
                <span style="background:#c9a227; color:#1e3a6e; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:3px;">${JMC_TIENDAS.length} tiendas</span>
            </div>
            <div style="padding:0.85rem;">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <label class="btn btn-blue btn-sm" style="cursor:pointer; min-height:38px; display:inline-flex; align-items:center;">
                        📥 Subir CSV actualizado
                        <input type="file" accept=".csv" style="display:none;" onchange="subirCSVJMC(this)">
                    </label>
                    <button class="btn btn-gray btn-sm" onclick="descargarPlantillaCSV()">📄 Descargar plantilla</button>
                </div>
                ${JMC_TIENDAS.length > 0 ? `
                <div style="margin-top:0.75rem; overflow-x:auto; border-radius:8px; border:0.5px solid var(--border);">
                    <table style="width:100%; border-collapse:collapse; font-size:0.68rem;">
                        <thead>
                            <tr style="background:var(--bg2);">
                                <th style="padding:5px 8px; text-align:left;">SAP</th>
                                <th style="padding:5px 8px; text-align:left;">Tienda</th>
                                <th style="padding:5px 8px; text-align:left;">Ciudad</th>
                                <th style="padding:5px 8px; text-align:left;">Coordinador</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${JMC_TIENDAS.map(t => `<tr style="border-bottom:0.5px solid var(--bg2);">
                                <td style="padding:4px 8px; font-weight:700; color:var(--green);">${t.sap}</td>
                                <td style="padding:4px 8px;">${t.tienda}</td>
                                <td style="padding:4px 8px;">${t.ciudad}</td>
                                <td style="padding:4px 8px;">${t.coordinador}</td>
                             </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
            </div>
        </div>` : ''}
    </div>`;
}

// ===== LOGIN DENTRO DE TÉCNICOS =====
let pinTecActual = '';

function resetPinTec() { pinTecActual = ''; updatePinDisplayTec(); }
function pinPressTec(n) {
    if (pinTecActual.length >= 4) return;
    pinTecActual += String(n);
    updatePinDisplayTec();
    if (pinTecActual.length === 4) doLoginTec();
}
function pinDelTec() {
    pinTecActual = pinTecActual.slice(0, -1);
    updatePinDisplayTec();
}
function updatePinDisplayTec() {
    for (let i = 0; i < 4; i++) {
        const d = document.getElementById('pdTec' + i);
        if (!d) return;
        d.className = 'pin-digit';
        if (i < pinTecActual.length) { d.textContent = '●'; d.classList.add('filled'); }
        else if (i === pinTecActual.length) { d.textContent = '_'; d.classList.add('active'); }
        else { d.textContent = ''; }
    }
}
function doLoginTec() {
    const cedula = document.getElementById('loginCedulaTec')?.value?.trim();
    const msg = document.getElementById('loginMsgTec');
    if (!cedula) {
        if (msg) msg.innerHTML = '<div class="login-warn">⚠️ Ingresa tu número de cédula</div>';
        return;
    }
    if (pinTecActual.length < 4) {
        if (msg) msg.innerHTML = '<div class="login-warn">⚠️ Ingresa tu clave de 4 dígitos</div>';
        return;
    }
    const tec = tecnicos.find(t => t.cedula === cedula && t.clave === pinTecActual);
    if (!tec) {
        if (msg) msg.innerHTML = '<div class="login-error">❌ Cédula o clave incorrecta</div>';
        pinTecActual = '';
        updatePinDisplayTec();
        return;
    }
    sesionActual = tec;
    pinTecActual = '';
    actualizarTopbar();
    actualizarBotnav();
    currentView = 'panel';
    renderView();
    toast(`✅ Bienvenido, ${tec.nombre.split(' ')[0]}`);
}

function cambiarSesion(tid) {
    const t = getTec(tid);
    if (!t) return;
    sesionActual = t;
    actualizarTopbar();
    actualizarBotnav();
    currentView = 'panel';
    renderView();
    toast(`✅ Cambiaste a: ${t.nombre.split(' ')[0]}`);
}

// ===== JMC TIENDAS =====
const JMC_ID = 'c3';
const JMC_TIENDAS = [
    { sap: '893', tienda: 'Villa del Rosario - Lomitas', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Anillo Vial No. 12 – 30 Lote 2', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '904', tienda: 'Villa del Rosario - Bellavista (QPRO)', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Carrera 7 No. 2-34/42', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '927', tienda: 'Villa del Rosario - La Palmita (QPRO)', ciudad: 'Villa del Rosario', departamento: 'Norte de Santander', direccion: 'Carrera 7 No. 16 - 48', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '947', tienda: 'Pamplona 4 de Julio (QPRO)', ciudad: 'Pamplona', departamento: 'Norte de Santander', direccion: 'Calle 8 No. 7 -102/104', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
    { sap: '1032', tienda: 'Malaga - Centro (QPRO)', ciudad: 'Malaga', departamento: 'Santander', direccion: 'Calle 11 No. 8 - 44', coordinador: 'Leny Grimaldos', cargo: 'Coordinador Sr Mantenimiento', telefono: '3102102100' },
];

let JMC_TIENDAS_VERSION = 'Enero 2026 (por defecto)';

function subirCSVJMC(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const lines = ev.target.result.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast('⚠️ CSV vacío o inválido'); return; }
        const nuevas = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length < 8 || !cols[0]) continue;
            nuevas.push({ sap: cols[0], tienda: cols[1], ciudad: cols[2], departamento: cols[3], direccion: cols[4], coordinador: cols[5], cargo: cols[6], telefono: cols[7] });
        }
        if (!nuevas.length) { toast('⚠️ No se encontraron tiendas válidas'); return; }
        const fechaActual = new Date().toISOString().split('T')[0];
        JMC_TIENDAS.length = 0;
        nuevas.forEach(t => JMC_TIENDAS.push(t));
        JMC_TIENDAS_VERSION = `${file.name.replace('.csv', '')} · ${fechaActual}`;
        input.value = '';
        renderView();
        toast(`✅ ${nuevas.length} tiendas cargadas correctamente`);
    };
    reader.readAsText(file, 'UTF-8');
}

function descargarPlantillaCSV() {
    const enc = 'SAP,TIENDA,CIUDAD,DEPARTAMENTO,DIRECCION,COORDINADOR,CARGO,TELEFONO';
    const filas = JMC_TIENDAS.length > 0
        ? JMC_TIENDAS.map(t => [t.sap, t.tienda, t.ciudad, t.departamento, t.direccion, t.coordinador, t.cargo, t.telefono].join(','))
        : ['893,Villa del Rosario - Lomitas,Villa del Rosario,Norte de Santander,Anillo Vial No. 12-30,Leny Grimaldos,Coordinador Sr Mantenimiento,3102102100'];
    const csv = [enc, ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'JMC_Tiendas_Plantilla.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📄 Plantilla descargada');
}

function esClienteJMC(clienteId) {
    return clienteId === JMC_ID;
}

function getTiendaJMC(sap) {
    return JMC_TIENDAS.find(t => t.sap === String(sap));
}

// ===== MODAL RECORDAR WHATSAPP =====
function modalRecordar(clienteId, equipoId, fecha) {
    const e = getEq(equipoId);
    const c = getCl(clienteId);
    const fechaF = fmtFechaLarga(fecha);
    const esJMC = esClienteJMC(clienteId);
    let tel, destinatario, msg;
    if (esJMC) {
        const sap = e?.ubicacion;
        const tienda = getTiendaJMC(sap);
        if (tienda) {
            tel = tienda.telefono;
            destinatario = `${tienda.coordinador} · SAP ${sap}`;
            msg = `Hola *${tienda.coordinador}*, le recordamos que el activo *${e?.marca} ${e?.modelo}* de la tienda *${tienda.tienda} (SAP ${sap})* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos si podemos agendar la visita técnica. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
        } else {
            tel = c?.telefono;
            destinatario = c?.nombre;
            msg = `Hola *${c?.nombre}*, le recordamos que el activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
        }
    } else {
        tel = c?.telefono;
        destinatario = c?.nombre;
        msg = `Hola *${c?.nombre}*, le recordamos que su activo *${e?.marca} ${e?.modelo}* ubicado en *${e?.ubicacion}* tiene programado un mantenimiento para el *${fechaF}*. Por favor confirmarnos si podemos agendar la visita técnica. Gracias — OLM Ingeniería SAS · Bogotá 📞 311 4831801`;
    }
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>📱 Recordatorio WhatsApp</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--muted);margin-bottom:0.6rem;">Para <strong>${destinatario}</strong> · 📞 ${tel}</div>
            <div class="wa-bubble">${msg}</div>
            <div style="font-size:0.75rem;color:var(--hint);margin-bottom:0.5rem;">Editar antes de enviar:</div>
            <textarea class="fi" id="waMsgEdit" rows="5">${msg}</textarea>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-wa" onclick="enviarWhatsApp('${tel}')">📱 Abrir WhatsApp</button>
            </div>
        </div>
    </div>`);
}

function enviarWhatsApp(tel) {
    const msg = document.getElementById('waMsgEdit')?.value || '';
    const telLimpio = '57' + tel.replace(/\D/g, '');
    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');
    closeModal();
    toast('📱 WhatsApp abierto');
}

// ===== NUEVO SERVICIO =====
function modalNuevoServicio(eid) {
    if (!sesionActual) { toast('🔑 Inicia sesión para continuar'); return; }
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const hoy = new Date().toISOString().split('T')[0];
    const esJMC = esClienteJMC(e?.clienteId);
    fotosNuevas[0] = fotosNuevas[1] = fotosNuevas[2] = null;

    const sapActual = esJMC ? e?.ubicacion : null;
    const tiendaJMC = sapActual ? getTiendaJMC(sapActual) : null;

    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div style="font-size:0.82rem;color:var(--hint);margin-bottom:0.65rem;background:var(--bg2);padding:0.55rem;border-radius:8px;">
                ${c?.nombre}<br><span style="font-size:0.75rem;">${e?.marca} ${e?.modelo} · 📍 ${e?.ubicacion}</span>
                ${tiendaJMC ? `<br><span style="font-size:0.72rem;color:var(--green);font-weight:600;">🏪 ${tiendaJMC.tienda} · ${tiendaJMC.ciudad}</span>` : ''}
            </div>
            <div class="fr">
                <div><label class="fl first">Tipo *</label>
                    <select class="fi" id="sTipo" onchange="onTipoChange()">
                        <option>Mantenimiento</option><option>Reparación</option><option>Instalación</option>
                    </select>
                </div>
                <div><label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="sFecha" value="${hoy}">
                </div>
            </div>
            <label class="fl">Técnico</label>
            <input class="fi" id="sTecnico" value="${sesionActual?.nombre || ''}" readonly style="background:#f0faf5;">
            ${esJMC ? `
            <div style="background:#f5f3ff;border:0.5px solid #c4b5fd;border-radius:10px;padding:0.65rem;margin-top:0.65rem;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:0.8rem;color:#5b21b6;flex:1;">📋 Informe técnico Jerónimo Martins</span>
                <button class="btn btn-sm" style="background:#7c3aed;color:white;min-height:36px;" onclick="modalInformeJMC('${eid}')">Abrir</button>
            </div>` : ''}
            <label class="fl">Diagnóstico / Descripción *</label>
            <textarea class="fi" id="sDesc" rows="3" placeholder="Trabajo realizado, observaciones..."></textarea>
            <div class="mant-box hidden" id="mantBox">
                <label class="fl first">📅 Próximo mantenimiento</label>
                <input class="fi" type="date" id="proxFecha">
            </div>
            <label class="fl" style="margin-top:0.7rem;">📷 Fotos (máx 3)</label>
            <div class="foto-row">
                ${[0, 1, 2].map(i => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <div class="fslot" id="fslot${i}" onclick="document.getElementById('finput${i}').click()">
                        <div class="fslot-plus">+</div>
                        <div class="fslot-lbl">Foto ${i + 1}</div>
                        <input type="file" id="finput${i}" accept="image/*" style="display:none" onchange="previewFoto(this,${i})">
                    </div>
                </div>`).join('')}
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarServicio('${eid}')">💾 Guardar</button>
            </div>
        </div>
    </div>`);
    onTipoChange();
}

function onTipoChange() {
    const tipo = document.getElementById('sTipo')?.value;
    const box = document.getElementById('mantBox');
    if (box) box.classList.toggle('hidden', tipo !== 'Mantenimiento');
}

function previewFoto(input, idx) {
    if (!input.files || !input.files[0]) return;
    fotosNuevas[idx] = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const slot = document.getElementById('fslot' + idx);
        if (slot) slot.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">
            <button class="fslot-del" onclick="borrarFoto(event,${idx})">✕</button>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
    };
    reader.readAsDataURL(input.files[0]);
}

function borrarFoto(e, idx) {
    e.stopPropagation();
    fotosNuevas[idx] = null;
    const slot = document.getElementById('fslot' + idx);
    if (slot) {
        slot.innerHTML = `<div class="fslot-plus">+</div><div class="fslot-lbl">Foto ${idx + 1}</div>
            <input type="file" id="finput${idx}" accept="image/*" style="display:none" onchange="previewFoto(this,${idx})">`;
        slot.onclick = () => document.getElementById('finput' + idx).click();
    }
}

async function guardarServicio(eid) {
    const desc = document.getElementById('sDesc')?.value?.trim();
    if (!desc) { toast('⚠️ Ingresa el diagnóstico'); return; }
    const tipo = document.getElementById('sTipo').value;
    const fecha = document.getElementById('sFecha').value;
    const prox = tipo === 'Mantenimiento' ? (document.getElementById('proxFecha')?.value || null) : null;
    try {
        await addDoc(collection(db, 'servicios'), { equipoId: eid, tipo, fecha, tecnico: sesionActual?.nombre || '', descripcion: desc, proximoMantenimiento: prox, fotos: [] });
        closeModal(); await cargarDatos();
        const e = getEq(eid); if (e) goTo('historial', e.clienteId, eid);
        toast('✅ Servicio guardado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEditarServicio(sid) {
    const s = servicios.find(x => x.id === sid);
    if (!s) return;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar servicio</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Tipo *</label>
                    <select class="fi" id="esTipo">
                        <option ${s.tipo === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                        <option ${s.tipo === 'Reparación' ? 'selected' : ''}>Reparación</option>
                        <option ${s.tipo === 'Instalación' ? 'selected' : ''}>Instalación</option>
                    </select>
                </div>
                <div><label class="fl first">Fecha *</label>
                    <input class="fi" type="date" id="esFecha" value="${s.fecha}">
                </div>
            </div>
            <label class="fl">Diagnóstico *</label>
            <textarea class="fi" id="esDesc" rows="3">${s.descripcion}</textarea>
            <label class="fl">Próximo mantenimiento</label>
            <input class="fi" type="date" id="esProx" value="${s.proximoMantenimiento || ''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarServicio('${sid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarServicio(sid) {
    const tipo = document.getElementById('esTipo')?.value;
    const fecha = document.getElementById('esFecha')?.value;
    const desc = document.getElementById('esDesc')?.value?.trim();
    const prox = document.getElementById('esProx')?.value || null;
    try {
        await updateDoc(doc(db, 'servicios', sid), { tipo, fecha, descripcion: desc || '', proximoMantenimiento: prox });
        closeModal(); await cargarDatos(); toast('✅ Servicio actualizado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

async function eliminarServicio(sid) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await deleteDoc(doc(db, 'servicios', sid)); await cargarDatos(); toast('🗑️ Servicio eliminado'); }
    catch (err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD CLIENTES =====
function modalNuevoCliente() {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre / Empresa *</label>
            <input class="fi" id="cNombre" placeholder="Ej: Empresa ABC SAS">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="cTel" type="tel" placeholder="31XXXXXXXX"></div>
                <div><label class="fl">Email</label><input class="fi" id="cEmail" type="email" placeholder="correo@..."></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="cCiudad"><option value="">Seleccionar...</option>${CIUDADES.map(ci => `<option>${ci}</option>`).join('')}</select>
            <label class="fl">Dirección *</label>
            <input class="fi" id="cDir" placeholder="Calle, carrera, barrio">
            <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:10px;padding:0.65rem;margin-top:0.5rem;">
                <div style="font-size:0.82rem;font-weight:700;margin-bottom:6px;">📍 Ubicación GPS</div>
                <button class="btn btn-blue btn-full" onclick="obtenerGPS()" style="min-height:46px;">Compartir ubicación actual</button>
                <div id="gpsInfo" style="font-size:0.72rem;color:var(--hint);margin-top:4px;"></div>
                <input type="hidden" id="cLat"><input type="hidden" id="cLng">
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarCliente()">Guardar</button>
            </div>
        </div>
    </div>`);
}

function obtenerGPS() {
    const btn = document.querySelector('[onclick="obtenerGPS()"]');
    if (btn) btn.textContent = '⏳ Obteniendo...';
    if (!navigator.geolocation) { toast('⚠️ GPS no disponible'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById('cLat').value = lat;
        document.getElementById('cLng').value = lng;
        document.getElementById('gpsInfo').innerHTML = `✅ ${lat}, ${lng} · <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" style="color:var(--green);">Ver mapa</a>`;
        if (btn) btn.textContent = '✅ Ubicación guardada';
    }, () => { toast('⚠️ No se pudo obtener GPS'); if (btn) btn.textContent = 'Compartir ubicación actual'; });
}

async function guardarCliente() {
    const n = document.getElementById('cNombre')?.value?.trim();
    const t = document.getElementById('cTel')?.value?.trim();
    const ci = document.getElementById('cCiudad')?.value;
    const d = document.getElementById('cDir')?.value?.trim();
    if (!n || !t || !ci || !d) { toast('⚠️ Complete los campos obligatorios (*)'); return; }
    try {
        await addDoc(collection(db, 'clientes'), {
            nombre: n, telefono: t, ciudad: ci, direccion: d,
            email: document.getElementById('cEmail')?.value || '',
            latitud: document.getElementById('cLat')?.value || null,
            longitud: document.getElementById('cLng')?.value || null,
            fechaCreacion: new Date().toISOString().split('T')[0]
        });
        closeModal(); await cargarDatos(); toast('✅ Cliente guardado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEditarCliente(cid) {
    const c = getCl(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="eNombre" value="${c.nombre}">
            <div class="fr">
                <div><label class="fl">Teléfono *</label><input class="fi" id="eTel" value="${c.telefono}" type="tel"></div>
                <div><label class="fl">Email</label><input class="fi" id="eEmail" value="${c.email || ''}"></div>
            </div>
            <label class="fl">Ciudad *</label>
            <select class="fi" id="eCiudad">${CIUDADES.map(ci => `<option ${ci === c.ciudad ? 'selected' : ''}>${ci}</option>`).join('')}</select>
            <label class="fl">Dirección *</label><input class="fi" id="eDir" value="${c.direccion}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarCliente('${cid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarCliente(cid) {
    try {
        await updateDoc(doc(db, 'clientes', cid), {
            nombre: document.getElementById('eNombre').value,
            telefono: document.getElementById('eTel').value,
            email: document.getElementById('eEmail').value,
            ciudad: document.getElementById('eCiudad').value,
            direccion: document.getElementById('eDir').value
        });
        closeModal(); await cargarDatos(); toast('✅ Cliente actualizado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarCliente(cid) {
    const c = getCl(cid);
    const eqs = getEquiposCliente(cid);
    const ss = getServiciosCliente(cid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar cliente</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${c.nombre}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${eqs.length} activo(s)</strong> y <strong>${ss.length} servicio(s)</strong>.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarCliente('${cid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarCliente(cid) {
    const eids = getEquiposCliente(cid).map(e => e.id);
    try {
        await Promise.all([
            ...servicios.filter(s => eids.includes(s.equipoId)).map(s => deleteDoc(doc(db, 'servicios', s.id))),
            ...eids.map(id => deleteDoc(doc(db, 'equipos', id))),
            deleteDoc(doc(db, 'clientes', cid))
        ]);
        closeModal(); goTo('clientes'); await cargarDatos(); toast('🗑️ Cliente eliminado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD EQUIPOS =====
function modalNuevoEquipo(cid) {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="qMarca" placeholder="ABB, Siemens..."></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="qModelo" placeholder="TX-400..."></div>
            </div>
            <label class="fl">N° de serie</label><input class="fi" id="qSerie" placeholder="Opcional">
            <label class="fl">Ubicación *</label><input class="fi" id="qUbic" placeholder="Ej: Sala eléctrica principal">
            <label class="fl">Tipo de activo</label><input class="fi" id="qTipo" placeholder="Transformador, Planta eléctrica...">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarEquipo('${cid}')">Guardar</button>
            </div>
        </div>
    </div>`);
}

async function guardarEquipo(cid) {
    const m = document.getElementById('qMarca')?.value?.trim();
    const mo = document.getElementById('qModelo')?.value?.trim();
    const se = document.getElementById('qSerie')?.value?.trim();
    const u = document.getElementById('qUbic')?.value?.trim();
    const ti = document.getElementById('qTipo')?.value?.trim();
    if (!m || !mo || !u) { toast('⚠️ Complete marca, modelo y ubicación'); return; }
    try {
        await addDoc(collection(db, 'equipos'), { clienteId: cid, marca: m, modelo: mo, serie: se || '', ubicacion: u, tipo: ti || '' });
        closeModal(); await cargarDatos(); toast('✅ Activo guardado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEditarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="fr">
                <div><label class="fl first">Marca *</label><input class="fi" id="eMarca" value="${eq.marca}"></div>
                <div><label class="fl first">Modelo *</label><input class="fi" id="eModelo" value="${eq.modelo}"></div>
            </div>
            <label class="fl">N° de serie</label><input class="fi" id="eSerie" value="${eq.serie || ''}">
            <label class="fl">Ubicación *</label><input class="fi" id="eUbic" value="${eq.ubicacion}">
            <label class="fl">Tipo de activo</label><input class="fi" id="eTipoEq" value="${eq.tipo || ''}">
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarEquipo('${eid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
}

async function actualizarEquipo(eid) {
    try {
        await updateDoc(doc(db, 'equipos', eid), {
            marca: document.getElementById('eMarca').value,
            modelo: document.getElementById('eModelo').value,
            serie: document.getElementById('eSerie').value,
            ubicacion: document.getElementById('eUbic').value,
            tipo: document.getElementById('eTipoEq').value
        });
        closeModal(); await cargarDatos(); toast('✅ Activo actualizado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEliminarEquipo(eid) {
    const eq = getEq(eid);
    if (!eq) return;
    const ss = getServiciosEquipo(eid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Eliminar activo</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <div class="confirm-box">
                <p>⚠️ ¿Eliminar <strong>${eq.marca} ${eq.modelo}</strong>?</p>
                <p style="margin-top:5px;">Se eliminarán también <strong>${ss.length} servicio(s)</strong>.</p>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-red" onclick="eliminarEquipo('${eid}')">🗑️ Sí, eliminar</button>
            </div>
        </div>
    </div>`);
}

async function eliminarEquipo(eid) {
    const eq = getEq(eid);
    try {
        await Promise.all([
            ...servicios.filter(s => s.equipoId === eid).map(s => deleteDoc(doc(db, 'servicios', s.id))),
            deleteDoc(doc(db, 'equipos', eid))
        ]);
        closeModal(); await cargarDatos(); goTo('detalle', eq?.clienteId || selectedClienteId); toast('🗑️ Activo eliminado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

// ===== CRUD TÉCNICOS =====
function modalNuevoTecnico() {
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Nuevo técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre completo *</label>
            <input class="fi" id="tNombre" placeholder="Nombre Apellido">
            <div class="fr">
                <div><label class="fl">Tipo doc *</label>
                    <select class="fi" id="tTipoDoc">${TIPOS_DOC.map(d => `<option>${d}</option>`).join('')}</select>
                </div>
                <div><label class="fl">N° documento *</label>
                    <input class="fi" id="tCedula" placeholder="00000000" type="number">
                </div>
            </div>
            <label class="fl">Teléfono *</label><input class="fi" id="tTel" type="tel" placeholder="31XXXXXXXX">
            <label class="fl">Cargo *</label><input class="fi" id="tCargo" placeholder="Técnico de Campo...">
            <label class="fl">Rol *</label>
            <select class="fi" id="tRol"><option value="tecnico">Técnico</option><option value="admin">Admin</option></select>
            <label class="fl">Especialidades *</label>
            <div id="tEspContainer">
                ${ESPECIALIDADES.map(e => `
                <div class="esp-option" id="esp_${e.id}" onclick="toggleEsp('${e.id}')">
                    <div class="esp-cb" id="ecb_${e.id}"></div>
                    <span class="esp-lbl">${e.label}</span>
                </div>`).join('')}
            </div>
            <label class="fl">Región que atiende</label>
            <input class="fi" id="tRegion" placeholder="Bogotá, Cundinamarca...">
            <div class="fr" style="margin-top:6px;">
                <div><label class="fl first">Clave (4 dígitos) *</label>
                    <input class="fi" id="tClave" type="password" maxlength="4" placeholder="••••">
                </div>
                <div><label class="fl first">Confirmar clave *</label>
                    <input class="fi" id="tClave2" type="password" maxlength="4" placeholder="••••">
                </div>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="guardarTecnico()">Guardar</button>
            </div>
        </div>
    </div>`);
    window._espSel = [];
}

function toggleEsp(id) {
    window._espSel = window._espSel || [];
    const idx = window._espSel.indexOf(id);
    if (idx >= 0) window._espSel.splice(idx, 1); else window._espSel.push(id);
    const el = document.getElementById('esp_' + id);
    const cb = document.getElementById('ecb_' + id);
    if (el) el.classList.toggle('selected', window._espSel.includes(id));
    if (cb) cb.classList.toggle('on', window._espSel.includes(id));
}

async function guardarTecnico() {
    const n = document.getElementById('tNombre')?.value?.trim();
    const cc = document.getElementById('tCedula')?.value?.trim();
    const cl = document.getElementById('tClave')?.value?.trim();
    const tel = document.getElementById('tTel')?.value?.trim();
    const car = document.getElementById('tCargo')?.value?.trim();
    const rol = document.getElementById('tRol')?.value || 'tecnico';
    const reg = document.getElementById('tRegion')?.value?.trim();
    const esps = window._espSel || [];
    if (!n || !cc || !cl) { toast('⚠️ Nombre, cédula y clave obligatorios'); return; }
    if (cl.length !== 4) { toast('⚠️ Clave de 4 dígitos'); return; }
    if (tecnicos.find(t => t.cedula === cc)) { toast('⚠️ Cédula ya existe'); return; }
    try {
        await addDoc(collection(db, 'tecnicos'), {
            nombre: n, cedula: cc,
            tipoDoc: document.getElementById('tTipoDoc')?.value || 'CC',
            telefono: tel || '', cargo: car || '', rol, especialidades: esps, region: reg || '', clave: cl
        });
        closeModal(); await cargarDatos(); toast('✅ Técnico guardado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

function modalEditarTecnico(tid) {
    const t = getTec(tid);
    showModal(`<div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Editar técnico</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
        <div class="modal-b">
            <label class="fl first">Nombre *</label><input class="fi" id="etNombre" value="${t.nombre}">
            <div class="fr">
                <div><label class="fl">Tipo doc</label>
                    <select class="fi" id="etTipoDoc">${TIPOS_DOC.map(d => `<option ${d === t.tipoDoc ? 'selected' : ''}>${d}</option>`).join('')}</select>
                </div>
                <div><label class="fl">N° documento</label><input class="fi" id="etCedula" value="${t.cedula}"></div>
            </div>
            <label class="fl">Teléfono</label><input class="fi" id="etTel" value="${t.telefono}" type="tel">
            <label class="fl">Cargo</label><input class="fi" id="etCargo" value="${t.cargo || ''}">
            <label class="fl">Rol</label>
            <select class="fi" id="etRol"><option value="tecnico" ${t.rol === 'tecnico' ? 'selected' : ''}>Técnico</option><option value="admin" ${t.rol === 'admin' ? 'selected' : ''}>Admin</option></select>
            <label class="fl">Especialidades</label>
            <div id="etEspContainer">
                ${ESPECIALIDADES.map(e => `
                <div class="esp-option ${(t.especialidades || []).includes(e.id) ? 'selected' : ''}" id="etesp_${e.id}" onclick="toggleEspEdit('${e.id}','${tid}')">
                    <div class="esp-cb ${(t.especialidades || []).includes(e.id) ? 'on' : ''}" id="etecb_${e.id}"></div>
                    <span class="esp-lbl">${e.label}</span>
                </div>`).join('')}
            </div>
            <label class="fl">Región</label><input class="fi" id="etRegion" value="${t.region || ''}">
            <label class="fl">Nueva clave (dejar vacío para no cambiar)</label>
            <div class="fr">
                <div><input class="fi" id="etClave" type="password" maxlength="4" placeholder="••••"></div>
                <div><input class="fi" id="etClave2" type="password" maxlength="4" placeholder="Confirmar"></div>
            </div>
            <div class="modal-foot">
                <button class="btn btn-gray" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-blue" onclick="actualizarTecnico('${tid}')">Guardar cambios</button>
            </div>
        </div>
    </div>`);
    window._espSelEdit = [...(t.especialidades || [])];
}

function toggleEspEdit(id) {
    window._espSelEdit = window._espSelEdit || [];
    const idx = window._espSelEdit.indexOf(id);
    if (idx >= 0) window._espSelEdit.splice(idx, 1); else window._espSelEdit.push(id);
    const el = document.getElementById('etesp_' + id);
    const cb = document.getElementById('etecb_' + id);
    if (el) el.classList.toggle('selected', window._espSelEdit.includes(id));
    if (cb) cb.classList.toggle('on', window._espSelEdit.includes(id));
}

async function actualizarTecnico(tid) {
    const cl = document.getElementById('etClave')?.value?.trim();
    const data = {
        nombre: document.getElementById('etNombre').value,
        telefono: document.getElementById('etTel').value,
        cargo: document.getElementById('etCargo').value,
        rol: document.getElementById('etRol')?.value || 'tecnico',
        region: document.getElementById('etRegion').value,
        especialidades: window._espSelEdit || []
    };
    if (cl && cl.length === 4) data.clave = cl;
    try {
        await updateDoc(doc(db, 'tecnicos', tid), data);
        closeModal(); await cargarDatos(); toast('✅ Técnico actualizado');
    } catch (err) { toast('❌ Error: ' + err.message); }
}

async function eliminarTecnico(tid) {
    if (!confirm('¿Eliminar este técnico?')) return;
    try { await deleteDoc(doc(db, 'tecnicos', tid)); await cargarDatos(); toast('🗑️ Técnico eliminado'); }
    catch (err) { toast('❌ Error: ' + err.message); }
}

// ===== PDF HISTORIAL =====
function generarInformePDF(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe_${e?.marca}_${e?.modelo}</title>
<style>
  @page{size:A4;margin:1.5cm 2cm} *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:0}
  .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0d4a3a;padding-bottom:10px;margin-bottom:12px}
  .brand{font-size:1.1rem;font-weight:700;color:#0d4a3a;letter-spacing:1px}
  .brand-sub{font-size:9px;color:#c9a227;font-weight:700}
  .contact{text-align:right;font-size:10px;color:#475569;line-height:1.6}
  .title{font-size:1rem;font-weight:700;color:#0d4a3a;text-align:center;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}
  .info-section{background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
  .info-item{font-size:11px} .info-item strong{color:#0f172a}
  .servicio{border:0.5px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:12px;page-break-inside:avoid}
  .serv-header{display:flex;justify-content:space-between;margin-bottom:6px}
  .tipo-badge{background:#d1ede0;color:#0d4a3a;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
  .tipo-badge.rep{background:#fee2e2;color:#dc2626} .tipo-badge.inst{background:#dcfce7;color:#16a34a}
  .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:0.5px solid #e2e8f0;padding-top:6px}
</style></head><body>
  <div class="hdr">
    <div><div class="brand">OLM INGENIERÍA SAS</div><div class="brand-sub">PLANTAS Y SISTEMAS ELÉCTRICOS</div></div>
    <div class="contact">Bogotá · NIT 901.050.468-5<br>📞 311 4831801<br>Oscar Leonardo Martínez</div>
  </div>
  <div class="title">Informe Técnico</div>
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item"><strong>Cliente:</strong> ${c?.nombre || 'N/A'}</div>
      <div class="info-item"><strong>Teléfono:</strong> ${c?.telefono || 'N/A'}</div>
      <div class="info-item"><strong>Dirección:</strong> ${c?.direccion || 'N/A'}</div>
      <div class="info-item"><strong>Ciudad:</strong> ${c?.ciudad || 'N/A'}</div>
      <div class="info-item"><strong>Activo:</strong> ${e?.marca || ''} ${e?.modelo || ''}</div>
      <div class="info-item"><strong>Serie:</strong> ${e?.serie || 'N/A'}</div>
      <div class="info-item"><strong>Ubicación:</strong> ${e?.ubicacion || 'N/A'}</div>
      <div class="info-item"><strong>Servicios:</strong> ${ss.length}</div>
    </div>
  </div>
  ${ss.map(s => `<div class="servicio">
    <div class="serv-header">
      <span class="tipo-badge ${s.tipo === 'Reparación' ? 'rep' : s.tipo === 'Instalación' ? 'inst' : ''}">${s.tipo}</span>
      <span style="font-size:11px;color:#64748b;">${fmtFechaLarga(s.fecha)}</span>
    </div>
    <p style="margin:3px 0;font-size:11px;"><strong>Técnico:</strong> ${s.tecnico}</p>
    <p style="margin:3px 0;font-size:11px;"><strong>Descripción:</strong> ${s.descripcion}</p>
    ${s.proximoMantenimiento ? `<p style="margin:3px 0;font-size:11px;color:#c9a227;"><strong>📅 Próximo:</strong> ${fmtFechaLarga(s.proximoMantenimiento)}</p>` : ''}
  </div>`).join('')}
  <div class="footer">OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos · ${new Date().toLocaleDateString('es-ES')}</div>
</body></html>`;
    const v = window.open('', '_blank');
    v.document.write(html);
    v.document.close();
    v.onload = () => { v.focus(); v.print(); };
    setTimeout(() => { try { v.focus(); v.print(); } catch (e) { } }, 800);
    toast('🖨️ Selecciona "Guardar como PDF" en la impresora');
}

// ===== QR =====
function modalQR(eid) {
    const e = getEq(eid);
    const c = getCl(e?.clienteId);
    const url = `${window.location.origin}${window.location.pathname}#/equipo/${eid}`;
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:260px;height:260px;';
    document.body.appendChild(qrDiv);
    const QRLib = window.QRCode;
    if (!QRLib) { toast('⚠️ Recarga la página'); document.body.removeChild(qrDiv); return; }
    new QRLib(qrDiv, { text: url, width: 260, height: 260, colorDark: '#0d4a3a', colorLight: '#ffffff', correctLevel: QRLib.CorrectLevel.M });
    setTimeout(() => {
        const qrCanvas = qrDiv.querySelector('canvas');
        const W = 380, H = 560;
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0d4a3a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(24, 10);
        ctx.lineTo(W - 24, 10);
        ctx.quadraticCurveTo(W - 10, 10, W - 10, 24);
        ctx.lineTo(W - 10, H - 24);
        ctx.quadraticCurveTo(W - 10, H - 10, W - 24, H - 10);
        ctx.lineTo(24, H - 10);
        ctx.quadraticCurveTo(10, H - 10, 10, H - 24);
        ctx.lineTo(10, 24);
        ctx.quadraticCurveTo(10, 10, 24, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#0d4a3a';
        ctx.beginPath();
        ctx.moveTo(W / 2 - 105 + 8, 18);
        ctx.lineTo(W / 2 + 105 - 8, 18);
        ctx.quadraticCurveTo(W / 2 + 105, 18, W / 2 + 105, 26);
        ctx.lineTo(W / 2 + 105, 76);
        ctx.lineTo(W / 2 - 105, 76);
        ctx.lineTo(W / 2 - 105, 26);
        ctx.quadraticCurveTo(W / 2 - 105, 18, W / 2 - 105 + 8, 18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c9a227';
        ctx.font = 'bold 20px Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OLM INGENIERÍA SAS', W / 2, 48);
        ctx.fillStyle = '#a5c9bb';
        ctx.font = '10px Arial,sans-serif';
        ctx.fillText('Plantas y Sistemas Eléctricos · Bogotá', W / 2, 66);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px Arial,sans-serif';
        ctx.fillText(`${e?.marca || ''} ${e?.modelo || ''}`, W / 2, 98);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial,sans-serif';
        ctx.fillText(`📍 ${e?.ubicacion || ''}`, W / 2, 116);
        if (c?.nombre) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px Arial,sans-serif';
            ctx.fillText(`👤 ${c.nombre}`, W / 2, 132);
        }
        if (qrCanvas) ctx.drawImage(qrCanvas, (W - 230) / 2, 142, 230, 230);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7px Arial,sans-serif';
        const mid = Math.floor(url.length / 2);
        ctx.fillText(url.slice(0, mid), W / 2, 384);
        ctx.fillText(url.slice(mid), W / 2, 394);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(28, 406);
        ctx.lineTo(W - 28, 406);
        ctx.stroke();
        ctx.fillStyle = '#0d4a3a';
        ctx.font = 'bold 30px Arial,sans-serif';
        ctx.fillText('311 483 1801', W / 2, 450);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Arial,sans-serif';
        ctx.fillText('📞 Línea de soporte OLM Ingeniería', W / 2, 468);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '8px Arial,sans-serif';
        ctx.fillText('OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos', W / 2, 520);
        document.body.removeChild(qrDiv);
        const dataUrl = cv.toDataURL('image/png');
        showModal(`<div class="modal" onclick="event.stopPropagation()" style="max-width:340px;">
            <div class="modal-h"><h3>📱 Código QR</h3><button class="xbtn" onclick="closeModal()">✕</button></div>
            <div class="modal-b" style="text-align:center;">
                <img src="${dataUrl}" style="width:100%;border-radius:8px;margin-bottom:1rem;" alt="QR">
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <a href="${dataUrl}" download="QR_${(e?.marca || '')}_${(e?.modelo || '')}.png" class="btn btn-blue btn-full" style="text-decoration:none;display:block;padding:0.6rem;border-radius:10px;">⬇️ Descargar imagen</a>
                    <button class="btn btn-gray btn-full" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        </div>`);
    }, 200);
}

// ===== VISTA PÚBLICA QR =====
function manejarRutaQR() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/equipo/')) return false;
    const eid = hash.replace('#/equipo/', '');
    const e = getEq(eid);
    if (!e) return false;
    const c = getCl(e.clienteId);
    const ss = getServiciosEquipo(eid).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const main = document.getElementById('mainContent');
    const topbar = document.querySelector('.topbar');
    const botnav = document.querySelector('.botnav');
    if (topbar) topbar.style.display = 'none';
    if (botnav) botnav.style.display = 'none';
    main.style.background = 'white';
    main.innerHTML = `<div style="max-width:600px;margin:0 auto;padding:1.5rem;">
        <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="font-size:1.2rem;font-weight:700;color:#0d4a3a;">OLM INGENIERÍA SAS</div>
            <div style="font-size:0.72rem;color:#64748b;">Bogotá · 📞 311 4831801</div>
        </div>
        <div style="background:#0d4a3a;border-radius:14px;padding:14px;text-align:center;margin-bottom:16px;">
            <div style="font-size:0.78rem;color:#a5c9bb;margin-bottom:4px;">¿Necesitas soporte? Llámanos</div>
            <div style="font-size:2rem;font-weight:700;color:white;letter-spacing:2px;">311 483 1801</div>
            <div style="font-size:0.78rem;color:#c9a227;margin-top:4px;font-weight:600;">OLM Ingeniería SAS · Bogotá</div>
        </div>
        <div style="border:0.5px solid #e2e8f0;border-radius:12px;padding:1rem;margin-bottom:1rem;background:#f8fafc;">
            <div style="font-size:1rem;font-weight:700;">⚡ ${e.marca} ${e.modelo}</div>
            <div style="font-size:0.82rem;color:#475569;margin-top:3px;">📍 ${e.ubicacion}</div>
            <div style="font-size:0.78rem;color:#475569;">👤 ${c?.nombre}</div>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">Serie: ${e.serie || 'N/A'}</div>
        </div>
        <div style="margin-bottom:1rem;">
            <button style="width:100%;background:#25D366;color:white;border:none;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;"
                onclick="window.open('https://wa.me/573114831801?text=${encodeURIComponent('Hola OLM Ingeniería, soy cliente de ' + (c?.nombre || '') + ' y tengo una novedad con el activo ' + (e?.marca || '') + ' ' + (e?.modelo || '') + ' ubicado en ' + (e?.ubicacion || '') + '. ¿Podrían apoyarme?')}','_blank')">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar por WhatsApp
            </button>
        </div>
        <div style="font-size:0.88rem;font-weight:700;margin-bottom:0.75rem;">Historial de servicios (${ss.length})</div>
        ${ss.map(s => `
        <div style="border:0.5px solid #d1ede0;border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;background:white;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="background:#d1ede0;color:#0d4a3a;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;">${s.tipo}</span>
                <span style="font-size:0.75rem;color:#94a3b8;">${fmtFecha(s.fecha)}</span>
            </div>
            <div style="font-size:0.82rem;color:#475569;">🔧 ${s.tecnico}</div>
            <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">${s.descripcion}</div>
            ${s.proximoMantenimiento ? `<div style="font-size:0.75rem;color:#c9a227;margin-top:3px;">📅 Próximo: ${fmtFecha(s.proximoMantenimiento)}</div>` : ''}
        </div>`).join('')}
        <div style="text-align:center;font-size:0.7rem;color:#94a3b8;margin-top:1rem;padding-top:0.75rem;border-top:0.5px solid #e2e8f0;">
            OLM Ingeniería SAS · Sistema de Gestión de Plantas y Sistemas Eléctricos
        </div>
    </div>`;
    return true;
}

// ===== EXPORTAR GLOBALS =====
window.goTo = goTo;
window.closeModal = closeModal;
window.filtrarClientes = filtrarClientes;
window.filtrarEquipos = filtrarEquipos;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.modalNuevoCliente = modalNuevoCliente;
window.modalEditarCliente = modalEditarCliente;
window.modalEliminarCliente = modalEliminarCliente;
window.guardarCliente = guardarCliente;
window.actualizarCliente = actualizarCliente;
window.eliminarCliente = eliminarCliente;
window.modalNuevoEquipo = modalNuevoEquipo;
window.guardarEquipo = guardarEquipo;
window.modalEditarEquipo = modalEditarEquipo;
window.actualizarEquipo = actualizarEquipo;
window.modalEliminarEquipo = modalEliminarEquipo;
window.eliminarEquipo = eliminarEquipo;
window.modalNuevoServicio = modalNuevoServicio;
window.guardarServicio = guardarServicio;
window.modalEditarServicio = modalEditarServicio;
window.actualizarServicio = actualizarServicio;
window.eliminarServicio = eliminarServicio;
window.modalNuevoTecnico = modalNuevoTecnico;
window.guardarTecnico = guardarTecnico;
window.modalEditarTecnico = modalEditarTecnico;
window.actualizarTecnico = actualizarTecnico;
window.eliminarTecnico = eliminarTecnico;
window.modalRecordar = modalRecordar;
window.enviarWhatsApp = enviarWhatsApp;
window.generarInformePDF = generarInformePDF;
window.modalQR = modalQR;
window.obtenerGPS = obtenerGPS;
window.previewFoto = previewFoto;
window.borrarFoto = borrarFoto;
window.onTipoChange = onTipoChange;
window.cerrarSesion = cerrarSesion;
window.toggleEsp = toggleEsp;
window.toggleEspEdit = toggleEspEdit;
window.pinPressTec = pinPressTec;
window.pinDelTec = pinDelTec;
window.doLoginTec = doLoginTec;
window.cambiarSesion = cambiarSesion;
window.subirCSVJMC = subirCSVJMC;
window.descargarPlantillaCSV = descargarPlantillaCSV;

// ===== INICIO =====
window.conectarDrive = conectarDrive;

(async () => {
    await sembrarDatos();
    await cargarDatos();
    
    initBotnavListeners();
    
    if (!manejarRutaQR()) {
        sesionActual = null;
        currentView = 'panel';
        actualizarTopbar();
        actualizarBotnav();
        renderView();
    }
})();