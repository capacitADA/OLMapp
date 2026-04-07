// ============================================
// OLM INGENIERÍA SAS - APP v2 Firebase + Drive
// ============================================

import { fsGetAll, fsAdd, fsUpdate, fsDelete, driveSignIn, driveIsConnected, driveUploadHTML } from "./firebase.js";

// ===== DATOS MOCK =====
// Datos en memoria — se cargan desde Firestore al iniciar
let clientes  = [];
let equipos   = [];
let servicios = [];
let tecnicos  = [];

// Cargar datos iniciales desde Firestore
async function cargarDatos() {
    try {
        [clientes, equipos, servicios, tecnicos] = await Promise.all([
            fsGetAll('clientes'),
            fsGetAll('equipos'),
            fsGetAll('servicios'),
            fsGetAll('tecnicos')
        ]);
        renderView();
    } catch(err) {
        console.error('Error cargando datos:', err);
        toast('⚠️ Error conectando con la base de datos');
    }
}

const ESPECIALIDADES = [
    { id: 'mecanico', label: 'Mecánico de plantas' },
    { id: 'baja',     label: 'Electricista baja tensión' },
    { id: 'media',    label: 'Electricista media tensión' },
];

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Bucaramanga', 'Barranquilla',
    'Cúcuta', 'Manizales', 'Pereira', 'Ibagué', 'Villavicencio',
    'Girón', 'Floridablanca', 'Piedecuesta', 'Pamplona', 'Soacha'];

const TIPOS_DOC = ['CC', 'CE', 'PA', 'NIT', 'TI'];

const EMPRESA = { nombre: 'OLM INGENIERÍA SAS', nit: '901.050.468-5', contacto: 'Oscar Leonardo Martínez', telefono: '311 4831801', ciudad: 'Bogotá' };

// ===== ESTADO =====
let currentView   = 'panel';
let sesionActual  = null; // { tecnico obj }
let selectedClienteId = null;
let selectedEquipoId  = null;
const fotosNuevas = [null, null, null];
const stExt = new Array(10).fill(false);
const stInt = new Array(10).fill(false);

const CK_EXT = ['LIMPIEZA GENERAL','REVISIÓN CONEXIONES','AJUSTE TORNILLERÍA',
    'REVISIÓN PROTECCIONES','CAMBIO DE CONTACTOR','CAMBIO CONDENSADOR',
    'CAMBIO CAPACITOR','REPARACIÓN DE FUGA','RECARGA DE GAS','REVISIÓN ACOMETIDA'];
const CK_INT = ['LIMPIEZA GENERAL','LIMPIEZA SERPENTINES','LIMPIEZA DRENAJES',
    'REPARACIÓN TARJETA','AJUSTE CORREAS','REPARACIÓN FUGA',
    'CAMBIO DE BLOWER','REPARACIÓN MOTOR','REVISIÓN ELÉCTRICA','OTROS'];

let _esidActual   = null;
let _fotosEditadas = [];

// ===== HELPERS =====
const getEq  = id => equipos.find(e => e.id === id);
const getCl  = id => clientes.find(c => c.id === id);
const getTec = id => tecnicos.find(t => t.id === id);
const getEquiposCliente  = cid => equipos.filter(e => e.clienteId === cid);
const getServiciosEquipo = eid => servicios.filter(s => s.equipoId === eid);
const getServiciosCliente = cid => servicios.filter(s => getEquiposCliente(cid).some(e => e.id === s.equipoId));

function genId() { return '_' + Math.random().toString(36).substr(2, 9); }

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
async function conectarDrive() {
    try {
        await driveSignIn();
        actualizarTopbar();
        toast('☁️ Drive conectado');
    } catch(e) {
        toast('❌ Error conectando Drive: ' + e);
    }
}

function actualizarTopbar() {
    const right = document.getElementById('topbarRight');
    if (!right) return;
    if (!sesionActual) {
        right.innerHTML = `<span class="topbar-user" id="topbarUser">Sin sesión</span>`;
    } else {
        const initials = sesionActual.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const rolBadge = esAdmin()
            ? `<span class="topbar-rol-badge">Admin</span>`
            : '';
        const driveBtn = driveIsConnected()
            ? `<span style="font-size:0.6rem;color:#4ade80;font-weight:700;">☁️ Drive</span>`
            : `<button class="topbar-salir" style="background:#1a73e8;" onclick="conectarDrive()">☁️ Drive</button>`;
        right.innerHTML = `
            <div class="topbar-sesion">
                <div class="topbar-avatar">${initials}</div>
                <div>
                    <div style="font-size:0.68rem;color:white;font-weight:700;line-height:1;">${sesionActual.nombre.split(' ')[0]}</div>
                    ${rolBadge}
                </div>
                ${driveBtn}
                <button class="topbar-salir" onclick="cerrarSesion()">Salir</button>
            </div>`;
    }
}

async function cerrarSesion() {
    sesionActual = null;
    clientes=[]; equipos=[]; servicios=[]; tecnicos=[];
    actualizarTopbar();
    renderView();
    toast('👋 Sesión cerrada');
}

// ===== NAVEGACIÓN =====
function goTo(view, cid = null, eid = null) {
    currentView = view;
    selectedClienteId = cid;
    selectedEquipoId  = eid;
    closeModal();
    renderView();
    document.querySelectorAll('.bni').forEach(b => {
        b.classList.toggle('active',
            b.dataset.page === view ||
            (view === 'detalle'   && b.dataset.page === 'clientes') ||
            (view === 'historial' && b.dataset.page === 'clientes'));
    });
}

// Menús disponibles sin sesión: panel y tecnicos

function renderView() {
    const main = document.getElementById('mainContent');
    document.getElementById('botnavEl').style.display = 'flex';

    switch (currentView) {
        case 'panel':         main.innerHTML = renderPanel(); break;
        case 'clientes':      main.innerHTML = renderClientes(); break;
        case 'detalle':       main.innerHTML = renderDetalleCliente(); break;
        case 'historial':     main.innerHTML = renderHistorial(); break;
        case 'equipos':       main.innerHTML = renderEquipos(); break;
        case 'servicios':     main.innerHTML = renderServicios(); aplicarFiltros(); break;
        case 'mantenimientos':main.innerHTML = renderMantenimientos(); break;
        case 'tecnicos':      main.innerHTML = renderTecnicos(); break;
        default:              main.innerHTML = renderPanel();
    }
}

// ===== LOGIN =====
function renderLogin() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
    <div class="login-screen">
        <div class="login-logo-area">
            <img src="OLM_LOGO.png" style="max-height:80px;max-width:220px;object-fit:contain;margin-bottom:10px;" alt="OLM" onerror="this.style.display='none'">
            <div class="login-brand">OLM INGENIERÍA SAS</div>
            <div class="login-sub">Plantas y Sistemas Eléctricos</div>
        </div>
        <div class="login-card">
            <div class="login-card-title">🔑 Iniciar sesión</div>
            <label class="fl first">Cédula</label>
            <input class="fi" id="loginCedula" placeholder="Ingresa tu número de cédula" type="number"
                oninput="resetPin()">
            <label class="fl">Clave (4 dígitos)</label>
            <div class="pin-display">
                <div class="pin-digit" id="pd0"></div>
                <div class="pin-digit" id="pd1"></div>
                <div class="pin-digit" id="pd2"></div>
                <div class="pin-digit" id="pd3"></div>
            </div>
            <div class="numpad">
                ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="num-btn" onclick="pinPress(${n})">${n}</div>`).join('')}
                <div class="num-btn del" onclick="pinDel()">⌫</div>
                <div class="num-btn zero" onclick="pinPress(0)">0</div>
                <div class="num-btn ok"  onclick="doLogin()">✓</div>
            </div>
            <div id="loginMsg"></div>
            <button class="btn-login" onclick="doLogin()">Ingresar</button>
        </div>
        <div class="login-footer">OLM Ingeniería SAS · Bogotá · v1.0 DEMO</div>
    </div>`;
}

let pinActual = '';
function resetPin() { pinActual = ''; updatePinDisplay(); document.getElementById('loginMsg').innerHTML = ''; }
function pinPress(n) {
    if (pinActual.length >= 4) return;
    pinActual += String(n);
    updatePinDisplay();
    if (pinActual.length === 4) doLogin();
}
function pinDel() {
    pinActual = pinActual.slice(0, -1);
    updatePinDisplay();
}
function updatePinDisplay() {
    for (let i = 0; i < 4; i++) {
        const d = document.getElementById('pd' + i);
        if (!d) return;
        d.className = 'pin-digit';
        if (i < pinActual.length) { d.textContent = '●'; d.classList.add('filled'); }
        else if (i === pinActual.length) { d.textContent = '_'; d.classList.add('active'); }
        else { d.textContent = ''; }
    }
}
async function doLogin() {
    const cedula = document.getElementById('loginCedula')?.value?.trim();
    const clave  = currentPin;
    if(!cedula||clave.length!==4){toast('⚠️ Ingresa cédula y clave de 4 dígitos');return;}
    const tec = tecnicos.find(t=>t.cedula===cedula && t.clave===clave);
    if(!tec){toast('❌ Cédula o clave incorrecta');resetPin();return;}
    sesionActual = tec;
    actualizarTopbar();
    closeModal();
    await cargarDatos();
    toast('👋 Bienvenido, ' + tec.nombre.split(' ')[0]);
}


